import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
}

/**
 * In-app notifications only. No email provider is configured in this project, so nothing
 * here claims an email was sent. Bodies must never contain the user's issue description,
 * contract text or contact details — they only point to the page where an authorised
 * viewer can read the details.
 */
export const NotificationService = {
  async notify(input: NotificationInput, db: Db = prisma): Promise<void> {
    await db.notification.create({
      data: { userId: input.userId, type: input.type, title: input.title.slice(0, 200), body: input.body.slice(0, 1000), link: input.link || null },
    });
  },

  async notifyAdmins(input: Omit<NotificationInput, 'userId'>, db: Db = prisma): Promise<void> {
    const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    if (!admins.length) return;
    await db.notification.createMany({
      data: admins.map(a => ({ userId: a.id, type: input.type, title: input.title.slice(0, 200), body: input.body.slice(0, 1000), link: input.link || null })),
    });
  },
};
