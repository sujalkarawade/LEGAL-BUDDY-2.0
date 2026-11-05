import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { consultationCreateSchema, userConsultationActionSchema, firstZodError, type ConsultationStatus } from '../services/connect/constants.js';
import { applyTransition, isSchedulableDate, WorkflowError, NOTIFICATION_COPY, type UserAction } from '../services/connect/consultation-workflow.js';
import { consultationInclude, toUserConsultation } from '../services/connect/consultation-serializer.js';
import { NotificationService } from '../services/connect/notification.service.js';
import { isResourceOwner } from '../services/document-access.service.js';

const uuid = z.string().uuid();

/** Consultation requests from the requesting user's side. Every query is scoped to req.user.id. */
export class ConsultationController {
  static async create(req: Request, res: Response): Promise<void> {
    const parsed = consultationCreateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    const d = parsed.data;
    if (!isSchedulableDate(d.preferredDate)) { res.status(400).json({ error: 'Choose a preferred date between today and 180 days from now.' }); return; }

    try {
      const lawyer = await prisma.lawyerProfile.findUnique({
        where: { id: d.lawyerId },
        select: { id: true, userId: true, status: true, source: true, acceptingRequests: true, offersInPerson: true, offersOnline: true },
      });
      // Only Legal Buddy verified lawyers can receive requests through the platform.
      if (!lawyer || lawyer.source !== 'LEGAL_BUDDY' || lawyer.status !== 'VERIFIED') {
        res.status(404).json({ error: 'Lawyer profile not found.' });
        return;
      }
      if (lawyer.userId === req.user!.id) { res.status(400).json({ error: 'You cannot request a consultation with yourself.' }); return; }
      if (!lawyer.acceptingRequests) { res.status(409).json({ error: 'This lawyer is not accepting consultation requests at the moment.' }); return; }
      if ((d.mode === 'IN_PERSON' && !lawyer.offersInPerson) || (d.mode === 'ONLINE' && !lawyer.offersOnline)) {
        res.status(400).json({ error: 'This lawyer does not offer the selected consultation mode.' });
        return;
      }

      if (d.specializationId) {
        const spec = await prisma.specialization.findFirst({ where: { id: d.specializationId, isActive: true }, select: { id: true } });
        if (!spec) { res.status(400).json({ error: 'Choose a valid legal assistance category.' }); return; }
      }

      // Document sharing requires an explicit consent flag AND ownership of the document.
      let sharedDocumentId: string | null = null;
      if (d.sharedDocumentId) {
        if (!d.documentShareConsent) {
          res.status(400).json({ error: 'Confirm that you consent to share the selected document with this lawyer.' });
          return;
        }
        const doc = await prisma.document.findUnique({ where: { id: d.sharedDocumentId }, select: { id: true, userId: true } });
        if (!doc || !isResourceOwner(doc.userId, req.user!.id)) { res.status(404).json({ error: 'Document not found.' }); return; }
        sharedDocumentId = doc.id;
      }
      if (d.analysisShareConsent && !sharedDocumentId) {
        res.status(400).json({ error: 'Choose a document to share before sharing its clause analysis.' });
        return;
      }

      const openDuplicate = await prisma.consultationRequest.findFirst({
        where: { userId: req.user!.id, lawyerProfileId: lawyer.id, status: { in: ['PENDING', 'RESCHEDULE_REQUESTED'] } },
        select: { id: true },
      });
      if (openDuplicate) {
        res.status(409).json({ error: 'You already have an open request with this lawyer. You can track it under My Consultations.' });
        return;
      }

      const created = await prisma.consultationRequest.create({
        data: {
          userId: req.user!.id,
          lawyerProfileId: lawyer.id,
          specializationId: d.specializationId ?? null,
          contactName: d.contactName,
          contactPhone: d.contactPhone,
          contactEmail: d.contactEmail.toLowerCase(),
          description: d.description,
          mode: d.mode,
          preferredDate: d.preferredDate,
          preferredTime: d.preferredTime,
          sharedDocumentId,
          documentShareConsentAt: sharedDocumentId ? new Date() : null,
          analysisShareConsentAt: sharedDocumentId && d.analysisShareConsent ? new Date() : null,
        },
        include: consultationInclude,
      });

      const copy = NOTIFICATION_COPY.CONSULTATION_REQUESTED;
      await NotificationService.notify({ userId: lawyer.userId, type: 'CONSULTATION_REQUESTED', title: copy.title, body: copy.body, link: '/connect/lawyer?tab=requests' });
      res.status(201).json({ consultation: toUserConsultation(created), message: 'Your request has been sent to the lawyer.' });
    } catch {
      res.status(500).json({ error: 'Failed to submit your consultation request.' });
    }
  }

  static async listMine(req: Request, res: Response): Promise<void> {
    try {
      const requests = await prisma.consultationRequest.findMany({
        where: { userId: req.user!.id },
        include: consultationInclude,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ consultations: requests.map(toUserConsultation) });
    } catch {
      res.status(500).json({ error: 'Failed to load your consultation requests.' });
    }
  }

  static async getMine(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Consultation request not found.' }); return; }
    try {
      const request = await prisma.consultationRequest.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: consultationInclude });
      if (!request) { res.status(404).json({ error: 'Consultation request not found.' }); return; }
      res.json({ consultation: toUserConsultation(request) });
    } catch {
      res.status(500).json({ error: 'Failed to load the consultation request.' });
    }
  }

  static async act(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Consultation request not found.' }); return; }
    const parsed = userConsultationActionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const request = await prisma.consultationRequest.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
        include: { lawyerProfile: { select: { userId: true } } },
      });
      if (!request) { res.status(404).json({ error: 'Consultation request not found.' }); return; }

      const { action, preferredDate, preferredTime, message } = parsed.data;

      if (action === 'REVOKE_DOCUMENT') {
        if (!request.sharedDocumentId || request.documentShareRevokedAt) { res.status(400).json({ error: 'No document is currently shared on this request.' }); return; }
        await prisma.consultationRequest.update({ where: { id: request.id }, data: { documentShareRevokedAt: new Date() } });
      } else {
        if (action === 'REQUEST_RESCHEDULE' && preferredDate && !isSchedulableDate(preferredDate)) {
          res.status(400).json({ error: 'Choose a date between today and 180 days from now.' });
          return;
        }
        const result = applyTransition({ ...request, status: request.status as ConsultationStatus }, 'USER', action as UserAction, { date: preferredDate, time: preferredTime, message });
        const updated = await prisma.consultationRequest.updateMany({
          where: { id: request.id, status: request.status, updatedAt: request.updatedAt },
          data: { ...result.updates, status: result.status },
        });
        if (updated.count !== 1) { res.status(409).json({ error: 'This request was updated by the lawyer. Refresh and try again.' }); return; }
        if (result.notify) {
          const copy = NOTIFICATION_COPY[result.notify.event];
          await NotificationService.notify({ userId: request.lawyerProfile.userId, type: result.notify.event, title: copy.title, body: copy.body, link: '/connect/lawyer?tab=requests' });
        }
      }

      const fresh = await prisma.consultationRequest.findUniqueOrThrow({ where: { id: request.id }, include: consultationInclude });
      res.json({ consultation: toUserConsultation(fresh) });
    } catch (error) {
      if (error instanceof WorkflowError) { res.status(error.httpStatus).json({ error: error.message }); return; }
      res.status(500).json({ error: 'Failed to update your consultation request.' });
    }
  }
}
