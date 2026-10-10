import { Router } from 'express';
import { TemplateController } from '../controllers/template.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Templates
router.get('/templates', authenticateToken, TemplateController.getTemplates);
router.get('/templates/:id', authenticateToken, TemplateController.getTemplateById);

// Generator
router.post('/document-generator/generate', authenticateToken, TemplateController.generateDocument);
router.get('/document-generator/history', authenticateToken, TemplateController.getHistory);
router.get('/document-generator/:id/download', authenticateToken, TemplateController.downloadDocx);

export default router;
