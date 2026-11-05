import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller.js';
import { authenticateToken, requireDocumentOwnership } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { LawyerController } from '../controllers/lawyer.controller.js';
import { InsightsController } from '../controllers/insights.controller.js';
import { rateLimit } from '../middleware/rate-limit.js';

const router = Router();

// Document creation and listing
router.post('/upload', authenticateToken, uploadMiddleware.single('file'), DocumentController.uploadDocument);
router.get('/', authenticateToken, DocumentController.getDocuments);
router.get('/jobs/:jobId', authenticateToken, DocumentController.getJobStatus);

// Document specific routes (with ownership check)
router.get('/:id', authenticateToken, requireDocumentOwnership, DocumentController.getDocumentById);
router.delete('/:id', authenticateToken, requireDocumentOwnership, DocumentController.deleteDocument);
router.get('/:id/download', authenticateToken, requireDocumentOwnership, DocumentController.downloadDocument);

// Summary
router.get('/:id/summary', authenticateToken, requireDocumentOwnership, DocumentController.getSummary);
router.post('/:id/summary/reanalyze', authenticateToken, requireDocumentOwnership, DocumentController.reanalyzeSummary);

// OCR Preview & Text Verification
router.get('/:id/ocr-preview', authenticateToken, requireDocumentOwnership, DocumentController.getOcrPreview);
router.post('/:id/ocr-preview/verify', authenticateToken, requireDocumentOwnership, DocumentController.verifyOcrAndAnalyze);
router.post('/:id/ocr-preview/re-ocr', authenticateToken, requireDocumentOwnership, DocumentController.reOcrDocument);

// Clauses
router.get('/:id/clauses', authenticateToken, requireDocumentOwnership, DocumentController.getClauses);
router.patch('/:id/clauses/:clauseId', authenticateToken, requireDocumentOwnership, DocumentController.updateClauseReview);

// Completeness
router.get('/:id/completeness', authenticateToken, requireDocumentOwnership, DocumentController.getCompleteness);
router.patch('/:id/completeness/:checkId', authenticateToken, requireDocumentOwnership, DocumentController.toggleCompletenessReview);

// Obligations
router.get('/:id/obligations', authenticateToken, requireDocumentOwnership, DocumentController.getObligations);
router.patch('/:id/obligations/:obligationId', authenticateToken, requireDocumentOwnership, DocumentController.updateObligationStatus);

// Legal Buddy Connect: practice-area suggestions from stored clause categories only (no contract text)
router.get('/:id/lawyer-match', authenticateToken, requireDocumentOwnership, LawyerController.matchForDocument);
router.get('/:id/lawyer-reviews', authenticateToken, requireDocumentOwnership, InsightsController.lawyerReviews);

// Insights: Indian-law checks + risk score, template comparison, translation, reminders & calendar
router.get('/:id/insights', authenticateToken, requireDocumentOwnership, InsightsController.insights);
router.get('/:id/compare', authenticateToken, requireDocumentOwnership, InsightsController.compare);
router.post('/:id/translate', authenticateToken, rateLimit({ name: 'translate', windowMs: 60 * 60 * 1000, max: 60 }), requireDocumentOwnership, InsightsController.translate);
router.get('/:id/obligations/calendar.ics', authenticateToken, requireDocumentOwnership, InsightsController.calendar);
router.get('/:id/obligations/reminders', authenticateToken, requireDocumentOwnership, InsightsController.listReminders);
router.put('/:id/obligations/:obligationId/reminder', authenticateToken, requireDocumentOwnership, InsightsController.setReminder);
router.delete('/:id/obligations/:obligationId/reminder', authenticateToken, requireDocumentOwnership, InsightsController.deleteReminder);

// Chatbot
router.get('/:id/chat', authenticateToken, requireDocumentOwnership, DocumentController.getChat);
router.post('/:id/chat', authenticateToken, requireDocumentOwnership, DocumentController.sendChatMessage);
router.delete('/:id/chat', authenticateToken, requireDocumentOwnership, DocumentController.clearChat);

export default router;
