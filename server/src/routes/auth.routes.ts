import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/register-lawyer', rateLimit({ name: 'register-lawyer', windowMs: 60 * 60 * 1000, max: 10 }), AuthController.registerLawyer);
router.get('/me', authenticateToken, AuthController.me);

export default router;
