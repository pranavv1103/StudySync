import { Router } from 'express';
import { parseDateToUtcStart } from '../../lib/date.js';
import { requireAuth } from '../../middleware/auth.js';
import { getDailyWorkspaceSummaries } from '../plannedGoals/plannedGoals.service.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const dateQuery = typeof req.query.date === 'string' ? req.query.date : null;

  const date = dateQuery ? parseDateToUtcStart(dateQuery) : new Date();
  date.setUTCHours(0, 0, 0, 0);

  const members = await getDailyWorkspaceSummaries(auth.workspaceId, date);

  res.json({
    date: date.toISOString(),
    workspaceId: auth.workspaceId,
    currentUserId: auth.userId,
    members,
  });
});
