import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { runIndianLawChecks } from '../services/insights/indian-law-checks.js';
import { computeRiskScore } from '../services/insights/risk-score.js';
import { compareWithTemplate } from '../services/insights/template-compare.js';
import { buildIcs, parseExplicitDate, type CalendarEvent } from '../services/insights/ics.js';
import { TranslationService, TranslationUnavailableError } from '../services/insights/translation.service.js';

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Invalid date.');

/**
 * Per-document insight endpoints. Every route is mounted behind authenticateToken +
 * requireDocumentOwnership, so req.params.id is always a document the caller owns.
 */
export class InsightsController {
  /** Indian-law checks + overall risk score, computed from stored text and findings. */
  static async insights(req: Request, res: Response): Promise<void> {
    try {
      const documentId = req.params.id;
      const [doc, clauses, completeness] = await Promise.all([
        prisma.document.findUnique({ where: { id: documentId }, select: { extractedText: true, status: true } }),
        prisma.clauseFinding.findMany({ where: { documentId }, select: { category: true, title: true, riskLevel: true } }),
        prisma.completenessCheck.findMany({ where: { documentId }, select: { expectedSection: true, status: true } }),
      ]);
      if (!doc?.extractedText) {
        res.json({ analysed: false, compliance: null, riskScore: null, translationAvailable: TranslationService.isAvailable() });
        return;
      }
      const compliance = runIndianLawChecks(doc.extractedText);
      const riskScore = computeRiskScore({ clauses, completeness, compliance: compliance.findings });
      res.json({ analysed: true, compliance, riskScore, translationAvailable: TranslationService.isAvailable() });
    } catch {
      res.status(500).json({ error: 'Failed to compute document insights.' });
    }
  }

  static async compare(req: Request, res: Response): Promise<void> {
    const templateId = uuid.safeParse(req.query.templateId);
    if (!templateId.success) { res.status(400).json({ error: 'Choose a template to compare with.' }); return; }
    try {
      const [template, chunks, doc] = await Promise.all([
        prisma.documentTemplate.findUnique({ where: { id: templateId.data }, select: { id: true, title: true, templateText: true } }),
        prisma.documentChunk.findMany({ where: { documentId: req.params.id }, orderBy: { chunkIndex: 'asc' }, select: { pageNumber: true, content: true } }),
        prisma.document.findUnique({ where: { id: req.params.id }, select: { extractedText: true } }),
      ]);
      if (!template) { res.status(404).json({ error: 'Template not found.' }); return; }
      let source = chunks;
      if (!source.length && doc?.extractedText) {
        source = doc.extractedText.split(/---PAGE_(\d+)---/).reduce<Array<{ pageNumber: number; content: string }>>((acc, part, i, arr) => {
          if (i % 2 === 1) acc.push({ pageNumber: Number(part), content: arr[i + 1] || '' });
          return acc;
        }, []);
        if (!source.length) source = [{ pageNumber: 1, content: doc.extractedText }];
      }
      if (!source.length) { res.status(409).json({ error: 'This document has no extracted text yet. Finish processing it first.' }); return; }
      res.json({ template: { id: template.id, title: template.title }, ...compareWithTemplate(template.templateText, source) });
    } catch {
      res.status(500).json({ error: 'Comparison failed.' });
    }
  }

  /** Translates Legal Buddy's own explanation for this document (summary or one clause) into Hindi/Marathi. */
  static async translate(req: Request, res: Response): Promise<void> {
    const body = z.object({
      target: z.enum(['hi', 'mr']),
      kind: z.enum(['summary', 'clause']),
      clauseId: z.string().uuid().optional(),
    }).strict().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: 'Invalid translation request.' }); return; }
    try {
      let text = '';
      if (body.data.kind === 'summary') {
        const s = await prisma.contractSummary.findUnique({ where: { documentId: req.params.id } });
        if (!s) { res.status(404).json({ error: 'No summary to translate yet.' }); return; }
        text = [
          `Contract type: ${s.contractType}.`, `Parties: ${s.parties}.`, `Purpose: ${s.purpose}`,
          s.paymentTerms ? `Payment: ${s.paymentTerms}` : '', s.terminationConditions ? `Termination: ${s.terminationConditions}` : '',
          s.liabilityTerms ? `Liability: ${s.liabilityTerms}` : '', s.missingInfo ? `Missing or unclear: ${s.missingInfo}` : '',
        ].filter(Boolean).join('\n');
      } else {
        if (!body.data.clauseId) { res.status(400).json({ error: 'clauseId is required.' }); return; }
        const c = await prisma.clauseFinding.findFirst({ where: { id: body.data.clauseId, documentId: req.params.id } });
        if (!c) { res.status(404).json({ error: 'Clause not found.' }); return; }
        text = [`${c.title}.`, c.plainLanguageExplanation, c.potentialConcern ? `Possible concern: ${c.potentialConcern}` : '', c.reviewQuestion ? `Question to ask: ${c.reviewQuestion}` : '']
          .filter(Boolean).join('\n');
      }
      const result = await TranslationService.translate(text, body.data.target);
      res.json({ language: body.data.target, text: result.text, provider: result.provider, cached: result.cached, notice: 'Machine translation by the configured AI provider. Check important details against the English original.' });
    } catch (error) {
      if (error instanceof TranslationUnavailableError) { res.status(503).json({ error: error.message }); return; }
      res.status(500).json({ error: 'Translation failed.' });
    }
  }

  // ─── Obligation reminders & calendar ─────────────────────────────────────
  static async listReminders(req: Request, res: Response): Promise<void> {
    try {
      const reminders = await prisma.obligationReminder.findMany({
        where: { userId: req.user!.id, obligation: { documentId: req.params.id } },
        select: { id: true, obligationId: true, remindOn: true, note: true, notifiedAt: true },
      });
      res.json({ reminders: reminders.map(r => ({ ...r, notifiedAt: r.notifiedAt?.toISOString() ?? null })) });
    } catch {
      res.status(500).json({ error: 'Failed to load reminders.' });
    }
  }

  static async setReminder(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.obligationId).success) { res.status(404).json({ error: 'Obligation not found.' }); return; }
    const body = z.object({ remindOn: isoDate, note: z.string().trim().max(200).optional().nullable() }).strict().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: 'Choose a valid reminder date.' }); return; }
    try {
      const obligation = await prisma.extractedObligation.findFirst({ where: { id: req.params.obligationId, documentId: req.params.id }, select: { id: true } });
      if (!obligation) { res.status(404).json({ error: 'Obligation not found.' }); return; }
      const data = { remindOn: body.data.remindOn, note: body.data.note || null, notifiedAt: null };
      const reminder = await prisma.obligationReminder.upsert({
        where: { obligationId_userId: { obligationId: obligation.id, userId: req.user!.id } },
        create: { ...data, obligationId: obligation.id, userId: req.user!.id },
        update: data,
        select: { id: true, obligationId: true, remindOn: true, note: true },
      });
      res.json({ reminder, message: 'Reminder saved. You will get an in-app notification on that date.' });
    } catch {
      res.status(500).json({ error: 'Failed to save reminder.' });
    }
  }

  static async deleteReminder(req: Request, res: Response): Promise<void> {
    if (!uuid.safeParse(req.params.obligationId).success) { res.status(404).json({ error: 'Obligation not found.' }); return; }
    try {
      await prisma.obligationReminder.deleteMany({ where: { obligationId: req.params.obligationId, userId: req.user!.id, obligation: { documentId: req.params.id } } });
      res.json({ message: 'Reminder removed.' });
    } catch {
      res.status(500).json({ error: 'Failed to remove reminder.' });
    }
  }

  /** iCalendar export: obligations with an explicit date in the contract, plus the user's own reminders. */
  static async calendar(req: Request, res: Response): Promise<void> {
    try {
      const [doc, obligations] = await Promise.all([
        prisma.document.findUnique({ where: { id: req.params.id }, select: { originalName: true } }),
        prisma.extractedObligation.findMany({
          where: { documentId: req.params.id, reviewStatus: { not: 'DISMISSED' } },
          include: { reminders: { where: { userId: req.user!.id } } },
        }),
      ]);
      const name = doc?.originalName || 'Contract';
      const events: CalendarEvent[] = [];
      for (const o of obligations) {
        const date = o.isCalendarDate ? parseExplicitDate(o.dueDateOrPeriod) || parseExplicitDate(o.excerpt) : null;
        const description = `${o.description}\n\nFrom: ${name}${o.pageNumber ? `, page ${o.pageNumber}` : ''}. Generated by Legal Buddy — verify against the contract.`;
        if (date) events.push({ uid: `obligation-${o.id}`, date, summary: `${o.category}: ${name}`, description });
        for (const r of o.reminders) {
          events.push({ uid: `reminder-${r.id}`, date: r.remindOn, summary: `Reminder — ${o.category}: ${name}`, description: `${r.note ? `${r.note}\n\n` : ''}${description}` });
        }
      }
      const safe = name.replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'contract';
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}-obligations.ics"`);
      res.setHeader('X-Event-Count', String(events.length));
      res.send(buildIcs(`Legal Buddy — ${name}`, events));
    } catch {
      res.status(500).json({ error: 'Failed to build the calendar file.' });
    }
  }

  /** Lawyer feedback on this document's clauses, from the owner's own consultations only. */
  static async lawyerReviews(req: Request, res: Response): Promise<void> {
    try {
      const comments = await prisma.clauseReviewComment.findMany({
        where: { clauseFinding: { documentId: req.params.id }, consultationRequest: { userId: req.user!.id } },
        orderBy: { createdAt: 'asc' },
        include: { consultationRequest: { select: { id: true, lawyerProfile: { select: { id: true, professionalName: true } } } } },
      });
      res.json({
        comments: comments.map(c => ({
          id: c.id, clauseFindingId: c.clauseFindingId, authorRole: c.authorRole, verdict: c.verdict, comment: c.comment,
          suggestedText: c.suggestedText, createdAt: c.createdAt.toISOString(), consultationId: c.consultationRequest.id,
          lawyer: c.consultationRequest.lawyerProfile,
        })),
      });
    } catch {
      res.status(500).json({ error: 'Failed to load lawyer feedback.' });
    }
  }
}
