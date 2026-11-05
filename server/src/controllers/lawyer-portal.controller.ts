import { Request, Response } from 'express';
import fs from 'node:fs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import {
  lawyerProfileUpdateSchema, officeSchema, availabilitySchema, lawyerConsultationActionSchema,
  CREDENTIAL_KINDS, CONSULTATION_STATUSES, IDENTITY_LOCKED_STATUSES, SUBMITTABLE_STATUSES,
  normalizeEnrollmentNumber, normalizeLanguage, firstZodError, type LawyerStatus, type ConsultationStatus,
} from '../services/connect/constants.js';
import { computeProfileCompletion } from '../services/connect/profile-completion.js';
import { storePrivateFile, deletePrivateFile, sendPrivateFile } from '../services/connect/connect-file.service.js';
import { NotificationService } from '../services/connect/notification.service.js';
import { applyTransition, canLawyerAccessSharedDocument, isSchedulableDate, WorkflowError, NOTIFICATION_COPY, type LawyerAction } from '../services/connect/consultation-workflow.js';
import { consultationInclude, toLawyerConsultation } from '../services/connect/consultation-serializer.js';

const uuid = z.string().uuid();
const MAX_CREDENTIALS = 10;
const CREDENTIAL_EDITABLE: LawyerStatus[] = ['DRAFT', 'INFO_REQUESTED', 'REJECTED'];

const ownInclude = {
  offices: { where: { isPrimary: true }, take: 1 },
  specializations: { include: { specialization: { select: { id: true, slug: true, name: true, isActive: true } } } },
  availability: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
  credentials: { orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } },
} satisfies Prisma.LawyerProfileInclude;
type OwnProfile = Prisma.LawyerProfileGetPayload<{ include: typeof ownInclude }>;

async function loadOwnProfile(req: Request, res: Response): Promise<OwnProfile | null> {
  const profile = await prisma.lawyerProfile.findUnique({ where: { userId: req.user!.id }, include: ownInclude });
  if (!profile) res.status(404).json({ error: 'No lawyer profile is linked to this account.' });
  return profile;
}

function serializeOwnProfile(p: OwnProfile) {
  const completion = computeProfileCompletion({
    ...p,
    specializationCount: p.specializations.length,
    hasOffice: p.offices.length > 0,
    credentialCount: p.credentials.length,
    availabilityCount: p.availability.length,
  });
  return {
    id: p.id,
    professionalName: p.professionalName,
    professionalTitle: p.professionalTitle,
    bio: p.bio,
    hasPhoto: Boolean(p.photoStoredName),
    practiceStartYear: p.practiceStartYear,
    languages: p.languages,
    education: p.education,
    barCouncilState: p.barCouncilState,
    enrollmentNumber: p.enrollmentNumber,
    enrollmentDate: p.enrollmentDate ? p.enrollmentDate.toISOString().slice(0, 10) : null,
    status: p.status,
    statusReason: p.statusReason,
    submittedAt: p.submittedAt?.toISOString() ?? null,
    verifiedAt: p.verifiedAt?.toISOString() ?? null,
    identityLocked: IDENTITY_LOCKED_STATUSES.includes(p.status as LawyerStatus),
    credentialsEditable: CREDENTIAL_EDITABLE.includes(p.status as LawyerStatus),
    offersInPerson: p.offersInPerson,
    offersOnline: p.offersOnline,
    acceptingRequests: p.acceptingRequests,
    feeDisclosed: p.feeDisclosed,
    consultationFeeInr: p.consultationFeeInr,
    contactPhone: p.contactPhone,
    publishPhone: p.publishPhone,
    contactEmail: p.contactEmail,
    publishEmail: p.publishEmail,
    specializations: p.specializations.map(s => s.specialization),
    office: p.offices[0] ? {
      officeName: p.offices[0].officeName, addressLine: p.offices[0].addressLine, locality: p.offices[0].locality,
      city: p.offices[0].city, state: p.offices[0].state, postalCode: p.offices[0].postalCode,
      latitude: p.offices[0].latitude, longitude: p.offices[0].longitude,
    } : null,
    availability: p.availability.map(a => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime })),
    credentials: p.credentials.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
    completion,
  };
}

const sameDate = (a: Date | null, b: string | null | undefined) => (a ? a.toISOString().slice(0, 10) : null) === (b ?? null);

/** Self-service endpoints for role LAWYER. Every query is scoped to the caller's own profile. */
export class LawyerPortalController {
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const profile = await loadOwnProfile(req, res);
      if (!profile) return;
      const grouped = await prisma.consultationRequest.groupBy({ by: ['status'], where: { lawyerProfileId: profile.id }, _count: { _all: true } });
      const consultationCounts = Object.fromEntries(CONSULTATION_STATUSES.map(s => [s, 0])) as Record<ConsultationStatus, number>;
      for (const g of grouped) consultationCounts[g.status as ConsultationStatus] = g._count._all;
      res.json({ profile: serializeOwnProfile(profile), consultationCounts });
    } catch {
      res.status(500).json({ error: 'Failed to load your profile.' });
    }
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    const parsed = lawyerProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const profile = await loadOwnProfile(req, res);
      if (!profile) return;
      const d = parsed.data;

      const identityChanged =
        (d.professionalName !== undefined && d.professionalName !== profile.professionalName)
        || (d.barCouncilState !== undefined && d.barCouncilState !== profile.barCouncilState)
        || (d.enrollmentNumber !== undefined && normalizeEnrollmentNumber(d.enrollmentNumber) !== profile.enrollmentNumberNormalized)
        || (d.enrollmentDate !== undefined && !sameDate(profile.enrollmentDate, d.enrollmentDate));
      if (identityChanged && IDENTITY_LOCKED_STATUSES.includes(profile.status as LawyerStatus)) {
        res.status(409).json({ error: 'Name and enrollment details are locked while your profile is under review or verified. Contact the Legal Buddy admin team to change them.' });
        return;
      }

      const data: Prisma.LawyerProfileUpdateInput = {};
      if (d.professionalName !== undefined) data.professionalName = d.professionalName;
      if (d.professionalTitle !== undefined) data.professionalTitle = d.professionalTitle;
      if (d.bio !== undefined) data.bio = d.bio;
      if (d.practiceStartYear !== undefined) data.practiceStartYear = d.practiceStartYear;
      if (d.languages !== undefined) data.languages = [...new Set(d.languages.map(normalizeLanguage))];
      if (d.education !== undefined) data.education = d.education;
      if (d.enrollmentDate !== undefined) data.enrollmentDate = d.enrollmentDate ? new Date(`${d.enrollmentDate}T00:00:00Z`) : null;
      if (d.offersInPerson !== undefined) data.offersInPerson = d.offersInPerson;
      if (d.offersOnline !== undefined) data.offersOnline = d.offersOnline;
      if (d.acceptingRequests !== undefined) data.acceptingRequests = d.acceptingRequests;
      if (d.contactPhone !== undefined) data.contactPhone = d.contactPhone;
      if (d.contactEmail !== undefined) data.contactEmail = d.contactEmail ? d.contactEmail.toLowerCase() : null;
      if (d.publishPhone !== undefined) data.publishPhone = d.publishPhone;
      if (d.publishEmail !== undefined) data.publishEmail = d.publishEmail;
      if (d.feeDisclosed !== undefined) data.feeDisclosed = d.feeDisclosed;
      if (d.consultationFeeInr !== undefined) data.consultationFeeInr = d.consultationFeeInr;

      if (d.barCouncilState !== undefined || d.enrollmentNumber !== undefined) {
        const barCouncilState = d.barCouncilState ?? profile.barCouncilState;
        const enrollmentNumber = (d.enrollmentNumber ?? profile.enrollmentNumber).trim();
        const enrollmentNumberNormalized = normalizeEnrollmentNumber(enrollmentNumber);
        const clash = await prisma.lawyerProfile.findFirst({
          where: { barCouncilState, enrollmentNumberNormalized, NOT: { id: profile.id } }, select: { id: true },
        });
        if (clash) { res.status(409).json({ error: 'This Bar Council enrollment number is already registered to another profile.' }); return; }
        Object.assign(data, { barCouncilState, enrollmentNumber, enrollmentNumberNormalized });
      }

      // Consent-dependent consistency checks on the merged result.
      const merged = {
        offersInPerson: d.offersInPerson ?? profile.offersInPerson,
        offersOnline: d.offersOnline ?? profile.offersOnline,
        feeDisclosed: d.feeDisclosed ?? profile.feeDisclosed,
        fee: d.consultationFeeInr !== undefined ? d.consultationFeeInr : profile.consultationFeeInr,
        publishPhone: d.publishPhone ?? profile.publishPhone,
        phone: d.contactPhone !== undefined ? d.contactPhone : profile.contactPhone,
        publishEmail: d.publishEmail ?? profile.publishEmail,
        email: d.contactEmail !== undefined ? d.contactEmail : profile.contactEmail,
      };
      if (!merged.offersInPerson && !merged.offersOnline) { res.status(400).json({ error: 'Offer at least one consultation mode (in-person or online).' }); return; }
      if (merged.feeDisclosed && (merged.fee === null || merged.fee === undefined)) { res.status(400).json({ error: 'Enter the consultation fee or choose not to disclose it.' }); return; }
      if (merged.publishPhone && !merged.phone) { res.status(400).json({ error: 'Add a phone number before choosing to publish it.' }); return; }
      if (merged.publishEmail && !merged.email) { res.status(400).json({ error: 'Add an email address before choosing to publish it.' }); return; }

      let specializationIds: string[] | undefined;
      if (d.specializationIds !== undefined) {
        specializationIds = [...new Set(d.specializationIds)];
        const valid = await prisma.specialization.count({ where: { id: { in: specializationIds }, isActive: true } });
        if (valid !== specializationIds.length) { res.status(400).json({ error: 'One or more selected specializations are not available.' }); return; }
      }

      await prisma.$transaction(async tx => {
        await tx.lawyerProfile.update({ where: { id: profile.id }, data });
        if (specializationIds) {
          await tx.lawyerSpecialization.deleteMany({ where: { lawyerProfileId: profile.id } });
          if (specializationIds.length) {
            await tx.lawyerSpecialization.createMany({ data: specializationIds.map(specializationId => ({ lawyerProfileId: profile.id, specializationId })) });
          }
        }
      });

      const updated = await prisma.lawyerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: ownInclude });
      res.json({ profile: serializeOwnProfile(updated), message: 'Profile saved.' });
    } catch (error: any) {
      if (error?.code === 'P2002') { res.status(409).json({ error: 'This Bar Council enrollment number is already registered to another profile.' }); return; }
      res.status(500).json({ error: 'Failed to save your profile.' });
    }
  }

  static async updateOffice(req: Request, res: Response): Promise<void> {
    const parsed = officeSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const profile = await loadOwnProfile(req, res);
      if (!profile) return;
      const data = { ...parsed.data, officeName: parsed.data.officeName ?? null, locality: parsed.data.locality ?? null };
      const existing = profile.offices[0];
      if (existing) await prisma.lawyerOffice.update({ where: { id: existing.id }, data });
      else await prisma.lawyerOffice.create({ data: { ...data, lawyerProfileId: profile.id, isPrimary: true } });
      const updated = await prisma.lawyerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: ownInclude });
      res.json({ profile: serializeOwnProfile(updated), message: 'Office location saved.' });
    } catch {
      res.status(500).json({ error: 'Failed to save office location.' });
    }
  }

  static async updateAvailability(req: Request, res: Response): Promise<void> {
    const parsed = availabilitySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const profile = await loadOwnProfile(req, res);
      if (!profile) return;
      const unique = new Map(parsed.data.slots.map(s => [`${s.dayOfWeek}-${s.startTime}-${s.endTime}`, s]));
      await prisma.$transaction([
        prisma.lawyerAvailability.deleteMany({ where: { lawyerProfileId: profile.id } }),
        prisma.lawyerAvailability.createMany({ data: [...unique.values()].map(s => ({ ...s, lawyerProfileId: profile.id })) }),
      ]);
      const updated = await prisma.lawyerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: ownInclude });
      res.json({ profile: serializeOwnProfile(updated), message: 'Availability saved.' });
    } catch {
      res.status(500).json({ error: 'Failed to save availability.' });
    }
  }

  static async uploadCredential(req: Request, res: Response): Promise<void> {
    const kind = z.enum(CREDENTIAL_KINDS).safeParse(req.body?.kind);
    if (!kind.success) { res.status(400).json({ error: 'Choose the document type.' }); return; }
    try {
      const profile = await loadOwnProfile(req, res);
      if (!profile) return;
      if (!CREDENTIAL_EDITABLE.includes(profile.status as LawyerStatus)) {
        res.status(409).json({ error: 'Documents cannot be changed while your profile is under review or verified.' });
        return;
      }
      if (profile.credentials.length >= MAX_CREDENTIALS) { res.status(400).json({ error: `You can upload up to ${MAX_CREDENTIALS} documents.` }); return; }
      const stored = await storePrivateFile('credentials', req.file!);
      await prisma.lawyerCredential.create({ data: { lawyerProfileId: profile.id, kind: kind.data, ...stored } });
      const updated = await prisma.lawyerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: ownInclude });
      res.status(201).json({ profile: serializeOwnProfile(updated), message: 'Document uploaded.' });
    } catch {
      res.status(500).json({ error: 'Failed to store the document.' });
    }
  }

  static async deleteCredential(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.credentialId).success) { res.status(404).json({ error: 'Document not found.' }); return; }
    try {
      const profile = await loadOwnProfile(req, res);
      if (!profile) return;
      if (!CREDENTIAL_EDITABLE.includes(profile.status as LawyerStatus)) {
        res.status(409).json({ error: 'Documents cannot be changed while your profile is under review or verified.' });
        return;
      }
      const credential = await prisma.lawyerCredential.findFirst({ where: { id: req.params.credentialId, lawyerProfileId: profile.id } });
      if (!credential) { res.status(404).json({ error: 'Document not found.' }); return; }
      await prisma.lawyerCredential.delete({ where: { id: credential.id } });
      await deletePrivateFile('credentials', credential.storedName);
      const updated = await prisma.lawyerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: ownInclude });
      res.json({ profile: serializeOwnProfile(updated), message: 'Document removed.' });
    } catch {
      res.status(500).json({ error: 'Failed to remove the document.' });
    }
  }

  static async downloadCredential(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.credentialId).success) { res.status(404).json({ error: 'Document not found.' }); return; }
    try {
      const credential = await prisma.lawyerCredential.findFirst({
        where: { id: req.params.credentialId, lawyerProfile: { userId: req.user!.id } },
      });
      if (!credential) { res.status(404).json({ error: 'Document not found.' }); return; }
      sendPrivateFile(res, 'credentials', credential.storedName, credential.mimeType, credential.originalName);
    } catch {
      res.status(500).json({ error: 'Failed to open the document.' });
    }
  }

  static async uploadPhoto(req: Request, res: Response): Promise<void> {
    try {
      const profile = await loadOwnProfile(req, res);
      if (!profile) return;
      const stored = await storePrivateFile('photos', req.file!);
      await prisma.lawyerProfile.update({ where: { id: profile.id }, data: { photoStoredName: stored.storedName, photoMimeType: stored.mimeType } });
      await deletePrivateFile('photos', profile.photoStoredName);
      const updated = await prisma.lawyerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: ownInclude });
      res.json({ profile: serializeOwnProfile(updated), message: 'Photo updated.' });
    } catch {
      res.status(500).json({ error: 'Failed to store the photo.' });
    }
  }

  static async getPhoto(req: Request, res: Response): Promise<void> {
    const profile = await prisma.lawyerProfile.findUnique({ where: { userId: req.user!.id }, select: { photoStoredName: true, photoMimeType: true } }).catch(() => null);
    if (!profile?.photoStoredName || !profile.photoMimeType) { res.status(404).end(); return; }
    sendPrivateFile(res, 'photos', profile.photoStoredName, profile.photoMimeType);
  }

  static async submitForReview(req: Request, res: Response): Promise<void> {
    try {
      const profile = await loadOwnProfile(req, res);
      if (!profile) return;
      if (!SUBMITTABLE_STATUSES.includes(profile.status as LawyerStatus)) {
        res.status(409).json({ error: profile.status === 'PENDING_REVIEW' ? 'Your profile is already awaiting review.' : 'Your profile cannot be resubmitted in its current status.' });
        return;
      }
      const { completion } = serializeOwnProfile(profile);
      if (!completion.readyToSubmit) {
        res.status(400).json({ error: `Complete these items before submitting: ${completion.missingRequired.join(', ')}.` });
        return;
      }
      const result = await prisma.lawyerProfile.updateMany({
        where: { id: profile.id, status: profile.status },
        data: { status: 'PENDING_REVIEW', submittedAt: new Date(), statusReason: null },
      });
      if (result.count !== 1) { res.status(409).json({ error: 'Your profile status changed. Refresh and try again.' }); return; }
      await NotificationService.notifyAdmins({
        type: 'LAWYER_SUBMITTED', title: 'Lawyer profile awaiting verification',
        body: `${profile.professionalName} submitted a profile for credential review.`, link: `/connect/admin/lawyers/${profile.id}`,
      });
      const updated = await prisma.lawyerProfile.findUniqueOrThrow({ where: { id: profile.id }, include: ownInclude });
      res.json({ profile: serializeOwnProfile(updated), message: 'Submitted for admin review.' });
    } catch {
      res.status(500).json({ error: 'Failed to submit your profile.' });
    }
  }

  // ─── Consultations assigned to this lawyer ──────────────────────────────
  static async listConsultations(req: Request, res: Response): Promise<void> {
    const status = z.enum(CONSULTATION_STATUSES).optional().safeParse(req.query.status || undefined);
    if (!status.success) { res.status(400).json({ error: 'Invalid status filter.' }); return; }
    try {
      const profile = await prisma.lawyerProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
      if (!profile) { res.status(404).json({ error: 'No lawyer profile is linked to this account.' }); return; }
      const requests = await prisma.consultationRequest.findMany({
        where: { lawyerProfileId: profile.id, ...(status.data ? { status: status.data } : {}) },
        include: consultationInclude,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ consultations: requests.map(toLawyerConsultation) });
    } catch {
      res.status(500).json({ error: 'Failed to load consultation requests.' });
    }
  }

  static async actOnConsultation(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Consultation request not found.' }); return; }
    const parsed = lawyerConsultationActionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const profile = await prisma.lawyerProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true, status: true, professionalName: true } });
      if (!profile) { res.status(404).json({ error: 'Consultation request not found.' }); return; }
      if (profile.status === 'SUSPENDED') { res.status(403).json({ error: 'Your profile is suspended. Contact the Legal Buddy admin team.' }); return; }

      const request = await prisma.consultationRequest.findFirst({ where: { id: req.params.id, lawyerProfileId: profile.id } });
      if (!request) { res.status(404).json({ error: 'Consultation request not found.' }); return; }

      const { action, proposedDate, proposedTime, message } = parsed.data;
      if (action === 'PROPOSE_TIME' && proposedDate && !isSchedulableDate(proposedDate)) {
        res.status(400).json({ error: 'Choose a date between today and 180 days from now.' });
        return;
      }
      const result = applyTransition({ ...request, status: request.status as ConsultationStatus }, 'LAWYER', action as LawyerAction, { date: proposedDate, time: proposedTime, message });

      const updated = await prisma.consultationRequest.updateMany({
        where: { id: request.id, status: request.status, updatedAt: request.updatedAt },
        data: { ...result.updates, status: result.status },
      });
      if (updated.count !== 1) { res.status(409).json({ error: 'This request was updated by someone else. Refresh and try again.' }); return; }

      if (result.notify) {
        const copy = NOTIFICATION_COPY[result.notify.event];
        await NotificationService.notify({ userId: request.userId, type: result.notify.event, title: copy.title, body: `${copy.body} (${profile.professionalName})`, link: '/connect/consultations' });
      }
      const fresh = await prisma.consultationRequest.findUniqueOrThrow({ where: { id: request.id }, include: consultationInclude });
      res.json({ consultation: toLawyerConsultation(fresh) });
    } catch (error) {
      if (error instanceof WorkflowError) { res.status(error.httpStatus).json({ error: error.message }); return; }
      res.status(500).json({ error: 'Failed to update the consultation request.' });
    }
  }

  /** Streams the user's PDF only for the assigned lawyer, only while the user's consent is active. */
  static async getSharedDocument(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Document not available.' }); return; }
    try {
      const request = await prisma.consultationRequest.findFirst({
        where: { id: req.params.id, lawyerProfile: { userId: req.user!.id, status: { not: 'SUSPENDED' } } },
        include: { sharedDocument: { select: { filePath: true, originalName: true, userId: true } } },
      });
      if (!request || !canLawyerAccessSharedDocument(request) || !request.sharedDocument || request.sharedDocument.userId !== request.userId) {
        res.status(404).json({ error: 'Document not available.' });
        return;
      }
      const { filePath, originalName } = request.sharedDocument;
      if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Document not available.' }); return; }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(originalName)}`);
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.status(500).json({ error: 'Failed to open the shared document.' });
    }
  }
}
