import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import {
  adminDecisionSchema, reportResolveSchema, specializationCreateSchema, specializationUpdateSchema,
  LAWYER_STATUSES, CONSULTATION_STATUSES, firstZodError, slugify, type LawyerStatus,
} from '../services/connect/constants.js';
import { computeProfileCompletion } from '../services/connect/profile-completion.js';
import { sendPrivateFile } from '../services/connect/connect-file.service.js';
import { NotificationService } from '../services/connect/notification.service.js';

const uuid = z.string().uuid();

/** Allowed admin decisions: action → (required previous status, resulting status, reason required?). */
export const DECISIONS: Record<string, { from: LawyerStatus[]; to: LawyerStatus; reasonRequired: boolean }> = {
  APPROVE: { from: ['PENDING_REVIEW'], to: 'VERIFIED', reasonRequired: false },
  REJECT: { from: ['PENDING_REVIEW'], to: 'REJECTED', reasonRequired: true },
  REQUEST_INFO: { from: ['PENDING_REVIEW'], to: 'INFO_REQUESTED', reasonRequired: true },
  SUSPEND: { from: ['VERIFIED'], to: 'SUSPENDED', reasonRequired: true },
  RESTORE: { from: ['SUSPENDED'], to: 'VERIFIED', reasonRequired: true },
};

const DECISION_NOTICE: Record<string, { title: string; body: string }> = {
  APPROVE: { title: 'Profile verified', body: 'A Legal Buddy admin reviewed your credentials. Your profile is now listed in Find a Lawyer.' },
  REJECT: { title: 'Profile not approved', body: 'Your profile was not approved. Open your dashboard to see the reason and resubmit.' },
  REQUEST_INFO: { title: 'More information requested', body: 'The admin team needs more information before verifying your profile.' },
  SUSPEND: { title: 'Profile suspended', body: 'Your public listing has been suspended. Open your dashboard for details.' },
  RESTORE: { title: 'Profile restored', body: 'Your public listing has been restored.' },
};

/** Admin-only (role ADMIN enforced in the router). Every state change writes an AdminAuditLog row. */
export class AdminLawyerController {
  static async stats(_req: Request, res: Response): Promise<void> {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [byStatus, newRegistrations, openReports, consultationsByStatus] = await Promise.all([
        prisma.lawyerProfile.groupBy({ by: ['status'], where: { source: 'LEGAL_BUDDY' }, _count: { _all: true } }),
        prisma.lawyerProfile.count({ where: { source: 'LEGAL_BUDDY', createdAt: { gte: weekAgo } } }),
        prisma.lawyerReport.count({ where: { status: 'OPEN' } }),
        prisma.consultationRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);
      const lawyers = Object.fromEntries(LAWYER_STATUSES.map(s => [s, 0])) as Record<string, number>;
      for (const g of byStatus) lawyers[g.status] = g._count._all;
      const consultations = Object.fromEntries(CONSULTATION_STATUSES.map(s => [s, 0])) as Record<string, number>;
      for (const g of consultationsByStatus) consultations[g.status] = g._count._all;
      res.json({
        lawyers: { ...lawyers, total: Object.values(lawyers).reduce((a, b) => a + b, 0), newLast7Days: newRegistrations },
        openReports,
        // Aggregate counts only: admins do not need users' legal issue descriptions.
        consultations: { ...consultations, total: Object.values(consultations).reduce((a, b) => a + b, 0) },
      });
    } catch {
      res.status(500).json({ error: 'Failed to load statistics.' });
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    const query = z.object({
      status: z.enum(LAWYER_STATUSES).optional(),
      q: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
    }).safeParse(req.query);
    if (!query.success) { res.status(400).json({ error: firstZodError(query.error) }); return; }
    const { status, q, page } = query.data;
    const pageSize = 25;
    try {
      const where = {
        ...(status ? { status } : {}),
        ...(q ? { OR: [
          { professionalName: { contains: q, mode: 'insensitive' as const } },
          { enrollmentNumber: { contains: q, mode: 'insensitive' as const } },
          { user: { email: { contains: q, mode: 'insensitive' as const } } },
        ] } : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.lawyerProfile.count({ where }),
        prisma.lawyerProfile.findMany({
          where,
          orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true, professionalName: true, barCouncilState: true, enrollmentNumber: true, status: true, source: true,
            isSynthetic: true, submittedAt: true, verifiedAt: true, createdAt: true,
            user: { select: { email: true } },
            offices: { where: { isPrimary: true }, take: 1, select: { city: true, state: true } },
            _count: { select: { credentials: true, reports: { where: { status: 'OPEN' } } } },
          },
        }),
      ]);
      res.json({
        lawyers: rows.map(r => ({
          id: r.id, professionalName: r.professionalName, email: r.user.email, barCouncilState: r.barCouncilState,
          enrollmentNumber: r.enrollmentNumber, status: r.status, source: r.source, isSynthetic: r.isSynthetic,
          city: r.offices[0]?.city ?? null, state: r.offices[0]?.state ?? null,
          credentialCount: r._count.credentials, openReports: r._count.reports,
          submittedAt: r.submittedAt?.toISOString() ?? null, verifiedAt: r.verifiedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
        })),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch {
      res.status(500).json({ error: 'Failed to load lawyer profiles.' });
    }
  }

  static async detail(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Lawyer profile not found.' }); return; }
    try {
      const p = await prisma.lawyerProfile.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { email: true, name: true, createdAt: true } },
          offices: { where: { isPrimary: true }, take: 1 },
          specializations: { include: { specialization: { select: { id: true, name: true, slug: true } } } },
          availability: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
          credentials: { orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true, sha256: true, createdAt: true } },
          reports: { orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, reason: true, details: true, status: true, resolution: true, createdAt: true } },
        },
      });
      if (!p) { res.status(404).json({ error: 'Lawyer profile not found.' }); return; }
      const history = await prisma.adminAuditLog.findMany({
        where: { entityType: 'LAWYER_PROFILE', entityId: p.id },
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { name: true, email: true } } },
        take: 100,
      });
      const completion = computeProfileCompletion({
        ...p, specializationCount: p.specializations.length, hasOffice: p.offices.length > 0,
        credentialCount: p.credentials.length, availabilityCount: p.availability.length,
      });
      const { photoStoredName, user, offices, specializations, ...rest } = p;
      res.json({
        lawyer: {
          ...rest,
          hasPhoto: Boolean(photoStoredName),
          account: user,
          office: offices[0] ?? null,
          specializations: specializations.map(s => s.specialization),
          enrollmentDate: p.enrollmentDate ? p.enrollmentDate.toISOString().slice(0, 10) : null,
          completion,
          allowedActions: Object.entries(DECISIONS).filter(([, d]) => d.from.includes(p.status as LawyerStatus)).map(([a]) => a),
        },
        history: history.map(h => ({
          id: h.id, action: h.action, previousStatus: h.previousStatus, newStatus: h.newStatus, reason: h.reason,
          createdAt: h.createdAt.toISOString(), admin: h.admin,
        })),
      });
    } catch {
      res.status(500).json({ error: 'Failed to load the lawyer profile.' });
    }
  }

  static async downloadCredential(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success || !uuid.safeParse(req.params.credentialId).success) { res.status(404).json({ error: 'Document not found.' }); return; }
    try {
      const credential = await prisma.lawyerCredential.findFirst({ where: { id: req.params.credentialId, lawyerProfileId: req.params.id } });
      if (!credential) { res.status(404).json({ error: 'Document not found.' }); return; }
      sendPrivateFile(res, 'credentials', credential.storedName, credential.mimeType, credential.originalName);
    } catch {
      res.status(500).json({ error: 'Failed to open the document.' });
    }
  }

  static async photo(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).end(); return; }
    const p = await prisma.lawyerProfile.findUnique({ where: { id: req.params.id }, select: { photoStoredName: true, photoMimeType: true } }).catch(() => null);
    if (!p?.photoStoredName || !p.photoMimeType) { res.status(404).end(); return; }
    sendPrivateFile(res, 'photos', p.photoStoredName, p.photoMimeType);
  }

  static async decide(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Lawyer profile not found.' }); return; }
    const parsed = adminDecisionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    const { action, reason, credentialsReviewed } = parsed.data;
    const rule = DECISIONS[action];
    if (rule.reasonRequired && !reason) { res.status(400).json({ error: 'A reason is required for this decision. It will be shown to the lawyer.' }); return; }
    if (action === 'APPROVE' && !credentialsReviewed) {
      res.status(400).json({ error: 'Confirm that you have reviewed the submitted credentials before approving.' });
      return;
    }
    try {
      const profile = await prisma.lawyerProfile.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, status: true, source: true } });
      if (!profile) { res.status(404).json({ error: 'Lawyer profile not found.' }); return; }
      if (profile.source !== 'LEGAL_BUDDY') { res.status(400).json({ error: 'External listings cannot receive a Legal Buddy verification.' }); return; }
      if (profile.userId === req.user!.id) { res.status(403).json({ error: 'You cannot review your own profile.' }); return; }
      if (!rule.from.includes(profile.status as LawyerStatus)) {
        res.status(409).json({ error: `Cannot ${action.toLowerCase().replace('_', ' ')} a profile that is ${profile.status.toLowerCase().replace('_', ' ')}.` });
        return;
      }

      const now = new Date();
      await prisma.$transaction(async tx => {
        const updated = await tx.lawyerProfile.updateMany({
          where: { id: profile.id, status: profile.status },
          data: {
            status: rule.to,
            statusReason: action === 'APPROVE' ? null : reason ?? null,
            ...(action === 'APPROVE' ? { verifiedAt: now, verifiedById: req.user!.id } : {}),
          },
        });
        if (updated.count !== 1) throw new ConcurrentChange();
        await tx.adminAuditLog.create({
          data: {
            adminId: req.user!.id, action: `LAWYER_${action}`, entityType: 'LAWYER_PROFILE', entityId: profile.id,
            previousStatus: profile.status, newStatus: rule.to,
            reason: action === 'APPROVE' ? (reason ?? 'Credentials manually reviewed by admin.') : reason ?? null,
          },
        });
        const notice = DECISION_NOTICE[action];
        await NotificationService.notify({ userId: profile.userId, type: `LAWYER_${action}`, title: notice.title, body: notice.body, link: '/connect/lawyer' }, tx);
      });
      res.json({ message: 'Decision recorded.', status: rule.to });
    } catch (error) {
      if (error instanceof ConcurrentChange) { res.status(409).json({ error: 'The profile changed while you were reviewing it. Reload and try again.' }); return; }
      res.status(500).json({ error: 'Failed to record the decision.' });
    }
  }

  // ─── Reports ────────────────────────────────────────────────────────────
  static async listReports(req: Request, res: Response): Promise<void> {
    const status = z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).default('OPEN').safeParse(req.query.status || undefined);
    if (!status.success) { res.status(400).json({ error: 'Invalid status filter.' }); return; }
    try {
      const reports = await prisma.lawyerReport.findMany({
        where: { status: status.data },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          lawyerProfile: { select: { id: true, professionalName: true, status: true } },
          reporter: { select: { name: true, email: true } },
        },
      });
      res.json({ reports: reports.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })) });
    } catch {
      res.status(500).json({ error: 'Failed to load reports.' });
    }
  }

  static async resolveReport(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.reportId).success) { res.status(404).json({ error: 'Report not found.' }); return; }
    const parsed = reportResolveSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const report = await prisma.lawyerReport.findUnique({ where: { id: req.params.reportId }, select: { id: true, status: true } });
      if (!report) { res.status(404).json({ error: 'Report not found.' }); return; }
      if (report.status !== 'OPEN') { res.status(409).json({ error: 'This report has already been closed.' }); return; }
      await prisma.$transaction([
        prisma.lawyerReport.update({ where: { id: report.id }, data: { status: parsed.data.status, resolution: parsed.data.resolution, resolvedById: req.user!.id } }),
        prisma.adminAuditLog.create({ data: {
          adminId: req.user!.id, action: `REPORT_${parsed.data.status}`, entityType: 'LAWYER_REPORT', entityId: report.id,
          previousStatus: 'OPEN', newStatus: parsed.data.status, reason: parsed.data.resolution,
        } }),
      ]);
      res.json({ message: 'Report updated.' });
    } catch {
      res.status(500).json({ error: 'Failed to update the report.' });
    }
  }

  // ─── Specializations ────────────────────────────────────────────────────
  static async listSpecializations(_req: Request, res: Response): Promise<void> {
    try {
      const specializations = await prisma.specialization.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { lawyers: true } } },
      });
      res.json({ specializations: specializations.map(s => ({ id: s.id, slug: s.slug, name: s.name, isActive: s.isActive, sortOrder: s.sortOrder, lawyerCount: s._count.lawyers })) });
    } catch {
      res.status(500).json({ error: 'Failed to load specializations.' });
    }
  }

  static async createSpecialization(req: Request, res: Response): Promise<void> {
    const parsed = specializationCreateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    const slug = slugify(parsed.data.name);
    if (!slug) { res.status(400).json({ error: 'Enter a valid name.' }); return; }
    try {
      const created = await prisma.$transaction(async tx => {
        const spec = await tx.specialization.create({ data: { slug, name: parsed.data.name, sortOrder: parsed.data.sortOrder ?? 500 } });
        await tx.adminAuditLog.create({ data: { adminId: req.user!.id, action: 'SPECIALIZATION_CREATE', entityType: 'SPECIALIZATION', entityId: spec.id, newStatus: 'ACTIVE', reason: spec.name } });
        return spec;
      });
      res.status(201).json({ specialization: created });
    } catch (error: any) {
      if (error?.code === 'P2002') { res.status(409).json({ error: 'A specialization with this name already exists.' }); return; }
      res.status(500).json({ error: 'Failed to create specialization.' });
    }
  }

  static async updateSpecialization(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.specId).success) { res.status(404).json({ error: 'Specialization not found.' }); return; }
    const parsed = specializationUpdateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const existing = await prisma.specialization.findUnique({ where: { id: req.params.specId } });
      if (!existing) { res.status(404).json({ error: 'Specialization not found.' }); return; }
      const updated = await prisma.$transaction(async tx => {
        const spec = await tx.specialization.update({ where: { id: existing.id }, data: parsed.data });
        await tx.adminAuditLog.create({ data: {
          adminId: req.user!.id, action: 'SPECIALIZATION_UPDATE', entityType: 'SPECIALIZATION', entityId: spec.id,
          previousStatus: existing.isActive ? 'ACTIVE' : 'INACTIVE', newStatus: spec.isActive ? 'ACTIVE' : 'INACTIVE',
          reason: existing.name !== spec.name ? `Renamed from "${existing.name}" to "${spec.name}"` : null,
        } });
        return spec;
      });
      res.json({ specialization: updated });
    } catch {
      res.status(500).json({ error: 'Failed to update specialization.' });
    }
  }
}

class ConcurrentChange extends Error {}
