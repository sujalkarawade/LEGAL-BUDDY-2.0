import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { nearbySearchSchema, reportCreateSchema, firstZodError, SEARCH_RADII_KM, EXPERIENCE_BANDS, COMMON_LANGUAGES } from '../services/connect/constants.js';
import { findNearbyLawyerIds } from '../services/connect/geo.service.js';
import { lawyerPublicInclude, toPublicLawyer, isPubliclyVisible } from '../services/connect/lawyer-serializer.js';
import { sendPrivateFile } from '../services/connect/connect-file.service.js';
import { suggestSpecializations } from '../services/connect/lawyer-matching.service.js';
import { NotificationService } from '../services/connect/notification.service.js';

const uuid = z.string().uuid();

/** Discovery endpoints for signed-in users. Only the public projection ever leaves this controller. */
export class LawyerController {
  static async getSpecializations(_req: Request, res: Response): Promise<void> {
    try {
      const specializations = await prisma.specialization.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, slug: true, name: true },
      });
      res.json({ specializations, radiiKm: SEARCH_RADII_KM, experienceBands: EXPERIENCE_BANDS, languages: COMMON_LANGUAGES });
    } catch {
      res.status(500).json({ error: 'Failed to load specializations.' });
    }
  }

  static async searchNearby(req: Request, res: Response): Promise<void> {
    const parsed = nearbySearchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) });
      return;
    }
    try {
      const rows = await findNearbyLawyerIds(parsed.data);
      const profiles = rows.length
        ? await prisma.lawyerProfile.findMany({ where: { id: { in: rows.map(r => r.id) } }, include: lawyerPublicInclude })
        : [];
      const byId = new Map(profiles.map(p => [p.id, p]));
      // Preserve SQL ordering and re-check visibility in case a status changed between the two queries.
      const lawyers = rows.flatMap(row => {
        const profile = byId.get(row.id);
        return profile && isPubliclyVisible(profile) ? [toPublicLawyer(profile, Number(row.distanceKm))] : [];
      });
      const total = rows[0]?.totalCount ?? 0;
      res.json({
        lawyers,
        pagination: { page: parsed.data.page, pageSize: parsed.data.pageSize, total, totalPages: Math.ceil(total / parsed.data.pageSize) },
        search: { lat: parsed.data.lat, lng: parsed.data.lng, radiusKm: parsed.data.radiusKm },
      });
    } catch {
      res.status(500).json({ error: 'Lawyer search failed. Please try again.' });
    }
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Lawyer profile not found.' }); return; }
    try {
      const profile = await prisma.lawyerProfile.findUnique({ where: { id: req.params.id }, include: lawyerPublicInclude });
      if (!profile || !isPubliclyVisible(profile)) {
        res.status(404).json({ error: 'Lawyer profile not found.' });
        return;
      }
      res.json({ lawyer: toPublicLawyer(profile) });
    } catch {
      res.status(500).json({ error: 'Failed to load lawyer profile.' });
    }
  }

  /** Public (no auth needed so <img> tags work) but only for publicly visible profiles. */
  static async getPublicPhoto(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).end(); return; }
    const profile = await prisma.lawyerProfile.findUnique({
      where: { id: req.params.id },
      select: { status: true, source: true, photoStoredName: true, photoMimeType: true },
    }).catch(() => null);
    if (!profile || !isPubliclyVisible(profile) || !profile.photoStoredName || !profile.photoMimeType) {
      res.status(404).end();
      return;
    }
    sendPrivateFile(res, 'photos', profile.photoStoredName, profile.photoMimeType);
  }

  static async reportProfile(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Lawyer profile not found.' }); return; }
    const parsed = reportCreateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const profile = await prisma.lawyerProfile.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, status: true, source: true } });
      if (!profile || !isPubliclyVisible(profile)) { res.status(404).json({ error: 'Lawyer profile not found.' }); return; }
      if (profile.userId === req.user!.id) { res.status(400).json({ error: 'You cannot report your own profile.' }); return; }
      const open = await prisma.lawyerReport.findFirst({ where: { lawyerProfileId: profile.id, reporterId: req.user!.id, status: 'OPEN' }, select: { id: true } });
      if (open) { res.status(409).json({ error: 'You already have an open report for this profile. Our team will review it.' }); return; }
      await prisma.lawyerReport.create({
        data: { lawyerProfileId: profile.id, reporterId: req.user!.id, reason: parsed.data.reason, details: parsed.data.details ?? null },
      });
      await NotificationService.notifyAdmins({ type: 'LAWYER_REPORTED', title: 'Lawyer profile reported', body: 'A user reported a lawyer profile for review.', link: '/connect/admin?tab=reports' });
      res.status(201).json({ message: 'Thank you. The report has been sent to the Legal Buddy admin team.' });
    } catch {
      res.status(500).json({ error: 'Failed to submit report.' });
    }
  }

  /**
   * Phase 3 — specialization suggestions for one of the caller's documents.
   * Mounted behind requireDocumentOwnership. Reads ONLY category / risk labels and the
   * contract type; never excerpts, chunks or extracted text.
   */
  static async matchForDocument(req: Request, res: Response): Promise<void> {
    try {
      const documentId = req.params.id;
      const [clauses, summary, missing, specializations] = await Promise.all([
        prisma.clauseFinding.findMany({ where: { documentId }, select: { category: true, riskLevel: true } }),
        prisma.contractSummary.findUnique({ where: { documentId }, select: { contractType: true } }),
        prisma.completenessCheck.findMany({ where: { documentId, status: 'NOT_FOUND' }, select: { expectedSection: true } }),
        prisma.specialization.findMany({ where: { isActive: true }, select: { id: true, slug: true, name: true } }),
      ]);
      const analysed = clauses.length > 0 || Boolean(summary);
      const result = suggestSpecializations({
        clauses,
        contractType: summary?.contractType || null,
        missingSections: missing.map(m => m.expectedSection),
      });
      const names = new Map(specializations.map(s => [s.slug, s]));
      res.json({
        analysed,
        ...result,
        message: analysed ? result.message : 'This document has not been analysed yet. Run the analysis first, or search lawyers manually.',
        suggestions: result.suggestions.flatMap(s => {
          const spec = names.get(s.slug);
          return spec ? [{ ...s, specializationId: spec.id, name: spec.name }] : [];
        }),
      });
    } catch {
      res.status(500).json({ error: 'Failed to compute lawyer suggestions.' });
    }
  }
}
