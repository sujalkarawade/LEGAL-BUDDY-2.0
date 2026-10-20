import express from 'express';
import { errorHandler } from './middleware/error-handler.js';
import prisma from './prisma/client.js';
import cors from 'cors';
import { PORT, CLIENT_URL } from './config/index.js';
import authRoutes from './routes/auth.routes.js';
import documentRoutes from './routes/document.routes.js';
import templateRoutes from './routes/template.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { PaddleOcrService } from './services/ocr/paddle-ocr.service.js';

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
});

// Shut the OCR worker down cleanly on process exit.
const shutdownOcr = () => PaddleOcrService.shutdown();
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
