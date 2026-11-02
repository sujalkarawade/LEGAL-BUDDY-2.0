import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import prisma from '../prisma/client.js';
import { OcrCacheService } from '../services/ocr/ocr-cache.service.js';
import { z } from 'zod';
import { PdfService, type PdfExtractionResult } from '../services/pdf-service.js';
import { LocalAnalysisService } from '../services/local-analysis.service.js';
import { PaddleOcrService } from '../services/ocr/paddle-ocr.service.js';
import { PageOcrMetadata } from '../services/ocr/ocr.types.js';
import { JobQueueService } from '../services/job-queue.service.js';
import { RagService, RetrievalError } from '../services/rag.service.js';
import { LocalEmbeddingService, validVector } from '../services/local-embedding.service.js';
import { isResourceOwner } from '../services/document-access.service.js';

const processingError = 'Processing failed. Review extraction output and local retrieval model configuration, then retry.';
const textHash = (text: string) => createHash('sha256').update(text).digest('hex');

async function persistIndexedChunks(documentId: string, chunks: Awaited<ReturnType<typeof PdfService.chunkPages>>): Promise<boolean> {
  const info = await LocalEmbeddingService.getInfo().catch(() => null);
  const existing = await prisma.documentChunk.findMany({ where: { documentId }, orderBy: { chunkIndex: 'asc' } });
  const unchanged = existing.length === chunks.length && chunks.every((chunk, index) => {
    const stored = existing[index];
    return stored?.chunkIndex === chunk.chunkIndex && stored.pageNumber === chunk.pageNumber &&
      stored.content === chunk.content && stored.extractionMethod === chunk.extractionMethod &&
      stored.clauseHeading === (chunk.clauseHeading || null);
  });
  const compatible = (stored: typeof existing[number]) => {
    if (!info || stored.embeddingModel !== info.signature) return false;
    try { return validVector(JSON.parse(stored.embedding || 'null'), info.dimensions); } catch { return false; }
  };
  if (unchanged && (!info || existing.every(compatible))) return Boolean(info);

  if (existing.length) await prisma.chatMessage.updateMany({ where: { conversation: { documentId } }, data: { sourceCitations: null } });
  const retainedIds: string[] = [];
  let anyEmbeddingReady = false;

  for (const chunk of chunks) {
    const cached = existing.find(stored => stored.content === chunk.content && stored.pageNumber === chunk.pageNumber && compatible(stored));
    let embedding: string | null = cached?.embedding || null;

    if (!embedding && info && chunk.content && chunk.content.trim().length > 0) {
      try {
        const textToEmbed = chunk.content.slice(0, 4500);
        const embRes = await LocalEmbeddingService.embed([textToEmbed]);
        if (embRes && embRes[0]) {
          embedding = JSON.stringify(embRes[0]);
          anyEmbeddingReady = true;
        }
      } catch (embErr) {
        // Fall back gracefully so keyword search still indexes this chunk
        embedding = null;
      }
    } else if (embedding) {
      anyEmbeddingReady = true;
    }

    const data = {
      documentId,
      ...chunk,
      clauseHeading: chunk.clauseHeading || null,
      embedding,
      embeddingModel: (embedding && info) ? info.signature : null,
    };
    const previous = existing.find(stored => stored.chunkIndex === chunk.chunkIndex);
    const stored = previous ? await prisma.documentChunk.update({ where: { id: previous.id }, data })
      : await prisma.documentChunk.create({ data });
    retainedIds.push(stored.id);
  }

  await prisma.$transaction([
    prisma.documentChunk.deleteMany({ where: { documentId, id: { notIn: retainedIds } } }),
  ]);
  return Boolean(info && anyEmbeddingReady);
}

export class DocumentController {
  /**
   * Internal asynchronous document processor for background and synchronous jobs
   */
  static async processDocumentAsync(
    documentId: string,
    filePath: string,
    originalName: string,
    jobId?: string,
    options?: { forcePageNumbers?: number[]; bypassCache?: boolean; preservedPages?: PageOcrMetadata[]; extraction?: PdfExtractionResult; previouslyCompleted?: boolean }
  ): Promise<any> {
    try {
      const previous = await prisma.document.findUniqueOrThrow({ where: { id: documentId }, include: { summary: { select: { id: true } } } });
      const previousMetadata = previous.ocrMetadata ? JSON.parse(previous.ocrMetadata) : {};
      const previousAnalysisHash: string | undefined = previousMetadata.analysisTextHash ||
        (previous.summary && (previous.status === 'COMPLETED' || options?.previouslyCompleted) && previous.extractedText
          ? textHash(previous.extractedText) : undefined);
      // Invalidate confirmed sources before extraction, including attempts that fail before indexing.
      await prisma.$transaction([
        prisma.document.update({ where: { id: documentId }, data: { status: 'PROCESSING', ragStatus: 'EXTRACTING', errorMessage: null } }),
        prisma.chatMessage.updateMany({ where: { conversation: { documentId } }, data: { sourceCitations: null } }),
      ]);
      if (jobId) {
        JobQueueService.updateProgress(jobId, 0, 1, 'Auditing document pages for selectable text and scans...');
      }

      // 1. Extract text with progress streaming
      const extraction = options?.extraction || await PdfService.extractText(
        filePath,
        (p) => {
          if (jobId) {
            JobQueueService.updateProgress(jobId, p.completedPages, p.totalPages, p.stage, {
              scannedPagesCount: p.scannedCount,
              selectablePagesCount: p.selectableCount,
            });
          }
        },
        options
      );

      // Persist extraction before shared local analysis so retries reuse successful pages.
      const contentHash = OcrCacheService.computeDocHash(filePath);
      await prisma.document.update({ where: { id: documentId }, data: {
        ocrMetadata: JSON.stringify({ ...extraction.ocrResult, analysisTextHash: previousAnalysisHash }), pageCount: extraction.pageCount,
        extractedText: extraction.text, contentHash,
      } });
      const incompletePages = extraction.ocrResult.pages.filter(p =>
        p.extractionType === 'failed' || (!p.text.trim() && p.extractionType !== 'verified_user'));
      const ocrMetaJson = JSON.stringify({ ...extraction.ocrResult, analysisTextHash: previousAnalysisHash });
      const ocrStatus = extraction.ocrResult.hasLowConfidencePages
        ? 'PENDING_REVIEW'
        : extraction.ocrResult.pages.every(p => p.extractionType === 'selectable' || p.extractionType === 'verified_user')
        ? 'VERIFIED'
        : extraction.ocrResult.scannedPagesCount > 0
        ? 'OCR_COMPLETED'
        : 'VERIFIED';

      // If document is empty / unreadable
      if (extraction.isScannedOrEmpty || extraction.chunks.length === 0 || incompletePages.length > 0) {
        const docWithWarning = await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'FAILED',
            ragStatus: 'REVIEW_REQUIRED',
            ocrStatus: 'PENDING_REVIEW',
            ocrMetadata: ocrMetaJson,
            pageCount: extraction.pageCount,
            extractedText: extraction.text,
            errorMessage: incompletePages.length ? `Pages ${incompletePages.map(p => p.pageNumber).join(', ')} need OCR retry or manual verification.` : 'No usable text was extracted; review OCR before using document chat.',
          },
        });

        if (jobId) {
          JobQueueService.failJob(jobId, docWithWarning.errorMessage!);
        }

        return {
          document: {
            ...docWithWarning,
            warning: extraction.warningMessage,
            ocrResult: extraction.ocrResult,
          },
        };
      }

      // 2. Index page-aware chunks; unchanged content and model vectors are reused.
      if (jobId) {
        JobQueueService.updateProgress(jobId, extraction.pageCount, extraction.pageCount, 'Indexing page-aware chunks for retrieval...');
      }
      await prisma.document.update({ where: { id: documentId }, data: { ragStatus: 'INDEXING' } });
      const semanticReady = await persistIndexedChunks(documentId, extraction.chunks);

      if (jobId) {
        JobQueueService.updateProgress(
          jobId,
          extraction.pageCount,
          extraction.pageCount,
          'Running AI legal intelligence analysis (clauses, summary, obligations)...'
        );
      }

      // Reindexing unchanged text must not reset counsel's existing review decisions.
      const analysisHash = textHash(extraction.text);
      const reuseAnalysis = Boolean(previous.summary && previousAnalysisHash === analysisHash);
      if (!reuseAnalysis) {
        // 3. Run AI / Rule Engine Extractions
        const [summary, clauses, completeness, obligations] = await Promise.all([
          LocalAnalysisService.generateSummary(extraction.text, originalName),
          LocalAnalysisService.analyzeClauses(extraction.text),
          LocalAnalysisService.checkCompleteness(extraction.text, 'General Commercial Contract'),
          LocalAnalysisService.extractObligations(extraction.text),
        ]);

        // Save all analyses and their input hash atomically; a failed stage remains retryable.
        await prisma.$transaction(async tx => {
          // 4. Upsert Summary
          await tx.contractSummary.upsert({
            where: { documentId },
            update: {
              contractType: summary.contractType,
              parties: summary.parties,
              purpose: summary.purpose,
              effectiveDate: summary.effectiveDate,
              endDate: summary.endDate,
              paymentTerms: summary.paymentTerms,
              responsibilities: summary.responsibilities,
              terminationConditions: summary.terminationConditions,
              confidentialityTerms: summary.confidentialityTerms,
              liabilityTerms: summary.liabilityTerms,
              renewalProvisions: summary.renewalProvisions,
              importantDeadlines: summary.importantDeadlines,
              missingInfo: summary.missingInfo,
              rawSummary: summary.rawSummary,
              analysisProvider: summary.analysisProvider,
            },
            create: {
              documentId,
              contractType: summary.contractType,
              parties: summary.parties,
              purpose: summary.purpose,
              effectiveDate: summary.effectiveDate,
              endDate: summary.endDate,
              paymentTerms: summary.paymentTerms,
              responsibilities: summary.responsibilities,
              terminationConditions: summary.terminationConditions,
              confidentialityTerms: summary.confidentialityTerms,
              liabilityTerms: summary.liabilityTerms,
              renewalProvisions: summary.renewalProvisions,
              importantDeadlines: summary.importantDeadlines,
              missingInfo: summary.missingInfo,
              rawSummary: summary.rawSummary,
              analysisProvider: summary.analysisProvider,
            },
          });

          // 5. Replace Clause Findings
          await tx.clauseFinding.deleteMany({ where: { documentId } });
          if (clauses.length > 0) {
            await tx.clauseFinding.createMany({
              data: clauses.map((c) => ({
                documentId,
                category: c.category,
                title: c.title,
                excerpt: c.excerpt,
                pageNumber: c.pageNumber || 1,
                plainLanguageExplanation: c.plainLanguageExplanation,
                riskLevel: c.riskLevel,
                potentialConcern: c.potentialConcern,
                reviewQuestion: c.reviewQuestion,
                reviewStatus: 'PENDING',
              })),
            });
          }

          // 6. Replace Completeness Checks
          await tx.completenessCheck.deleteMany({ where: { documentId } });
          if (completeness.length > 0) {
            await tx.completenessCheck.createMany({
              data: completeness.map((comp) => ({
                documentId,
                contractCategory: 'Commercial Contract',
                expectedSection: comp.expectedSection,
                detectedTitle: comp.detectedTitle,
                status: comp.status,
                excerpt: comp.excerpt,
                pageNumber: comp.pageNumber,
                reason: comp.reason,
                isReviewed: false,
              })),
            });
          }

          // 7. Replace Extracted Obligations
          await tx.extractedObligation.deleteMany({ where: { documentId } });
          if (obligations.length > 0) {
            await tx.extractedObligation.createMany({
              data: obligations.map((ob) => ({
                documentId,
                category: ob.category,
                description: ob.description,
                responsibleParty: ob.responsibleParty,
                dueDateOrPeriod: ob.dueDateOrPeriod,
                isCalendarDate: ob.isCalendarDate,
                excerpt: ob.excerpt,
                pageNumber: ob.pageNumber,
                confidence: ob.confidence,
                reviewStatus: 'UNREVIEWED',
              })),
            });
          }

          await tx.document.update({ where: { id: documentId }, data: {
            ocrMetadata: JSON.stringify({ ...extraction.ocrResult, analysisTextHash: analysisHash }),
          } });
        });
      }

      // 8. Update Document status to COMPLETED
      const finalDoc = await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          ragStatus: semanticReady ? 'READY' : 'KEYWORD_READY',
          ocrStatus,
          ocrMetadata: JSON.stringify({ ...extraction.ocrResult, analysisTextHash: analysisHash }),
          pageCount: extraction.pageCount,
          extractedText: extraction.text,
          errorMessage: extraction.warningMessage || null,
        },
        include: {
          summary: true,
          _count: {
            select: {
              clauses: true,
              completenessChecks: true,
              obligations: true,
            },
          },
        },
      });

      if (jobId) {
        JobQueueService.completeJob(jobId, {
          documentId,
          pageCount: extraction.pageCount,
          ocrStatus,
          hasLowConfidencePages: extraction.ocrResult.hasLowConfidencePages,
        });
      }

      return {
        document: {
          ...finalDoc,
          ocrResult: extraction.ocrResult,
        },
      };
    } catch (err: any) {
      console.error(`[DocumentController] Processing failed for doc ${documentId}.`);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          ragStatus: 'FAILED',
          errorMessage: processingError,
        },
      });
      if (jobId) {
        JobQueueService.failJob(jobId, processingError);
      }
      throw err;
    }
  }

  /**
   * Upload and process a new PDF contract (supports immediate async 202 response or ?sync=true)
   */
  static async uploadDocument(req: Request, res: Response): Promise<void> {
    const file = req.file;
    const userId = req.user?.id;

    if (!file) {
      res.status(400).json({ error: 'No PDF file uploaded. Please attach a valid .pdf document.' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    let createdDoc: any = null;

    try {
      // 1. Initial Document Record
      createdDoc = await prisma.document.create({
        data: {
          userId,
          originalName: file.originalname,
          storedName: file.filename,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          status: 'PROCESSING',
        },
      });

      // 2. Initialize Background Job
      const job = JobQueueService.createJob(createdDoc.id, userId);

      const isSync = req.query.sync === 'true';

      if (!isSync) {
        // Fast asynchronous response - background job executes without blocking HTTP client
        setImmediate(async () => {
          try {
            await DocumentController.processDocumentAsync(
              createdDoc.id,
              file.path,
              file.originalname,
              job.id
            );
          } catch (bgErr) {
            console.error('[DocumentController] Background upload processing failed.');
          }
        });

        res.status(202).json({
          message: 'Document uploaded successfully. Background legal intelligence scan started.',
          jobId: job.id,
          documentId: createdDoc.id,
          status: 'PROCESSING',
          progress: job.progress,
          document: createdDoc,
        });
        return;
      }

      // Synchronous execution path (for scripts and synchronous tests)
      const result = await DocumentController.processDocumentAsync(
        createdDoc.id,
        file.path,
        file.originalname,
        job.id
      );

      res.status(201).json({
        message: 'Contract uploaded and analyzed successfully.',
        document: result.document,
        jobId: job.id,
      });
    } catch (err: any) {
      console.error('Upload processing failed.');
      if (createdDoc) {
        await prisma.document.update({
          where: { id: createdDoc.id },
          data: {
            status: 'FAILED',
            ragStatus: 'FAILED',
            errorMessage: processingError,
          },
        });
      }
      res.status(500).json({
        error: processingError,
      });
    }
  }

  /**
   * Get Background Processing Job Status & Progress
   */
  static async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = JobQueueService.getJob(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found.' });
        return;
      }
      if (!isResourceOwner(job.userId, req.user?.id || '')) {
        res.status(404).json({ error: 'Job not found.' });
        return;
      }

      let document = null;
      if (job.status === 'COMPLETED' || job.status === 'PROCESSING') {
        document = await prisma.document.findUnique({
          where: { id: job.documentId },
          include: {
            summary: true,
            _count: {
              select: {
                clauses: true,
                completenessChecks: true,
                obligations: true,
              },
            },
          },
        });
      }

      res.json({
        jobId: job.id,
        documentId: job.documentId,
        status: job.status,
        progress: job.progress,
        error: job.error,
        completedAt: job.completedAt,
        document,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve job status.' });
    }
  }

  /**
   * Get all documents for the authenticated user
   */
  static async getDocuments(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const documents = await prisma.document.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          summary: {
            select: {
              contractType: true,
              effectiveDate: true,
              parties: true,
              analysisProvider: true,
            },
          },
          _count: {
            select: {
              clauses: true,
              completenessChecks: true,
              obligations: true,
            },
          },
        },
      });

      res.json({ documents });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch contracts.' });
    }
  }

  /**
   * Get single document by ID
   */
  static async getDocumentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const document = await prisma.document.findUnique({
        where: { id },
        include: {
          summary: true,
          clauses: { orderBy: { createdAt: 'asc' } },
          completenessChecks: { orderBy: { createdAt: 'asc' } },
          obligations: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!document) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      res.json({ document });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve document details.' });
    }
  }

  /**
   * Delete document and remove physical file
   */
  static async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({ where: { id } });

      if (doc && doc.filePath && fs.existsSync(doc.filePath)) {
        try {
          fs.unlinkSync(doc.filePath);
        } catch (e) {
          console.warn('Could not delete document file from disk.');
        }
      }

      await prisma.document.delete({ where: { id } });

      res.json({ message: 'Document and analysis records deleted successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete document.' });
    }
  }

  /**
   * Download original PDF with authorization
   */
  static async downloadDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({ where: { id } });

      if (!doc || !fs.existsSync(doc.filePath)) {
        res.status(404).json({ error: 'File not found on storage server.' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
      fs.createReadStream(doc.filePath).pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to stream document file.' });
    }
  }

  /**
   * Get Summary
   */
  static async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const summary = await prisma.contractSummary.findUnique({
        where: { documentId: id },
      });

      if (!summary) {
        res.status(404).json({ error: 'Summary not found for this document.' });
        return;
      }

      res.json({ summary });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve summary.' });
    }
  }

  /**
   * Re-analyze Summary
   */
  static async reanalyzeSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({ where: { id } });

      if (!doc || !doc.extractedText) {
        res.status(400).json({ error: 'Document text unavailable for analysis.' });
        return;
      }

      const freshSummary = await LocalAnalysisService.generateSummary(doc.extractedText, doc.originalName);

      const updated = await prisma.contractSummary.upsert({
        where: { documentId: id },
        update: {
          contractType: freshSummary.contractType,
          parties: freshSummary.parties,
          purpose: freshSummary.purpose,
          effectiveDate: freshSummary.effectiveDate,
          endDate: freshSummary.endDate,
          paymentTerms: freshSummary.paymentTerms,
          responsibilities: freshSummary.responsibilities,
          terminationConditions: freshSummary.terminationConditions,
          confidentialityTerms: freshSummary.confidentialityTerms,
          liabilityTerms: freshSummary.liabilityTerms,
          renewalProvisions: freshSummary.renewalProvisions,
          importantDeadlines: freshSummary.importantDeadlines,
          missingInfo: freshSummary.missingInfo,
          rawSummary: freshSummary.rawSummary,
          analysisProvider: freshSummary.analysisProvider,
        },
        create: {
          documentId: id,
          ...freshSummary,
        },
      });

      res.json({ message: 'Summary refreshed.', summary: updated });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to re-analyze contract summary.' });
    }
  }

  /**
   * Get Clauses
   */
  static async getClauses(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { category, risk } = req.query;

      const whereClause: any = { documentId: id };
      if (category && category !== 'ALL') {
        whereClause.category = category as string;
      }
      if (risk && risk !== 'ALL') {
        whereClause.riskLevel = risk as string;
      }

      const clauses = await prisma.clauseFinding.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
      });

      res.json({ clauses });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve clause findings.' });
    }
  }

  /**
   * Update Clause Review Status
   */
  static async updateClauseReview(req: Request, res: Response): Promise<void> {
    try {
      const { clauseId } = req.params;
      const { reviewStatus } = req.body;

      if (!['PENDING', 'APPROVED', 'FLAGGED'].includes(reviewStatus)) {
        res.status(400).json({ error: 'Invalid review status. Allowed: PENDING, APPROVED, FLAGGED.' });
        return;
      }

      const updated = await prisma.clauseFinding.update({
        where: { id: clauseId, documentId: req.params.id },
        data: { reviewStatus },
      });

      res.json({ message: 'Clause review status updated.', clause: updated });
    } catch (error: any) {
      res.status(error?.code === 'P2025' ? 404 : 500).json({ error: 'Failed to update clause review status.' });
    }
  }

  /**
   * Get Completeness Checks
   */
  static async getCompleteness(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const checks = await prisma.completenessCheck.findMany({
        where: { documentId: id },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ checks });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve completeness checks.' });
    }
  }

  /**
   * Toggle Completeness Item Reviewed
   */
  static async toggleCompletenessReview(req: Request, res: Response): Promise<void> {
    try {
      const { checkId } = req.params;
      const { isReviewed } = req.body;
      if (typeof isReviewed !== 'boolean') { res.status(400).json({ error: 'isReviewed must be boolean.' }); return; }

      const updated = await prisma.completenessCheck.update({
        where: { id: checkId, documentId: req.params.id },
        data: { isReviewed: !!isReviewed },
      });

      res.json({ message: 'Completeness check updated.', check: updated });
    } catch (error: any) {
      res.status(error?.code === 'P2025' ? 404 : 500).json({ error: 'Failed to update completeness review status.' });
    }
  }

  /**
   * Get Obligations
   */
  static async getObligations(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const obligations = await prisma.extractedObligation.findMany({
        where: { documentId: id },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ obligations });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve extracted obligations.' });
    }
  }

  /**
   * Update Obligation Review Status
   */
  static async updateObligationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { obligationId } = req.params;
      const { reviewStatus } = req.body;

      if (!['UNREVIEWED', 'ACKNOWLEDGED', 'DISMISSED'].includes(reviewStatus)) {
        res.status(400).json({ error: 'Invalid obligation status.' });
        return;
      }

      const updated = await prisma.extractedObligation.update({
        where: { id: obligationId, documentId: req.params.id },
        data: { reviewStatus },
      });

      res.json({ message: 'Obligation status updated.', obligation: updated });
    } catch (error: any) {
      res.status(error?.code === 'P2025' ? 404 : 500).json({ error: 'Failed to update obligation status.' });
    }
  }

  /**
   * Get Chat Conversation for Document
   */
  static async getChat(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      let conversation = await prisma.chatConversation.findFirst({
        where: { documentId: id, userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conversation) {
        conversation = await prisma.chatConversation.create({
          data: {
            documentId: id,
            userId,
            title: 'Contract Q&A Session',
          },
          include: { messages: true },
        });
      }

      const document = await prisma.document.findUnique({ where: { id }, select: { status: true, ragStatus: true } });
      if (!document || document.status !== 'COMPLETED' || !['READY', 'KEYWORD_READY'].includes(document.ragStatus)) {
        conversation.messages = conversation.messages.map(message => ({ ...message, sourceCitations: null }));
      }
      res.json({ conversation });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve chat session.' });
    }
  }

  /**
   * Send Question to Chatbot
   */
  static async sendChatMessage(req: Request, res: Response): Promise<void> {
    const requestStartedAt = performance.now();
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { question } = req.body;

      if (!question || typeof question !== 'string' || question.trim().length === 0 || question.length > 2000) {
        res.status(400).json({ error: 'Please enter a valid question.' });
        return;
      }

      const document = await prisma.document.findFirst({
        where: { id, userId, status: 'COMPLETED', ragStatus: { in: ['READY', 'KEYWORD_READY'] } },
        select: { id: true, originalName: true, ocrMetadata: true, updatedAt: true },
      });
      if (!document) {
        res.status(409).json({ error: 'This document is not ready for grounded chat yet.' });
        return;
      }

      let conversation = await prisma.chatConversation.findFirst({
        where: { documentId: id, userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10,
          },
        },
      });

      if (!conversation) {
        conversation = await prisma.chatConversation.create({
          data: {
            documentId: id,
            userId,
            title: `Chat: ${question.slice(0, 30)}...`,
          },
          include: { messages: true },
        });
      }

      // Build conversation history for context-aware follow-up answers
      const conversationHistory = (conversation.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Record User Message
      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: question.trim(),
        },
      });

      const retrievalStartedAt = performance.now();
      const retrieval = await RagService.searchAuthorized(question.trim(), { userId, documentIds: [id] });
      if (!retrieval.stats.candidateCount && !await prisma.documentChunk.count({ where: { documentId: id, document: { userId } } })) {
        res.status(409).json({ error: 'No usable text has been indexed for this document. Review OCR or retry processing.' });
        return;
      }

      const retrievalLatencyMs = Math.round(performance.now() - retrievalStartedAt);
      const evidence = retrieval.chunks;

      // Get Grounded Answer with conversation history for follow-up context
      const answerResult = await LocalAnalysisService.answerQuestion(question.trim(), evidence, conversationHistory, document.originalName);

      // Lock the document revision while saving: indexing invalidates old citations after this lock.
      const assistantMsg = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM documents WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
        const stillCurrent = await tx.document.findFirst({ where: { id, userId,
          updatedAt: document.updatedAt, status: 'COMPLETED', ragStatus: { in: ['READY', 'KEYWORD_READY'] } } });
        if (!stillCurrent) return null;
        return tx.chatMessage.create({ data: {
          conversationId: conversation.id, role: 'assistant', content: answerResult.answer,
          sourceCitations: JSON.stringify(answerResult.citations),
        } });
      });
      if (!assistantMsg) { res.status(409).json({ error: 'Document changed during this answer. Please retry.' }); return; }

      res.json({
        message: assistantMsg,
        citations: answerResult.citations,
        isDocumentGrounded: answerResult.isDocumentGrounded,
        provider: answerResult.provider,
        insufficientEvidence: answerResult.insufficientEvidence,
        retrievalMode: retrieval.stats.mode,
        retrieval: retrieval.stats,
        metrics: {
          retrievalLatencyMs,
          totalResponseTimeMs: Math.round(performance.now() - requestStartedAt),
        },
      });
    } catch (error: any) {
      if (error instanceof RetrievalError) { res.status(error.status).json({ error: error.message }); return; }
      console.error('Document chat failed.');
      res.status(500).json({ error: 'Failed to process question.' });
    }
  }

  /**
   * Clear Chat Conversation
   */
  static async clearChat(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const conversation = await prisma.chatConversation.findFirst({
        where: { documentId: id, userId },
      });

      if (conversation) {
        await prisma.chatMessage.deleteMany({
          where: { conversationId: conversation.id },
        });
      }

      res.json({ message: 'Conversation history reset.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to reset chat history.' });
    }
  }

  /**
   * Fetch OCR and text extraction preview for user verification
   */
  static async getOcrPreview(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({
        where: { id },
        include: {
          chunks: {
            orderBy: { chunkIndex: 'asc' },
          },
        },
      });

      if (!doc) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      let ocrMetadata = null;
      if (doc.ocrMetadata) {
        try {
          ocrMetadata = JSON.parse(doc.ocrMetadata);
        } catch (e) {
          console.warn('Failed to parse doc.ocrMetadata');
        }
      }

      // If ocrMetadata was not cached (e.g. legacy document), construct from chunks/text
      if (!ocrMetadata) {
        const pages: PageOcrMetadata[] = [];
        const pageGroups = new Map<number, string[]>();
        for (const chunk of doc.chunks) {
          if (!pageGroups.has(chunk.pageNumber)) {
            pageGroups.set(chunk.pageNumber, []);
          }
          pageGroups.get(chunk.pageNumber)!.push(chunk.content);
        }

        const totalPages = Math.max(doc.pageCount, pageGroups.size, 1);
        for (let p = 1; p <= totalPages; p++) {
          const pageText = (pageGroups.get(p) || []).join('\n\n') || '';
          const hasDevanagari = /[\u0900-\u097F]/.test(pageText);
          pages.push({
            pageNumber: p,
            isScanned: false,
            extractionType: 'selectable',
            text: pageText,
            wordCount: pageText.split(/\s+/).filter(Boolean).length,
            confidence: 1.0,
            skewAngle: 0,
            languages: hasDevanagari ? ['en', 'mr'] : ['en'],
            hasLowConfidence: false,
            uncertainWordCount: 0,
            flagged: false,
          });
        }

        ocrMetadata = {
          totalPages,
          scannedPagesCount: 0,
          selectablePagesCount: totalPages,
          overallConfidence: 1.0,
          detectedLanguages: ['en'],
          pages,
          fullText: doc.extractedText || '',
          hasLowConfidencePages: false,
          hasSkewedPages: false,
          ocrEngineUsed: 'selectable_direct',
          isConfigured: PaddleOcrService.isConfigured(),
        };
      }

      res.json({
        documentId: doc.id,
        originalName: doc.originalName,
        pageCount: doc.pageCount,
        status: doc.status,
        ocrStatus: doc.ocrStatus || 'NONE',
        errorMessage: doc.errorMessage,
        ocrMetadata,
      });
    } catch (error: any) {
      console.error('OCR preview retrieval failed.');
      res.status(500).json({ error: 'Failed to retrieve OCR preview.' });
    }
  }

  /**
   * Verify and update OCR text, then run/refresh AI analysis pipeline
   */
  static async verifyOcrAndAnalyze(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const payload = z.object({ pages: z.array(z.object({ pageNumber: z.number().int().positive(),
        text: z.string().max(200000) })).min(1).max(1000) }).safeParse(req.body);
      if (!payload.success) { res.status(400).json({ error: 'Provide valid page numbers and text.' }); return; }
      const doc = await prisma.document.findFirst({ where: { id, userId: req.user!.id } });
      if (!doc) { res.status(404).json({ error: 'Document not found.' }); return; }
      const updates = payload.data.pages;
      if (updates.some(p => p.pageNumber > doc.pageCount) || new Set(updates.map(p => p.pageNumber)).size !== updates.length) {
        res.status(400).json({ error: 'Page numbers must be unique and within the original PDF.' }); return;
      }
      const meta = doc.ocrMetadata ? JSON.parse(doc.ocrMetadata) : null;
      if (!meta?.pages) { res.status(409).json({ error: 'Extract the document before verifying its pages.' }); return; }
      const pages: PageOcrMetadata[] = meta.pages.map((page: PageOcrMetadata) => {
        const update = updates.find(p => p.pageNumber === page.pageNumber);
        return update ? { ...page, text: update.text, extractionType: 'verified_user',
          flagged: false, flaggedReason: undefined, hasLowConfidence: false, confidence: 1,
          wordCount: update.text.split(/\s+/).filter(Boolean).length } : page;
      });
      const text = pages.map(p => `--- PAGE_${p.pageNumber} ---\n${p.text}`).join('\n\n');
      const chunks = PdfService.chunkPages(pages);
      if (!chunks.length) { res.status(400).json({ error: 'At least one page must contain usable text.' }); return; }
      const claimed = await prisma.document.updateMany({ where: { id, updatedAt: doc.updatedAt, status: { not: 'PROCESSING' } },
        data: { status: 'PROCESSING', ragStatus: 'INDEXING' } });
      if (!claimed.count) { res.status(409).json({ error: 'Document processing is already running.' }); return; }
      const job = JobQueueService.createJob(id, doc.userId, doc.pageCount);
      const extraction: PdfExtractionResult = { text, chunks, pageCount: doc.pageCount, isScannedOrEmpty: false,
        ocrResult: { ...meta, pages, fullText: text, hasLowConfidencePages: pages.some(p => p.hasLowConfidence) } };
      setImmediate(() => { void DocumentController.processDocumentAsync(id, doc.filePath, doc.originalName, job.id, { extraction, previouslyCompleted: doc.status === 'COMPLETED' }).catch(() => {}); });
      res.status(202).json({ jobId: job.id, status: 'PROCESSING', document: doc });
    } catch {
      res.status(500).json({ error: 'Unable to verify and index the document.' });
    }
  }

  /**
   * Re-run local PaddleOCR extraction on a document (supports selective page re-processing and background jobs)
   */
  static async reOcrDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { pageNumbers, bypassCache } = req.body || {};
      const doc = await prisma.document.findUnique({ where: { id } });

      if (!doc) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      if (!fs.existsSync(doc.filePath)) {
        res.status(400).json({ error: 'Source PDF file no longer exists on disk.' });
        return;
      }

      const isSync = req.query.sync === 'true';

      if (pageNumbers !== undefined && (!Array.isArray(pageNumbers) || pageNumbers.length === 0)) {
        res.status(400).json({ error: 'pageNumbers must be a nonempty array.' }); return;
      }
      if (bypassCache !== undefined && typeof bypassCache !== 'boolean') {
        res.status(400).json({ error: 'bypassCache must be a boolean.' }); return;
      }
      const requestedPages: number[] | undefined = pageNumbers;
      if (requestedPages && requestedPages.some((page: unknown) => !Number.isInteger(page) || (page as number) < 1 || (page as number) > doc.pageCount)) {
        res.status(400).json({ error: 'pageNumbers must contain valid page numbers for this document.' });
        return;
      }
      if (requestedPages && new Set(requestedPages).size !== requestedPages.length) {
        res.status(400).json({ error: 'pageNumbers must not contain duplicates.' });
        return;
      }
      const claimed = await prisma.document.updateMany({ where: { id, updatedAt: doc.updatedAt, status: { not: 'PROCESSING' } }, data: { status: 'PROCESSING', ragStatus: 'EXTRACTING' } });
      if (!claimed.count) { res.status(409).json({ error: 'Document processing is already running.' }); return; }
      const job = JobQueueService.createJob(doc.id, doc.userId, doc.pageCount);
      let preservedPages: PageOcrMetadata[] = [];
      if (doc.ocrMetadata && doc.contentHash === OcrCacheService.computeDocHash(doc.filePath)) {
        try {
          const existing = JSON.parse(doc.ocrMetadata);
          preservedPages = (existing.pages || []).filter((page: PageOcrMetadata) => requestedPages ? !requestedPages.includes(page.pageNumber) : page.extractionType !== 'failed' && Boolean(page.text.trim() || page.extractionType === 'verified_user'));
        } catch { preservedPages = []; }
      }
      const runOpts = {
        previouslyCompleted: doc.status === 'COMPLETED',
        forcePageNumbers: requestedPages,
        preservedPages,
        bypassCache: bypassCache === true || Boolean(requestedPages),
      };

      if (!isSync) {
        setImmediate(async () => {
          try {
            await DocumentController.processDocumentAsync(
              doc.id,
              doc.filePath,
              doc.originalName,
              job.id,
              runOpts
            );
          } catch (e) {
            console.error('[DocumentController] Background reprocessing failed.');
          }
        });

        res.status(202).json({
          message: 'Document re-OCR queued in background.',
          jobId: job.id,
          documentId: doc.id,
          status: 'PROCESSING',
          progress: job.progress,
        });
        return;
      }

      const result = await DocumentController.processDocumentAsync(
        doc.id,
        doc.filePath,
        doc.originalName,
        job.id,
        runOpts
      );

      res.json({
        message: 'Document re-scanned with local PaddleOCR successfully.',
        document: result.document,
        jobId: job.id,
      });
    } catch (error: any) {
      console.error('Document reprocessing failed.');
      res.status(500).json({ error: processingError });
    }
  }
}
