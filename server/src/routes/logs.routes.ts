import { Router, Request, Response } from 'express';
import { loggerService, LogLevel } from '../services/logger.service.js';
import prisma from '../prisma/client.js';
import { AI_PROVIDER, OCR_LANG, OCR_PYTHON, PORT, RAG_SEARCH_MODE } from '../config/index.js';

const router = Router();

// REST logs endpoint
router.get('/api/logs', (req: Request, res: Response) => {
  const level = (req.query.level as string) || 'all';
  const module = (req.query.module as string) || 'all';
  const search = (req.query.search as string) || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500;

  const logs = loggerService.getLogs({ level, module, search, limit });
  const metrics = loggerService.getMetrics();

  res.json({
    success: true,
    data: {
      logs,
      metrics,
    },
  });
});

// Real-time SSE Stream
router.get('/api/logs/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const onLog = (logEntry: any) => {
    res.write(`data: ${JSON.stringify({ type: 'log', data: logEntry })}\n\n`);
  };

  loggerService.on('log', onLog);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    loggerService.off('log', onLog);
  });
});

// Clear logs
router.post('/api/logs/clear', (_req: Request, res: Response) => {
  loggerService.clearLogs();
  res.json({ success: true, message: 'Logs cleared successfully' });
});

// System & DB metrics
router.get('/api/logs/metrics', async (_req: Request, res: Response) => {
  let dbStatus = 'connected';
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch (err: any) {
    dbStatus = 'error: ' + (err.message || 'unknown');
  }

  const baseMetrics = loggerService.getMetrics();
  res.json({
    success: true,
    data: {
      ...baseMetrics,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        provider: 'postgresql',
      },
      services: {
        aiProvider: AI_PROVIDER,
        ocrLang: OCR_LANG,
        ocrPython: OCR_PYTHON,
        ragMode: RAG_SEARCH_MODE,
        port: PORT,
      },
    },
  });
});

// Test trigger log
router.post('/api/logs/test', (req: Request, res: Response) => {
  const { level = 'info', module = 'SYSTEM', message = 'Manual test log entry' } = req.body;
  const entry = loggerService.addLog(
    level as LogLevel,
    `[${module}] ${message}`,
    { triggeredBy: 'UI_Tester', ip: req.ip },
    module
  );
  res.json({ success: true, log: entry });
});

export default router;
