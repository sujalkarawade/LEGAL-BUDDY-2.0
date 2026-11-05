import express from 'express';
import { errorHandler } from './middleware/error-handler.js';
import prisma from './prisma/client.js';
import cors from 'cors';
import { PORT, CLIENT_URL } from './config/index.js';
import authRoutes from './routes/auth.routes.js';
import documentRoutes from './routes/document.routes.js';
import templateRoutes from './routes/template.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { lawyerRoutes, lawyerPortalRoutes, consultationRoutes, adminConnectRoutes, notificationRoutes, geoRoutes } from './routes/connect.routes.js';
import { EvaluationController } from './controllers/evaluation.controller.js';
import { authenticateToken } from './middleware/auth.js';
import { startReminderScheduler } from './services/insights/reminder.service.js';
import { PaddleOcrService } from './services/ocr/paddle-ocr.service.js';
import { LocalEmbeddingService } from './services/local-embedding.service.js';
import { loggerService } from './services/logger.service.js';
import logsRoutes from './routes/logs.routes.js';
import { getDashboardHtml } from './views/dashboard.html.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Capture HTTP activity in the real-time logs dashboard
app.use(loggerService.httpLoggerMiddleware());

// Interactive Dashboard & Log Stream UI
app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getDashboardHtml());
});
app.get('/logs', (_req, res) => res.redirect('/'));
app.get('/dashboard', (_req, res) => res.redirect('/'));

// Logs and Server Telemetry API
app.use(logsRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Legal Buddy API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api', templateRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Legal Buddy Connect
app.use('/api/lawyers', lawyerRoutes);
app.use('/api/lawyer-portal', lawyerPortalRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin/connect', adminConnectRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/geo', geoRoutes);

// Accuracy & Evaluation dashboard (saved evaluation results; signed-in users only)
app.get('/api/evaluations/summary', authenticateToken, EvaluationController.summary);

// Global Error Handler
app.use(errorHandler);

// Start Server
// Single-server worker recovery: persisted extraction remains available for a user retry.
await prisma.document.updateMany({ where: { status: 'PROCESSING' }, data: {
  status: 'FAILED', ragStatus: 'FAILED', errorMessage: 'Processing was interrupted by a server restart. Retry to resume from saved pages.',
} });
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`⚖️  LEGAL BUDDY SERVER STARTED SUCCESSFULLY`);
  console.log(`📡  Listening on: http://localhost:${PORT}`);
  console.log(`🔒  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁  Upload directory: ready`);
  console.log(`=======================================================`);

  // Warm up the local PaddleOCR worker in the background so the model loads
  // once at startup and the first document upload is not delayed by model load.
  PaddleOcrService.warmup();

  // Obligation reminders → in-app notifications (checked hourly).
  startReminderScheduler();
});

// Shut the OCR worker down cleanly on process exit.
const shutdownOcr = () => { PaddleOcrService.shutdown(); LocalEmbeddingService.shutdown(); };
process.on('SIGINT', () => {
  shutdownOcr();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdownOcr();
  process.exit(0);
});
process.on('exit', shutdownOcr);

export default app;
