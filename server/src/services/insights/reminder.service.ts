import prisma from '../../prisma/client.js';
import { NotificationService } from '../connect/notification.service.js';

const HOUR = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;

/** Today's date in India (reminder dates are calendar days chosen by Indian users). */
export function todayInIndia(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * HOUR).toISOString().slice(0, 10);
}

/**
 * Turns due obligation reminders into in-app notifications. Each reminder fires once
 * (notifiedAt is set atomically so two overlapping runs cannot notify twice).
 */
export async function processDueReminders(now = new Date()): Promise<number> {
  const due = await prisma.obligationReminder.findMany({
    where: { notifiedAt: null, remindOn: { lte: todayInIndia(now) } },
    include: { obligation: { select: { category: true, dueDateOrPeriod: true, documentId: true, document: { select: { originalName: true } } } } },
    take: 200,
  });
  let sent = 0;
  for (const r of due) {
    const claimed = await prisma.obligationReminder.updateMany({ where: { id: r.id, notifiedAt: null }, data: { notifiedAt: now } });
    if (claimed.count !== 1) continue;
    await NotificationService.notify({
      userId: r.userId,
      type: 'OBLIGATION_REMINDER',
      title: `Reminder: ${r.obligation.category}`,
      body: `${r.obligation.document.originalName}: ${r.obligation.dueDateOrPeriod || 'obligation'}${r.note ? ` — ${r.note}` : ''}`,
      link: `/documents/${r.obligation.documentId}/obligations`,
    });
    sent += 1;
  }
  return sent;
}

export function startReminderScheduler(): void {
  if (timer) return;
  const run = () => { processDueReminders().catch(() => console.warn('[Reminders] Run failed; will retry next hour.')); };
  setTimeout(run, 15000).unref();
  timer = setInterval(run, HOUR);
  timer.unref();
}
