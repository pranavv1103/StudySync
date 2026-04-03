import { Router } from 'express';
import { z } from 'zod';
import { parseDateToUtcStart } from '../../lib/date.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { getDailyGoalSummary, getPartnerGoalSummary } from '../plannedGoals/plannedGoals.service.js';
import { runReminderSweep } from './notification.service.js';

export const notificationsRouter = Router();

const markAllReadSchema = z.object({
  audience: z.enum(['SELF', 'PARTNER']).optional(),
});

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: auth.userId,
      workspaceId: auth.workspaceId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
  });

  const myAlerts = notifications.filter((item: { audience: string }) => item.audience === 'SELF');
  const partnerAlerts = notifications.filter(
    (item: { audience: string }) => item.audience === 'PARTNER',
  );

  const targetDateQuery = typeof req.query.date === 'string' ? req.query.date : null;
  let targetDate: Date;

  try {
    targetDate = targetDateQuery ? parseDateToUtcStart(targetDateQuery) : new Date();
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
    return;
  }

  targetDate.setUTCHours(0, 0, 0, 0);

  const [mySummary, partnerSummaries] = await Promise.all([
    getDailyGoalSummary(auth.userId, targetDate, auth.workspaceId),
    getPartnerGoalSummary(auth.userId, targetDate, auth.workspaceId),
  ]);

  res.json({
    myAlerts,
    partnerAlerts,
    dynamicContext: {
      date: targetDate.toISOString(),
      mySummary,
      partnerSummaries,
    },
  });
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const notification = await prisma.notification.updateMany({
    where: {
      id: req.params.id,
      recipientId: auth.userId,
      workspaceId: auth.workspaceId,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  if (notification.count === 0) {
    res.status(404).json({ message: 'Notification not found.' });
    return;
  }

  res.json({ message: 'Notification marked as read.' });
});

notificationsRouter.patch('/read-all', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const parsed = markAllReadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid mark-all payload.', errors: parsed.error.flatten() });
    return;
  }

  const updated = await prisma.notification.updateMany({
    where: {
      recipientId: auth.userId,
      workspaceId: auth.workspaceId,
      isRead: false,
      ...(parsed.data.audience ? { audience: parsed.data.audience } : {}),
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  res.json({
    message: 'Notifications marked as read.',
    count: updated.count,
  });
});

notificationsRouter.post('/run-reminders', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const trigger = req.body?.trigger === 'EVENING' ? 'EVENING' : 'MIDDAY';
  const result = await runReminderSweep(trigger);
  res.json(result);
});
