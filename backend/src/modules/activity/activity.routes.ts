import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const activityRouter = Router();
activityRouter.use(requireAuth);

// Friendly labels for each action type
const ACTION_LABELS: Record<string, string> = {
  GOAL_CREATED: 'created a goal',
  GOAL_COMPLETED: 'completed a goal',
  CHEER_SENT: 'cheered their buddy',
  NUDGE_SENT: 'sent a nudge',
};

activityRouter.get('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));

  const events = await prisma.activityLog.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  const items = events.map((event: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: unknown;
    createdAt: Date;
    user: { id: string; name: string; avatarUrl: string | null } | null;
  }) => {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const label = ACTION_LABELS[event.action] ?? event.action.toLowerCase().replace(/_/g, ' ');
    const detail = typeof meta.title === 'string' ? meta.title : null;

    return {
      id: event.id,
      action: event.action,
      label,
      detail,
      entityType: event.entityType,
      entityId: event.entityId,
      actor: event.user ?? null,
      metadata: meta,
      createdAt: event.createdAt.toISOString(),
    };
  });

  res.json({ items });
});
