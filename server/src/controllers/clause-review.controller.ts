import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { clauseReviewSchema, firstZodError } from '../services/connect/constants.js';
import { canLawyerReviewAnalysis } from '../services/connect/consultation-workflow.js';
import { NotificationService } from '../services/connect/notification.service.js';

const uuid = z.string().uuid();
const MAX_COMMENTS_PER_CONSULTATION = 300;

const requestSelect = {
  id: true, userId: true, status: true, sharedDocumentId: true,
  documentShareConsentAt: true, documentShareRevokedAt: true, analysisShareConsentAt: true,
  lawyerProfile: { select: { userId: true, status: true, professionalName: true } },
} as const;

async function loadClausesAndComments(consultationId: string, documentId: string) {
  const [clauses, comments] = await Promise.all([
    prisma.clauseFinding.findMany({
      where: { documentId },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, category: true, title: true, excerpt: true, pageNumber: true, riskLevel: true, plainLanguageExplanation: true, potentialConcern: true, reviewQuestion: true },
    }),
    prisma.clauseReviewComment.findMany({
      where: { consultationRequestId: consultationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, clauseFindingId: true, authorRole: true, verdict: true, comment: true, suggestedText: true, createdAt: true },
    }),
  ]);
  return { clauses, comments: comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })) };
}

/**
 * Lawyer ↔ client review of Legal Buddy's clause findings, inside one consultation.
 * The lawyer sees the findings only while the user's separate "share analysis" consent and the
 * document-sharing consent are both active and the request is live.
 */
export class ClauseReviewController {
  // ─── Lawyer side (/api/lawyer-portal/consultations/:id/review) ───────────
  static async lawyerGet(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Review not available.' }); return; }
    try {
      const request = await prisma.consultationRequest.findFirst({ where: { id: req.params.id, lawyerProfile: { userId: req.user!.id } }, select: requestSelect });
      if (!request || request.lawyerProfile.status === 'SUSPENDED' || !canLawyerReviewAnalysis(request) || !request.sharedDocumentId) {
        res.status(404).json({ error: 'The client has not shared the clause analysis for this request.' });
        return;
      }
      res.json(await loadClausesAndComments(request.id, request.sharedDocumentId));
    } catch {
      res.status(500).json({ error: 'Failed to load the clause review.' });
    }
  }

  static async lawyerComment(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Review not available.' }); return; }
    const parsed = clauseReviewSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const request = await prisma.consultationRequest.findFirst({ where: { id: req.params.id, lawyerProfile: { userId: req.user!.id } }, select: requestSelect });
      if (!request || request.lawyerProfile.status === 'SUSPENDED' || !canLawyerReviewAnalysis(request) || !request.sharedDocumentId) {
        res.status(404).json({ error: 'The client has not shared the clause analysis for this request.' });
        return;
      }
      const created = await addComment(request.id, request.sharedDocumentId, req.user!.id, 'LAWYER', parsed.data);
      if ('error' in created) { res.status(created.status).json({ error: created.error }); return; }
      await NotificationService.notify({
        userId: request.userId, type: 'CLAUSE_REVIEW_COMMENT', title: 'Your lawyer reviewed a clause',
        body: `${request.lawyerProfile.professionalName} added feedback on your contract's clause analysis.`,
        link: `/documents/${request.sharedDocumentId}/clauses`,
      });
      res.status(201).json(await loadClausesAndComments(request.id, request.sharedDocumentId));
    } catch {
      res.status(500).json({ error: 'Failed to save the comment.' });
    }
  }

  // ─── User side (/api/consultations/:id/review) ───────────────────────────
  static async userGet(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Consultation request not found.' }); return; }
    try {
      const request = await prisma.consultationRequest.findFirst({ where: { id: req.params.id, userId: req.user!.id }, select: requestSelect });
      if (!request || !request.sharedDocumentId) { res.status(404).json({ error: 'No document is linked to this request.' }); return; }
      res.json({ ...(await loadClausesAndComments(request.id, request.sharedDocumentId)), reviewOpen: canLawyerReviewAnalysis(request) });
    } catch {
      res.status(500).json({ error: 'Failed to load the clause review.' });
    }
  }

  static async userComment(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.id).success) { res.status(404).json({ error: 'Consultation request not found.' }); return; }
    const parsed = clauseReviewSchema.safeParse({ ...req.body, verdict: 'COMMENT' });
    if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }
    try {
      const request = await prisma.consultationRequest.findFirst({ where: { id: req.params.id, userId: req.user!.id }, select: requestSelect });
      if (!request || !request.sharedDocumentId) { res.status(404).json({ error: 'No document is linked to this request.' }); return; }
      if (!canLawyerReviewAnalysis(request)) { res.status(409).json({ error: 'The review is closed for this request.' }); return; }
      const created = await addComment(request.id, request.sharedDocumentId, req.user!.id, 'USER', { ...parsed.data, verdict: 'COMMENT', suggestedText: null });
      if ('error' in created) { res.status(created.status).json({ error: created.error }); return; }
      await NotificationService.notify({
        userId: request.lawyerProfile.userId, type: 'CLAUSE_REVIEW_REPLY', title: 'Client replied on a clause',
        body: 'Your client replied to your clause review.', link: '/connect/lawyer?tab=requests',
      });
      res.status(201).json(await loadClausesAndComments(request.id, request.sharedDocumentId));
    } catch {
      res.status(500).json({ error: 'Failed to save the reply.' });
    }
  }
}

async function addComment(
  consultationId: string, documentId: string, authorUserId: string, authorRole: 'LAWYER' | 'USER',
  data: { clauseFindingId: string; verdict: string; comment: string; suggestedText?: string | null },
): Promise<{ id: string } | { error: string; status: number }> {
  const clause = await prisma.clauseFinding.findFirst({ where: { id: data.clauseFindingId, documentId }, select: { id: true } });
  if (!clause) return { error: 'That clause does not belong to the shared document.', status: 400 };
  const count = await prisma.clauseReviewComment.count({ where: { consultationRequestId: consultationId } });
  if (count >= MAX_COMMENTS_PER_CONSULTATION) return { error: 'This review has reached its comment limit.', status: 409 };
  const created = await prisma.clauseReviewComment.create({
    data: {
      consultationRequestId: consultationId, clauseFindingId: clause.id, authorUserId, authorRole,
      verdict: data.verdict, comment: data.comment, suggestedText: data.suggestedText ?? null,
    },
    select: { id: true },
  });
  return created;
}
