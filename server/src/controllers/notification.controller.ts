import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { GeocodingService, GeocodingUnavailableError } from '../services/connect/geocoding.service.js';

export class NotificationController {
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
      ]);
      res.json({
        notifications: notifications.map(n => ({
          id: n.id, type: n.type, title: n.title, body: n.body, link: n.link,
          readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      });
    } catch {
      res.status(500).json({ error: 'Failed to load notifications.' });
    }
  }

  static async markRead(req: Request, res: Response): Promise<void> {
    if (!z.string().uuid().safeParse(req.params.id).success) { res.status(404).json({ error: 'Notification not found.' }); return; }
    try {
      const result = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
      res.json({ updated: result.count });
    } catch {
      res.status(500).json({ error: 'Failed to update notification.' });
    }
  }

  static async markAllRead(req: Request, res: Response): Promise<void> {
    try {
      const result = await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
      res.json({ updated: result.count });
    } catch {
      res.status(500).json({ error: 'Failed to update notifications.' });
    }
  }
}

export class GeoController {
  static status(_req: Request, res: Response): void {
    res.json({ geocodingEnabled: GeocodingService.isConfigured() });
  }

  static async search(req: Request, res: Response): Promise<void> {
    const q = z.string().trim().min(3, 'Enter at least 3 characters (city, locality or PIN code).').max(200).safeParse(req.query.q);
    if (!q.success) { res.status(400).json({ error: q.error.errors[0]?.message || 'Invalid search.' }); return; }
    try {
      const results = await GeocodingService.search(q.data);
      res.json({ results, attribution: 'Search results © OpenStreetMap contributors (ODbL)' });
    } catch (error) {
      if (error instanceof GeocodingUnavailableError) { res.status(503).json({ error: error.message }); return; }
      res.status(500).json({ error: 'Location search failed.' });
    }
  }
}
