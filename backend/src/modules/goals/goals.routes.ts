import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { parseDateToUtcStart } from '../../lib/date.js';
import { requireAuth } from '../../middleware/auth.js';

const goalPayloadSchema = z.object({
  date: z.string(),
  targetDsaCount: z.number().int().min(0),
  targetJobAppsCount: z.number().int().min(0),
  targetSystemDesignCount: z.number().int().min(0),
  customGoalText: z.string().max(300).optional().nullable(),
});

export const goalsRouter = Router();

goalsRouter.use(requireAuth);

goalsRouter.post('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const parseResult = goalPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: 'Invalid goal payload.', errors: parseResult.error.flatten() });
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

  const goal = await prisma.dailyGoal.upsert({
    where: {
      userId_workspaceId_date: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        date,
      },
    },
    update: {
      targetDsaCount: payload.targetDsaCount,
      targetJobAppsCount: payload.targetJobAppsCount,
      targetSystemDesignCount: payload.targetSystemDesignCount,
      customGoalText: payload.customGoalText ?? null,
    },
    create: {
      date,
      userId: auth.userId,
      workspaceId: auth.workspaceId,
      targetDsaCount: payload.targetDsaCount,
      targetJobAppsCount: payload.targetJobAppsCount,
      targetSystemDesignCount: payload.targetSystemDesignCount,
      customGoalText: payload.customGoalText ?? null,
    },
  });

  res.status(201).json({ goal });
});

goalsRouter.get('/', async (req, res) => {
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

  let date: Date;
  try {
    date = parseDateToUtcStart(dateQuery);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
    return;
  }

  const userIdQuery = typeof req.query.userId === 'string' ? req.query.userId : auth.userId;

  const isMember = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: userIdQuery,
        workspaceId: auth.workspaceId,
      },
    },
  });

  if (!isMember) {
    res.status(403).json({ message: 'Requested user is not in your workspace.' });
    return;
  }

  const goal = await prisma.dailyGoal.findUnique({
    where: {
      userId_workspaceId_date: {
        userId: userIdQuery,
        workspaceId: auth.workspaceId,
        date,
      },
    },
  });

  res.json({ goal });
});

goalsRouter.patch('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const partialSchema = goalPayloadSchema.partial().extend({
    date: z.string(),
  });

  const parseResult = partialSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: 'Invalid goal payload.', errors: parseResult.error.flatten() });
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

  const existingGoal = await prisma.dailyGoal.findUnique({
    where: {
      userId_workspaceId_date: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        date,
      },
    },
  });

  if (!existingGoal) {
    res.status(404).json({ message: 'Daily goal not found for this date.' });
    return;
  }

  const goal = await prisma.dailyGoal.update({
    where: {
      userId_workspaceId_date: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        date,
      },
    },
    data: {
      targetDsaCount: payload.targetDsaCount ?? existingGoal.targetDsaCount,
      targetJobAppsCount: payload.targetJobAppsCount ?? existingGoal.targetJobAppsCount,
      targetSystemDesignCount:
        payload.targetSystemDesignCount ?? existingGoal.targetSystemDesignCount,
      customGoalText:
        payload.customGoalText === undefined
          ? existingGoal.customGoalText
          : payload.customGoalText,
    },
  });

  res.json({ goal });
});
