import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client.js';
import { PdfService } from '../services/pdf-service.js';
import { AIAdapter } from '../services/ai/ai-adapter.js';
import { PaddleOcrService } from '../services/ocr/paddle-ocr.service.js';
import { PageOcrMetadata } from '../services/ocr/ocr.types.js';

export class DocumentController {
  /**
   * Upload and process a new PDF contract
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

      // 2. Extract Text from PDF with page-by-page detection and local PaddleOCR for scanned pages
      const extraction = await PdfService.extractText(file.path);
      const ocrMetaJson = JSON.stringify(extraction.ocrResult);
      const ocrStatus = extraction.ocrResult.hasLowConfidencePages
        ? 'PENDING_REVIEW'
        : extraction.ocrResult.scannedPagesCount > 0
        ? 'OCR_COMPLETED'
        : 'VERIFIED';

      // Check if scanned/empty and no text could be extracted (e.g. OCR credentials needed or unreadable image)
      if (extraction.isScannedOrEmpty) {
        const docWithWarning = await prisma.document.update({
          where: { id: createdDoc.id },
          data: {
            status: 'COMPLETED',
            ocrStatus: 'PENDING_REVIEW',
            ocrMetadata: ocrMetaJson,
            pageCount: extraction.pageCount,
            extractedText: extraction.text,
            errorMessage: extraction.warningMessage,
          },
        });

        res.status(201).json({
          message: 'Document uploaded. Scanned / image-based pages detected.',
          document: {
            ...docWithWarning,
            warning: extraction.warningMessage,
            ocrResult: extraction.ocrResult,
          },
        });
        return;
      }

      // 3. Save Chunks
      if (extraction.chunks.length > 0) {
        await prisma.documentChunk.createMany({
          data: extraction.chunks.map((c) => ({
            documentId: createdDoc.id,
            chunkIndex: c.chunkIndex,
            pageNumber: c.pageNumber,
            content: c.content,
          })),
        });
      }

      // 4. Run AI / Rule Engine Extractions
      const [summary, clauses, completeness, obligations] = await Promise.all([
        AIAdapter.generateSummary(extraction.text, file.originalname),
        AIAdapter.analyzeClauses(extraction.text),
        AIAdapter.checkCompleteness(extraction.text, 'General Commercial Contract'),
        AIAdapter.extractObligations(extraction.text),
      ]);

      // 5. Persist Summary
      await prisma.contractSummary.create({
        data: {
          documentId: createdDoc.id,
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

      // 6. Persist Clause Findings
      if (clauses.length > 0) {
        await prisma.clauseFinding.createMany({
          data: clauses.map((c) => ({
            documentId: createdDoc.id,
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

      // 7. Persist Completeness Checks
      if (completeness.length > 0) {
        await prisma.completenessCheck.createMany({
          data: completeness.map((comp) => ({
            documentId: createdDoc.id,
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

      // 8. Persist Extracted Obligations
      if (obligations.length > 0) {
        await prisma.extractedObligation.createMany({
          data: obligations.map((ob) => ({
            documentId: createdDoc.id,
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

      // 9. Update Document status to COMPLETED (or PENDING_REVIEW if low confidence flags exist)
      const finalDoc = await prisma.document.update({
        where: { id: createdDoc.id },
        data: {
          status: 'COMPLETED',
          ocrStatus,
          ocrMetadata: ocrMetaJson,
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

      res.status(201).json({
        message: 'Contract uploaded and analyzed successfully.',
        document: {
          ...finalDoc,
          ocrResult: extraction.ocrResult,
        },
      });
    } catch (err: any) {
      console.error('Upload processing error:', err);
      if (createdDoc) {
        await prisma.document.update({
          where: { id: createdDoc.id },
          data: {
            status: 'FAILED',
            errorMessage: err.message || 'Unknown processing error',
          },
        });
      }
      res.status(500).json({
        error: `Document processing failed: ${err.message || 'Error parsing contract file'}`,
      });
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
          console.warn('Could not delete file from disk:', e);
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
      res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
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

      const freshSummary = await AIAdapter.generateSummary(doc.extractedText, doc.originalName);

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
        where: { id: clauseId },
        data: { reviewStatus },
      });

      res.json({ message: 'Clause review status updated.', clause: updated });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update clause review status.' });
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

      const updated = await prisma.completenessCheck.update({
        where: { id: checkId },
        data: { isReviewed: !!isReviewed },
      });

      res.json({ message: 'Completeness check updated.', check: updated });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update completeness review status.' });
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
        where: { id: obligationId },
        data: { reviewStatus },
      });

      res.json({ message: 'Obligation status updated.', obligation: updated });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update obligation status.' });
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

      res.json({ conversation });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve chat session.' });
    }
  }

  /**
   * Send Question to Chatbot
   */
  static async sendChatMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { question } = req.body;

      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        res.status(400).json({ error: 'Please enter a valid question.' });
        return;
      }

      let conversation = await prisma.chatConversation.findFirst({
        where: { documentId: id, userId },
      });

      if (!conversation) {
        conversation = await prisma.chatConversation.create({
          data: {
            documentId: id,
            userId,
            title: `Chat: ${question.slice(0, 30)}...`,
          },
        });
      }

      // Record User Message
      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: question.trim(),
        },
      });

      // Fetch Document Chunks for Retrieval Grounding
      const chunks = await prisma.documentChunk.findMany({
        where: { documentId: id },
        orderBy: { chunkIndex: 'asc' },
      });

      // Get Grounded Answer
      const answerResult = await AIAdapter.answerQuestion(question, chunks);

      // Record Assistant Message with citations
      const assistantMsg = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: answerResult.answer,
          sourceCitations: JSON.stringify(answerResult.citations),
        },
      });

      res.json({
        message: assistantMsg,
        citations: answerResult.citations,
        isDocumentGrounded: answerResult.isDocumentGrounded,
        provider: answerResult.provider,
      });
    } catch (error: any) {
      console.error('Chat error:', error);
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
      console.error('getOcrPreview error:', error);
      res.status(500).json({ error: 'Failed to retrieve OCR preview.' });
    }
  }

  /**
   * Verify and update OCR text, then run/refresh AI analysis pipeline
   */
  static async verifyOcrAndAnalyze(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { pages } = req.body; // Array of { pageNumber: number, text: string }

      const doc = await prisma.document.findUnique({
        where: { id },
      });

      if (!doc) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        res.status(400).json({ error: 'Invalid payload: pages array is required.' });
        return;
      }

      // 1. Reconstruct fullText with page markers
      const fullText = pages
        .map((p: any) => `--- PAGE_${p.pageNumber} ---\n${(p.text || '').trim()}`)
        .join('\n\n');

      // 2. Re-chunk pages
      const newChunks = PdfService.chunkPages(pages);

      // 3. Update Document chunks
      await prisma.documentChunk.deleteMany({ where: { documentId: id } });
      if (newChunks.length > 0) {
        await prisma.documentChunk.createMany({
          data: newChunks.map((c) => ({
            documentId: id,
            chunkIndex: c.chunkIndex,
            pageNumber: c.pageNumber,
            content: c.content,
          })),
        });
      }

      // 4. Run AI legal analysis on verified text
      const [summary, clauses, completeness, obligations] = await Promise.all([
        AIAdapter.generateSummary(fullText, doc.originalName),
        AIAdapter.analyzeClauses(fullText),
        AIAdapter.checkCompleteness(fullText, 'General Commercial Contract'),
        AIAdapter.extractObligations(fullText),
      ]);

      // 5. Replace summary
      await prisma.contractSummary.deleteMany({ where: { documentId: id } });
      await prisma.contractSummary.create({
        data: {
          documentId: id,
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

      // 6. Replace clauses
      await prisma.clauseFinding.deleteMany({ where: { documentId: id } });
      if (clauses.length > 0) {
        await prisma.clauseFinding.createMany({
          data: clauses.map((c) => ({
            documentId: id,
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

      // 7. Replace completeness checks
      await prisma.completenessCheck.deleteMany({ where: { documentId: id } });
      if (completeness.length > 0) {
        await prisma.completenessCheck.createMany({
          data: completeness.map((comp) => ({
            documentId: id,
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

      // 8. Replace obligations
      await prisma.extractedObligation.deleteMany({ where: { documentId: id } });
      if (obligations.length > 0) {
        await prisma.extractedObligation.createMany({
          data: obligations.map((ob) => ({
            documentId: id,
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

      // 9. Update OCR metadata to mark verified
      let existingMeta: any = {};
      if (doc.ocrMetadata) {
        try { existingMeta = JSON.parse(doc.ocrMetadata); } catch (_) {}
      }
      existingMeta.isVerifiedByUser = true;
      existingMeta.hasLowConfidencePages = false;

      // Update page texts in metadata
      if (Array.isArray(existingMeta.pages)) {
        for (const p of pages) {
          const match = existingMeta.pages.find((m: any) => m.pageNumber === p.pageNumber);
          if (match) {
            match.text = p.text;
            match.flagged = false;
            match.hasLowConfidence = false;
          }
        }
      }

      const updatedDoc = await prisma.document.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          ocrStatus: 'VERIFIED',
          extractedText: fullText,
          errorMessage: null,
          ocrMetadata: JSON.stringify(existingMeta),
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

      res.json({
        message: 'Extracted text verified and legal intelligence scan completed successfully.',
        document: updatedDoc,
      });
    } catch (error: any) {
      console.error('verifyOcrAndAnalyze error:', error);
      res.status(500).json({ error: `Verification failed: ${error.message}` });
    }
  }

  /**
   * Re-run local PaddleOCR extraction on a document
   */
  static async reOcrDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({ where: { id } });

      if (!doc) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      if (!fs.existsSync(doc.filePath)) {
        res.status(400).json({ error: 'Source PDF file no longer exists on disk.' });
        return;
      }

      const extraction = await PdfService.extractText(doc.filePath);
      const ocrMetaJson = JSON.stringify(extraction.ocrResult);
      const ocrStatus = extraction.ocrResult.hasLowConfidencePages
        ? 'PENDING_REVIEW'
        : extraction.ocrResult.scannedPagesCount > 0
        ? 'OCR_COMPLETED'
        : 'VERIFIED';

      // Update chunks
      if (extraction.chunks.length > 0) {
        await prisma.documentChunk.deleteMany({ where: { documentId: id } });
        await prisma.documentChunk.createMany({
          data: extraction.chunks.map((c) => ({
            documentId: id,
            chunkIndex: c.chunkIndex,
            pageNumber: c.pageNumber,
            content: c.content,
          })),
        });
      }

      // If text exists, re-run analysis
      if (extraction.text && extraction.text.trim().length > 30) {
        const [summary, clauses, completeness, obligations] = await Promise.all([
          AIAdapter.generateSummary(extraction.text, doc.originalName),
          AIAdapter.analyzeClauses(extraction.text),
          AIAdapter.checkCompleteness(extraction.text, 'General Commercial Contract'),
          AIAdapter.extractObligations(extraction.text),
        ]);

        await prisma.contractSummary.deleteMany({ where: { documentId: id } });
        await prisma.contractSummary.create({
          data: {
            documentId: id,
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

        await prisma.clauseFinding.deleteMany({ where: { documentId: id } });
        if (clauses.length > 0) {
          await prisma.clauseFinding.createMany({
            data: clauses.map((c) => ({
              documentId: id,
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

        await prisma.completenessCheck.deleteMany({ where: { documentId: id } });
        if (completeness.length > 0) {
          await prisma.completenessCheck.createMany({
            data: completeness.map((comp) => ({
              documentId: id,
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

        await prisma.extractedObligation.deleteMany({ where: { documentId: id } });
        if (obligations.length > 0) {
          await prisma.extractedObligation.createMany({
            data: obligations.map((ob) => ({
              documentId: id,
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
      }

      const updated = await prisma.document.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          ocrStatus,
          ocrMetadata: ocrMetaJson,
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

      res.json({
        message: 'Document re-scanned with local PaddleOCR successfully.',
        document: {
          ...updated,
          ocrResult: extraction.ocrResult,
        },
      });
    } catch (error: any) {
      console.error('reOcrDocument error:', error);
      res.status(500).json({ error: `Re-OCR failed: ${error.message}` });
    }
  }
}
