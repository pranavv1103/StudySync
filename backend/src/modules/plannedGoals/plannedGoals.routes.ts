import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { emitWorkspaceEvent } from '../../lib/socket.js';
import { parseDateToUtcStart } from '../../lib/date.js';
import { z } from 'zod';
import { createDynamicGoalNotifications } from '../notifications/notification.service.js';

const goalUnitSchema = z.enum([
	'PROBLEMS',
	'JOBS',
	'TOPICS',
	'HOURS',
	'TASKS',
	'VIDEOS',
	'APPLICATIONS',
	'SESSIONS',
	'MINUTES',
	'ITEMS',
]);

const goalStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']);

const router = Router();

// Validation schemas
const createPlannedGoalSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
	title: z.string().min(1, 'Title is required').max(255),
	category: z.string().min(1, 'Category is required').max(100),
	unit: goalUnitSchema,
	targetValue: z.number().int().positive('Target must be positive'),
	difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
	sourceTemplateId: z.string().optional(),
	notes: z.string().optional(),
});

const updatePlannedGoalSchema = z.object({
	title: z.string().min(1).max(255).optional(),
	category: z.string().min(1).max(100).optional(),
	unit: goalUnitSchema.optional(),
	targetValue: z.number().int().positive().optional(),
	difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
	status: goalStatusSchema.optional(),
	notes: z.string().optional(),
});

const updateGoalProgressSchema = z.object({
	completedValue: z.number().int().nonnegative().optional(),
	completed: z.boolean().optional(),
	notes: z.string().optional(),
});

function deriveGoalStatus(completedValue: number, targetValue: number) {
	if (completedValue >= targetValue) return 'COMPLETED' as const;
	if (completedValue > 0) return 'IN_PROGRESS' as const;
	return 'NOT_STARTED' as const;
}

async function emitDynamicGoalUpdate(input: {
	workspaceId: string;
	userId: string;
	date: Date;
	action: 'created' | 'updated' | 'deleted' | 'progress-updated';
}) {
	const actor = await prisma.user.findUnique({
		where: { id: input.userId },
		select: { name: true },
	});

	if (!actor) {
		return;
	}

	await createDynamicGoalNotifications({
		workspaceId: input.workspaceId,
		actorUserId: input.userId,
		actorName: actor.name,
		date: input.date,
		trigger: 'MANUAL',
	});

	emitWorkspaceEvent(input.workspaceId, 'workspace:goal-updated', {
		workspaceId: input.workspaceId,
		userId: input.userId,
		date: input.date.toISOString(),
		action: input.action,
	});

	emitWorkspaceEvent(input.workspaceId, 'workspace:progress-updated', {
		workspaceId: input.workspaceId,
		userId: input.userId,
		date: input.date.toISOString(),
		action: input.action,
	});
}

// Create a new planned goal
router.post('/', requireAuth, async (req, res) => {
	try {
		const auth = req.auth;
		if (!auth) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		const parseResult = createPlannedGoalSchema.safeParse(req.body);
		if (!parseResult.success) {
			res.status(400).json({ message: 'Invalid payload', errors: parseResult.error.flatten() });
			return;
		}

		const data = parseResult.data;

		const plannedGoal = await prisma.plannedGoal.create({
			data: {
				userId: auth.userId,
				workspaceId: auth.workspaceId,
				date: parseDateToUtcStart(data.date),
				title: data.title,
				category: data.category,
				unit: data.unit,
				targetValue: data.targetValue,
				difficulty: data.difficulty ?? 'MEDIUM',
				sourceTemplateId: data.sourceTemplateId,
				notes: data.notes || null,
				status: 'NOT_STARTED',
			},
			include: { progress: true },
		});

		// Auto-create goal progress entry
		await prisma.goalProgress.upsert({
			where: { plannedGoalId: plannedGoal.id },
			update: {},
			create: {
				plannedGoalId: plannedGoal.id,
				userId: auth.userId,
				workspaceId: auth.workspaceId,
				completedValue: 0,
			},
		});

		res.status(201).json(plannedGoal);

		// Write activity log (best-effort, non-blocking)
		prisma.activityLog.create({
			data: {
				workspaceId: auth.workspaceId,
				userId: auth.userId,
				action: 'GOAL_CREATED',
				entityType: 'PLANNED_GOAL',
				entityId: plannedGoal.id,
				metadata: { title: plannedGoal.title, category: plannedGoal.category, targetValue: plannedGoal.targetValue },
			},
		}).catch(() => {});

		// Fire notifications after responding so failures never block the create response
		emitDynamicGoalUpdate({
			workspaceId: auth.workspaceId,
			userId: auth.userId,
			date: parseDateToUtcStart(data.date),
			action: 'created',
		}).catch((err: unknown) => {
			console.error('Failed to emit goal-created notifications (non-fatal):', err);
		});
	} catch (error) {
		if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
			res.status(409).json({ message: 'A goal with this title already exists for that date' });
			return;
		}

		console.error('Error creating planned goal:', error);
		res.status(500).json({ message: 'Failed to create planned goal' });
	}
});

// Get goals by date
router.get('/by-date/:date', requireAuth, async (req, res) => {
	try {
		const auth = req.auth;
		if (!auth) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		const { date } = req.params as { date: string };
		const targetDate = parseDateToUtcStart(date);

		const goals = await prisma.plannedGoal.findMany({
			where: {
				workspaceId: auth.workspaceId,
				date: {
					gte: targetDate,
					lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
				},
			},
			include: { progress: true, template: true },
			orderBy: { createdAt: 'asc' },
		});

		res.json(goals);
	} catch (error) {
		console.error('Error fetching goals by date:', error);
		res.status(500).json({ message: 'Failed to fetch goals' });
	}
});

// Get goals by week
router.get('/by-week/:startDate', requireAuth, async (req, res) => {
	try {
		const auth = req.auth;
		if (!auth) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		const { startDate } = req.params as { startDate: string };
		const weekStart = parseDateToUtcStart(startDate);
		const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

		const goals = await prisma.plannedGoal.findMany({
			where: {
				workspaceId: auth.workspaceId,
				date: {
					gte: weekStart,
					lt: weekEnd,
				},
			},
			include: { progress: true, template: true },
			orderBy: { date: 'asc' },
		});

		res.json(goals);
	} catch (error) {
		console.error('Error fetching goals by week:', error);
		res.status(500).json({ message: 'Failed to fetch weekly goals' });
	}
});

// Get all goals for a month
router.get('/by-month/:year/:month', requireAuth, async (req, res) => {
	try {
		const auth = req.auth;
		if (!auth) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		const { year, month } = req.params as { year: string; month: string };
		const monthStart = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
		const monthEnd = new Date(Date.UTC(parseInt(year), parseInt(month), 1));

		const goals = await prisma.plannedGoal.findMany({
			where: {
				workspaceId: auth.workspaceId,
				date: {
					gte: monthStart,
					lt: monthEnd,
				},
			},
			include: { progress: true, template: true },
			orderBy: { date: 'asc' },
		});

		res.json(goals);
	} catch (error) {
		console.error('Error fetching goals by month:', error);
		res.status(500).json({ message: 'Failed to fetch monthly goals' });
	}
});

// Update a planned goal
router.patch('/:goalId', requireAuth, async (req, res) => {
	try {
		const auth = req.auth;
		if (!auth) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		const { goalId } = req.params as { goalId: string };
		const parseResult = updatePlannedGoalSchema.safeParse(req.body);

		if (!parseResult.success) {
			res.status(400).json({ message: 'Invalid payload', errors: parseResult.error.flatten() });
			return;
		}

		// Verify ownership
		const goal = await prisma.plannedGoal.findUnique({
			where: { id: goalId },
		});

		if (!goal || goal.userId !== auth.userId || goal.workspaceId !== auth.workspaceId) {
			res.status(403).json({ message: 'Not authorized' });
			return;
		}

		const data = parseResult.data;
		const existingProgress = await prisma.goalProgress.findUnique({
			where: { plannedGoalId: goalId },
		});

		const nextTargetValue = data.targetValue ?? goal.targetValue;
		const currentCompletedValue = existingProgress?.completedValue ?? 0;
		const normalizedCompletedValue = Math.min(currentCompletedValue, nextTargetValue);

		const computedStatus =
			data.status === 'SKIPPED'
				? 'SKIPPED'
				: deriveGoalStatus(normalizedCompletedValue, nextTargetValue);

		const goalUpdateData: {
			title?: string;
			category?: string;
			unit?: (typeof data.unit);
			targetValue?: number;
			difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
			status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
			notes?: string;
		} = {
			status: computedStatus,
		};

		if (data.title !== undefined) goalUpdateData.title = data.title;
		if (data.category !== undefined) goalUpdateData.category = data.category;
		if (data.unit !== undefined) goalUpdateData.unit = data.unit;
		if (data.targetValue !== undefined) goalUpdateData.targetValue = data.targetValue;
		if (data.difficulty !== undefined) goalUpdateData.difficulty = data.difficulty;
		if (data.notes !== undefined) goalUpdateData.notes = data.notes;

		const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
			if (existingProgress) {
				await tx.goalProgress.update({
					where: { plannedGoalId: goalId },
					data: {
						completedValue: normalizedCompletedValue,
						completed: computedStatus === 'COMPLETED',
						completedAt: computedStatus === 'COMPLETED' ? existingProgress.completedAt ?? new Date() : null,
					},
				});
			}

			return tx.plannedGoal.update({
				where: { id: goalId },
				data: goalUpdateData,
				include: { progress: true },
			});
		});

		res.json(updated);

		// Fire notifications after responding so failures never block the update response
		emitDynamicGoalUpdate({
			workspaceId: auth.workspaceId,
			userId: auth.userId,
			date: goal.date,
			action: 'updated',
		}).catch((err: unknown) => {
			console.error('Failed to emit goal-updated notifications (non-fatal):', err);
		});
	} catch (error) {
		console.error('Error updating planned goal:', error);
		res.status(500).json({ message: 'Failed to update goal' });
	}
});

// Delete a planned goal
router.delete('/:goalId', requireAuth, async (req, res) => {
	try {
		const auth = req.auth;
		if (!auth) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		const { goalId } = req.params as { goalId: string };

		// Verify ownership
		const goal = await prisma.plannedGoal.findUnique({
			where: { id: goalId },
		});

		if (!goal || goal.userId !== auth.userId || goal.workspaceId !== auth.workspaceId) {
			res.status(403).json({ message: 'Not authorized' });
			return;
		}

		await prisma.plannedGoal.delete({
			where: { id: goalId },
		});

		res.status(204).send();

		// Fire notifications after responding so failures never block the delete response
		emitDynamicGoalUpdate({
			workspaceId: auth.workspaceId,
			userId: auth.userId,
			date: goal.date,
			action: 'deleted',
		}).catch((err: unknown) => {
			console.error('Failed to emit goal-deleted notifications (non-fatal):', err);
		});
	} catch (error) {
		console.error('Error deleting planned goal:', error);
		res.status(500).json({ message: 'Failed to delete goal' });
	}
});

// Update goal progress
router.patch('/:goalId/progress', requireAuth, async (req, res) => {
	try {
		const auth = req.auth;
		if (!auth) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		const { goalId } = req.params as { goalId: string };
		const parseResult = updateGoalProgressSchema.safeParse(req.body);

		if (!parseResult.success) {
			res.status(400).json({ message: 'Invalid payload', errors: parseResult.error.flatten() });
			return;
		}

		// Verify ownership
		const goal = await prisma.plannedGoal.findUnique({
			where: { id: goalId },
		});

		if (!goal || goal.userId !== auth.userId || goal.workspaceId !== auth.workspaceId) {
			res.status(403).json({ message: 'Not authorized' });
			return;
		}

		const data = parseResult.data;
		const existingProgress = await prisma.goalProgress.findUnique({
			where: { plannedGoalId: goalId },
		});

		const currentCompletedValue = existingProgress?.completedValue ?? 0;
		const nextCompletedValue =
			data.completed === true
				? goal.targetValue
				: data.completedValue !== undefined
					? Math.min(data.completedValue, goal.targetValue)
					: currentCompletedValue;

		const nextCompleted = data.completed === true || nextCompletedValue >= goal.targetValue;
		const nextStatus = deriveGoalStatus(nextCompletedValue, goal.targetValue);

		const progress = await prisma.goalProgress.upsert({
			where: { plannedGoalId: goalId },
			update: {
				completedValue: nextCompletedValue,
				completed: nextCompleted,
				completedAt: nextCompleted ? new Date() : null,
				notes: data.notes !== undefined ? data.notes : existingProgress?.notes,
			},
			create: {
				plannedGoalId: goalId,
				userId: auth.userId,
				workspaceId: auth.workspaceId,
				completedValue: nextCompletedValue,
				completed: nextCompleted,
				completedAt: nextCompleted ? new Date() : null,
				notes: data.notes,
			},
		});

		const plannedGoal = await prisma.plannedGoal.update({
			where: { id: goalId },
			data: { status: nextStatus },
			include: { progress: true },
		});

		res.json({ progress, plannedGoal });

		// Write activity log when goal is completed (best-effort, non-blocking)
		if (nextCompleted) {
			prisma.activityLog.create({
				data: {
					workspaceId: auth.workspaceId,
					userId: auth.userId,
					action: 'GOAL_COMPLETED',
					entityType: 'PLANNED_GOAL',
					entityId: goalId,
					metadata: { title: goal.title, category: goal.category },
				},
			}).catch(() => {});
		}

		// Fire notifications after responding so failures never block the progress response
		emitDynamicGoalUpdate({
			workspaceId: auth.workspaceId,
			userId: auth.userId,
			date: goal.date,
			action: 'progress-updated',
		}).catch((err: unknown) => {
			console.error('Failed to emit progress-updated notifications (non-fatal):', err);
		});
	} catch (error) {
		console.error('Error updating goal progress:', error);
		res.status(500).json({ message: 'Failed to update progress' });
	}
});

// Copy goals from one date to another
router.post('/copy', requireAuth, async (req, res) => {
	try {
		const auth = req.auth;
		if (!auth) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		const { sourceDate, targetDate } = req.body as { sourceDate: string; targetDate: string };

		if (!sourceDate || !targetDate) {
			res.status(400).json({ message: 'sourceDate and targetDate required' });
			return;
		}

		const sourceStart = parseDateToUtcStart(sourceDate);
		const sourceEnd = new Date(sourceStart.getTime() + 24 * 60 * 60 * 1000);

		// Get source goals
		const sourceGoals = await prisma.plannedGoal.findMany({
			where: {
				workspaceId: auth.workspaceId,
				userId: auth.userId,
				date: {
					gte: sourceStart,
					lt: sourceEnd,
				},
			},
		});

		if (sourceGoals.length === 0) {
			res.json({ copied: 0, goals: [] });
			return;
		}

		// Create goals on target date
		const targetDateParsed = parseDateToUtcStart(targetDate);

		const copiedGoals = await Promise.all(
			sourceGoals.map((goal: any) =>
				prisma.plannedGoal.create({
					data: {
						userId: auth.userId,
						workspaceId: auth.workspaceId,
						date: targetDateParsed,
						title: goal.title,
						category: goal.category,
						unit: goal.unit,
						targetValue: goal.targetValue,
						sourceTemplateId: goal.sourceTemplateId,
						notes: goal.notes,
						status: 'NOT_STARTED',
					},
				})
			)
		);

		// Record copy history
		await prisma.goalCopyHistory.create({
			data: {
				userId: auth.userId,
				workspaceId: auth.workspaceId,
				sourceDate: sourceStart,
				targetDate: targetDateParsed,
				goalCount: copiedGoals.length,
			},
		});

		res.status(201).json({
			copied: copiedGoals.length,
			goals: copiedGoals,
		});
	} catch (error) {
		console.error('Error copying goals:', error);
		res.status(500).json({ message: 'Failed to copy goals' });
	}
});

export const plannedGoalsRouter = router;
