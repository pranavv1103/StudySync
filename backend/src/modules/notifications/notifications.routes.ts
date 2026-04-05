import { Router } from 'express';
import { z } from 'zod';
import { parseDateToUtcStart } from '../../lib/date.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { emitUserEvent } from '../../lib/socket.js';
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

// Unread notification count (used by nav badge)
notificationsRouter.get('/unread-count', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const count = await prisma.notification.count({
    where: {
      recipientId: auth.userId,
      workspaceId: auth.workspaceId,
      isRead: false,
    },
  });

  res.json({ unread: count });
});

const cheerNudgeSchema = z.object({
  type: z.enum(['CHEER', 'NUDGE']),
});

// Send a cheer or nudge to accountability partner
notificationsRouter.post('/react', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const parsed = cheerNudgeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload.', errors: parsed.error.flatten() });
    return;
  }

  const { type } = parsed.data;

  // Find sender name
  const sender = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  if (!sender) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  // Find partner in the workspace
  const otherMembers = await prisma.membership.findMany({
    where: { workspaceId: auth.workspaceId, userId: { not: auth.userId } },
    select: { userId: true },
  });

  if (otherMembers.length === 0) {
    res.status(400).json({ message: 'No accountability buddy found in this workspace.' });
    return;
  }

  const title = type === 'CHEER' ? `${sender.name} cheered you on!` : `${sender.name} sent you a nudge`;
  const message =
    type === 'CHEER'
      ? `${sender.name} is cheering you on. Keep pushing - you have got this!`
      : `${sender.name} thinks you should get started on your goals. Now is a great time!`;

  const notifications = await Promise.all(
    otherMembers.map((m: { userId: string }) =>
      prisma.notification.create({
        data: {
          workspaceId: auth.workspaceId,
          recipientId: m.userId,
          actorUserId: auth.userId,
          audience: 'PARTNER',
          type,
          title,
          message,
          metadata: { senderName: sender.name, type },
        },
      }),
    ),
  );

  // Write activity log
  await prisma.activityLog.create({
    data: {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: type === 'CHEER' ? 'CHEER_SENT' : 'NUDGE_SENT',
      entityType: 'REACTION',
      metadata: { senderName: sender.name, recipientIds: otherMembers.map((m: { userId: string }) => m.userId) },
    },
  });

  // Emit real-time to each partner
  for (const notification of notifications) {
    emitUserEvent(notification.recipientId, 'notification:new', notification);
  }

  res.status(201).json({ message: `${type === 'CHEER' ? 'Cheer' : 'Nudge'} sent!`, count: notifications.length });
});
