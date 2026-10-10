import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticateToken, DashboardController.getStats);
router.get('/status', DashboardController.getSystemStatus);

export default router;
