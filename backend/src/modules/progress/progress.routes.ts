import { Router } from 'express';
import { z } from 'zod';
import { parseDateToUtcStart } from '../../lib/date.js';
import { prisma } from '../../lib/prisma.js';
import { emitWorkspaceEvent } from '../../lib/socket.js';
import { requireAuth } from '../../middleware/auth.js';
import { createProgressNotifications } from '../notifications/notification.service.js';
import { updateStreakForProgress } from './streak.service.js';
import { calculateProgressSummary } from './progress.utils.js';

const progressPayloadSchema = z.object({
  date: z.string(),
  completedDsaCount: z.number().int().min(0),
  completedJobAppsCount: z.number().int().min(0),
  completedSystemDesignCount: z.number().int().min(0),
  notes: z.string().max(800).optional().nullable(),
});

const quickUpdateSchema = z.object({
  date: z.string(),
  category: z.enum(['dsa', 'jobApps', 'systemDesign']),
});

export const progressRouter = Router();

progressRouter.use(requireAuth);

progressRouter.post('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const parseResult = progressPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: 'Invalid progress payload.', errors: parseResult.error.flatten() });
    return;
  }

  const payload = parseResult.data;

  let date: Date;
  try {
    date = parseDateToUtcStart(payload.date);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
    return;
  }

  const goal = await prisma.dailyGoal.findUnique({
    where: {
      userId_workspaceId_date: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        date,
      },
    },
  });

  if (!goal) {
    res.status(404).json({ message: 'Set a daily goal before updating progress.' });
    return;
  }

  const summary = calculateProgressSummary(goal, payload);

  const progress = await prisma.dailyProgress.upsert({
    where: {
      userId_workspaceId_date: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        date,
      },
    },
    update: {
      completedDsaCount: payload.completedDsaCount,
      completedJobAppsCount: payload.completedJobAppsCount,
      completedSystemDesignCount: payload.completedSystemDesignCount,
      notes: payload.notes ?? null,
      overallCompletionPercent: summary.overallCompletionPercent,
    },
    create: {
      date,
      userId: auth.userId,
      workspaceId: auth.workspaceId,
      completedDsaCount: payload.completedDsaCount,
      completedJobAppsCount: payload.completedJobAppsCount,
      completedSystemDesignCount: payload.completedSystemDesignCount,
      notes: payload.notes ?? null,
      overallCompletionPercent: summary.overallCompletionPercent,
    },
  });

  const actor = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  if (actor) {
    await updateStreakForProgress({
      userId: auth.userId,
      workspaceId: auth.workspaceId,
      date,
      overallCompletionPercent: summary.overallCompletionPercent,
    });

    await createProgressNotifications({
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      actorName: actor.name,
      overallPercent: summary.overallCompletionPercent,
      remaining: summary.remaining,
      completed: {
        dsa: payload.completedDsaCount,
        jobApps: payload.completedJobAppsCount,
        systemDesign: payload.completedSystemDesignCount,
      },
    });

    emitWorkspaceEvent(auth.workspaceId, 'workspace:progress-updated', {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      actorName: actor.name,
      summary,
      progress,
      date: payload.date,
    });
  }

  res.json({
    progress,
    summary,
  });
});

progressRouter.get('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const dateQuery = typeof req.query.date === 'string' ? req.query.date : null;
  if (!dateQuery) {
    res.status(400).json({ message: 'Query parameter date=YYYY-MM-DD is required.' });
    return;
  }

  const userIdQuery = typeof req.query.userId === 'string' ? req.query.userId : auth.userId;

  let date: Date;
  try {
    date = parseDateToUtcStart(dateQuery);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
    return;
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: userIdQuery,
        workspaceId: auth.workspaceId,
      },
    },
  });

  if (!membership) {
    res.status(403).json({ message: 'Requested user is not in your workspace.' });
    return;
  }

  const [goal, progress] = await Promise.all([
    prisma.dailyGoal.findUnique({
      where: {
        userId_workspaceId_date: {
          userId: userIdQuery,
          workspaceId: auth.workspaceId,
          date,
        },
      },
    }),
    prisma.dailyProgress.findUnique({
      where: {
        userId_workspaceId_date: {
          userId: userIdQuery,
          workspaceId: auth.workspaceId,
          date,
        },
      },
    }),
  ]);

  if (!goal) {
    res.status(404).json({ message: 'Daily goal not found for this date.' });
    return;
  }

  const summary = calculateProgressSummary(goal, {
    completedDsaCount: progress?.completedDsaCount ?? 0,
    completedJobAppsCount: progress?.completedJobAppsCount ?? 0,
    completedSystemDesignCount: progress?.completedSystemDesignCount ?? 0,
  });

  res.json({
    goal,
    progress,
    summary,
  });
});

progressRouter.post('/quick-update', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const parseResult = quickUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: 'Invalid quick update payload.', errors: parseResult.error.flatten() });
    return;
  }

  const payload = parseResult.data;

  let date: Date;
  try {
    date = parseDateToUtcStart(payload.date);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
    return;
  }

  const goal = await prisma.dailyGoal.findUnique({
    where: {
      userId_workspaceId_date: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        date,
      },
    },
  });

  if (!goal) {
    res.status(404).json({ message: 'Set a daily goal before progress updates.' });
    return;
  }

  const existingProgress =
    (await prisma.dailyProgress.findUnique({
      where: {
        userId_workspaceId_date: {
          userId: auth.userId,
          workspaceId: auth.workspaceId,
          date,
        },
      },
    })) ??
    (await prisma.dailyProgress.create({
      data: {
        date,
        userId: auth.userId,
        workspaceId: auth.workspaceId,
      },
    }));

  const nextValues = {
    completedDsaCount:
      payload.category === 'dsa'
        ? existingProgress.completedDsaCount + 1
        : existingProgress.completedDsaCount,
    completedJobAppsCount:
      payload.category === 'jobApps'
        ? existingProgress.completedJobAppsCount + 1
        : existingProgress.completedJobAppsCount,
    completedSystemDesignCount:
      payload.category === 'systemDesign'
        ? existingProgress.completedSystemDesignCount + 1
        : existingProgress.completedSystemDesignCount,
  };

  const summary = calculateProgressSummary(goal, nextValues);

  const progress = await prisma.dailyProgress.update({
    where: {
      userId_workspaceId_date: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        date,
      },
    },
    data: {
      ...nextValues,
      overallCompletionPercent: summary.overallCompletionPercent,
    },
  });

  const actor = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  if (actor) {
    await updateStreakForProgress({
      userId: auth.userId,
      workspaceId: auth.workspaceId,
      date,
      overallCompletionPercent: summary.overallCompletionPercent,
    });

    await createProgressNotifications({
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      actorName: actor.name,
      overallPercent: summary.overallCompletionPercent,
      remaining: summary.remaining,
      completed: {
        dsa: nextValues.completedDsaCount,
        jobApps: nextValues.completedJobAppsCount,
        systemDesign: nextValues.completedSystemDesignCount,
      },
    });

    emitWorkspaceEvent(auth.workspaceId, 'workspace:progress-updated', {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      actorName: actor.name,
      summary,
      progress,
      date: payload.date,
    });
  }

  res.json({
    progress,
    summary,
  });
});
