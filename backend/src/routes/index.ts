import { Router } from 'express';
import { activityRouter } from '../modules/activity/activity.routes.js';
import { analyticsRouter } from '../modules/analytics/analytics.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { goalsRouter } from '../modules/goals/goals.routes.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { plannedGoalsRouter } from '../modules/plannedGoals/plannedGoals.routes.js';
import { progressRouter } from '../modules/progress/progress.routes.js';
import { settingsRouter } from '../modules/settings/settings.routes.js';

export const apiRouter = Router();

apiRouter.use('/activity', activityRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/goals', goalsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/planned-goals', plannedGoalsRouter);
apiRouter.use('/progress', progressRouter);
apiRouter.use('/settings', settingsRouter);
