import { Request, Response } from 'express';
import prisma from '../prisma/client.js';
import { AIAdapter } from '../services/ai/ai-adapter.js';

export class DashboardController {
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // 1. Documents counts
      const [
        totalDocs,
        completedDocs,
        totalClauses,
        highRiskClauses,
        pendingObligations,
        recentDocs,
        upcomingObligations,
        recentGeneratedDocs,
      ] = await Promise.all([
        prisma.document.count({ where: { userId } }),
        prisma.document.count({ where: { userId, status: 'COMPLETED' } }),
        prisma.clauseFinding.count({
          where: { document: { userId } },
        }),
        prisma.clauseFinding.count({
          where: {
            document: { userId },
            riskLevel: { in: ['High', 'Needs Review'] },
          },
        }),
        prisma.extractedObligation.count({
          where: {
            document: { userId },
            reviewStatus: 'UNREVIEWED',
          },
        }),
        prisma.document.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            summary: {
              select: {
                contractType: true,
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
        }),
        prisma.extractedObligation.findMany({
          where: {
            document: { userId },
            reviewStatus: { not: 'DISMISSED' },
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: {
            document: {
              select: {
                id: true,
                originalName: true,
              },
            },
          },
        }),
        prisma.generatedDocument.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
      ]);

      const aiStatus = AIAdapter.getProviderStatus();

      res.json({
        stats: {
          totalDocs,
          completedDocs,
          totalClauses,
          highRiskClauses,
          pendingObligations,
          totalDrafts: recentGeneratedDocs.length,
        },
        recentDocuments: recentDocs,
        upcomingObligations,
        recentGeneratedDocs,
        aiStatus,
      });
    } catch (error: any) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve dashboard statistics.' });
    }
  }

  static async getSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      // Test DB
      await prisma.$queryRaw`SELECT 1`;
      const aiStatus = AIAdapter.getProviderStatus();

      res.json({
        status: 'healthy',
        database: 'connected',
        aiStatus,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
      });
    }
  }
}
