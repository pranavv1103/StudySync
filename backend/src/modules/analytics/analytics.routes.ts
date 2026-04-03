import { Router } from 'express';
import { parseDateToUtcStart } from '../../lib/date.js';
import { requireAuth } from '../../middleware/auth.js';
import { getAnalyticsSummary } from '../plannedGoals/plannedGoals.service.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const days = Math.max(3, Math.min(30, Number(req.query.days ?? 7)));

  const targetDateQuery = typeof req.query.date === 'string' ? req.query.date : null;
  const rangeEnd = targetDateQuery ? parseDateToUtcStart(targetDateQuery) : new Date();
  rangeEnd.setUTCHours(0, 0, 0, 0);

  const rangeStart = new Date(rangeEnd);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

  const analytics = await getAnalyticsSummary(
    auth.userId,
    {
      startDate: rangeStart,
      endDate: rangeEnd,
    },
    auth.workspaceId,
  );

  res.json(analytics);
});
