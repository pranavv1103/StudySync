import bcrypt from 'bcryptjs';
import { PrismaClient, WorkspaceType, WorkspaceRole, GoalUnit, GoalStatus } from '@prisma/client';

const prisma = new PrismaClient();

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

// Helper to get a date offset from today
function getDate(offsetDays: number): Date {
	const date = new Date(today);
	date.setDate(date.getDate() + offsetDays);
	return date;
}

async function seed(): Promise<void> {
	const [pranavPassword, partnerPassword] = await Promise.all([
		bcrypt.hash('pranav123', 10),
		bcrypt.hash('sneha123', 10),
	]);

	const [pranav, partner] = await Promise.all([
		prisma.user.upsert({
			where: { email: 'pranav.l1903@gmail.com' },
			update: { name: 'Pranav', password: pranavPassword, timezone: 'Asia/Kolkata' },
			create: {
				name: 'Pranav',
				email: 'pranav.l1903@gmail.com',
				password: pranavPassword,
				timezone: 'Asia/Kolkata',
			},
		}),
		prisma.user.upsert({
			where: { email: 'REMOVED' },
			update: { name: 'Sneha', password: partnerPassword, timezone: 'Asia/Kolkata' },
			create: {
				name: 'Sneha',
				email: 'REMOVED',
				password: partnerPassword,
				timezone: 'Asia/Kolkata',
			},
		}),
	]);

	const workspace = await prisma.workspace.upsert({
		where: { slug: 'pranav-sneha-accountability-circle' },
		update: {
			name: 'Pranav + Sneha Accountability Circle',
			type: WorkspaceType.PARTNER,
		},
		create: {
			name: 'Pranav + Sneha Accountability Circle',
			slug: 'pranav-sneha-accountability-circle',
			type: WorkspaceType.PARTNER,
		},
	});

	await Promise.all([
		prisma.membership.upsert({
			where: {
				userId_workspaceId: {
					userId: pranav.id,
					workspaceId: workspace.id,
				},
			},
			update: { role: WorkspaceRole.OWNER },
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				role: WorkspaceRole.OWNER,
			},
		}),
		prisma.membership.upsert({
			where: {
				userId_workspaceId: {
					userId: partner.id,
					workspaceId: workspace.id,
				},
			},
			update: { role: WorkspaceRole.MEMBER },
			create: {
				userId: partner.id,
				workspaceId: workspace.id,
				role: WorkspaceRole.MEMBER,
			},
		}),
	]);

	await Promise.all([
		prisma.userPreference.upsert({
			where: { userId: pranav.id },
			update: { workspaceId: workspace.id },
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
			},
		}),
		prisma.userPreference.upsert({
			where: { userId: partner.id },
			update: { workspaceId: workspace.id },
			create: {
				userId: partner.id,
				workspaceId: workspace.id,
			},
		}),
	]);

	await prisma.partnerRelation.upsert({
		where: {
			workspaceId_userAId_userBId: {
				workspaceId: workspace.id,
				userAId: pranav.id,
				userBId: partner.id,
			},
		},
		update: { isActive: true },
		create: {
			workspaceId: workspace.id,
			userAId: pranav.id,
			userBId: partner.id,
			isActive: true,
		},
	});

	// ===== CREATE GOAL TEMPLATES FOR EACH USER =====
	// Pranav's templates
	const pranavTemplates = await Promise.all([
		prisma.goalTemplate.upsert({
			where: { id: `template-pranav-dsa` },
			update: {},
			create: {
				id: `template-pranav-dsa`,
				userId: pranav.id,
				workspaceId: workspace.id,
				title: 'Heavy DSA Day',
				category: 'DSA',
				unit: GoalUnit.PROBLEMS,
				defaultTargetValue: 5,
				description: 'Focus on algorithms and data structures',
				active: true,
			},
		}),
		prisma.goalTemplate.upsert({
			where: { id: `template-pranav-jobs` },
			update: {},
			create: {
				id: `template-pranav-jobs`,
				userId: pranav.id,
				workspaceId: workspace.id,
				title: 'Job Application Day',
				category: 'Job Search',
				unit: GoalUnit.APPLICATIONS,
				defaultTargetValue: 3,
				description: 'Apply to multiple job opportunities',
				active: true,
			},
		}),
		prisma.goalTemplate.upsert({
			where: { id: `template-pranav-learning` },
			update: {},
			create: {
				id: `template-pranav-learning`,
				userId: pranav.id,
				workspaceId: workspace.id,
				title: 'Learning Day',
				category: 'Learning',
				unit: GoalUnit.TOPICS,
				defaultTargetValue: 2,
				description: 'Learn new concepts and topics',
				active: true,
			},
		}),
		prisma.goalTemplate.upsert({
			where: { id: `template-pranav-project` },
			update: {},
			create: {
				id: `template-pranav-project`,
				userId: pranav.id,
				workspaceId: workspace.id,
				title: 'Project Work Day',
				category: 'Project',
				unit: GoalUnit.HOURS,
				defaultTargetValue: 2,
				description: 'Work on coding projects',
				active: true,
			},
		}),
	]);

	// Partner's templates
	const partnerTemplates = await Promise.all([
		prisma.goalTemplate.upsert({
			where: { id: `template-partner-dsa` },
			update: {},
			create: {
				id: `template-partner-dsa`,
				userId: partner.id,
				workspaceId: workspace.id,
				title: 'DSA Practice',
				category: 'DSA',
				unit: GoalUnit.PROBLEMS,
				defaultTargetValue: 4,
				description: 'Daily DSA problem solving',
				active: true,
			},
		}),
		prisma.goalTemplate.upsert({
			where: { id: `template-partner-system-design` },
			update: {},
			create: {
				id: `template-partner-system-design`,
				userId: partner.id,
				workspaceId: workspace.id,
				title: 'System Design Study',
				category: 'System Design',
				unit: GoalUnit.VIDEOS,
				defaultTargetValue: 1,
				description: 'Learn system design concepts',
				active: true,
			},
		}),
	]);

	// ===== CREATE PLANNED GOALS FOR PRANAV =====
	// Today's goals for Pranav
	const pranavTodayGoals = await Promise.all([
		prisma.plannedGoal.upsert({
			where: { userId_workspaceId_date_title: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Solve 5 DSA problems'
			}},
			update: { status: GoalStatus.IN_PROGRESS },
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Solve 5 DSA problems',
				category: 'DSA',
				unit: GoalUnit.PROBLEMS,
				targetValue: 5,
				status: GoalStatus.IN_PROGRESS,
				sourceTemplateId: `template-pranav-dsa`,
			},
		}),
		prisma.plannedGoal.upsert({
			where: { userId_workspaceId_date_title: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Apply to 3 companies'
			}},
			update: { status: GoalStatus.IN_PROGRESS },
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Apply to 3 companies',
				category: 'Job Search',
				unit: GoalUnit.APPLICATIONS,
				targetValue: 3,
				status: GoalStatus.IN_PROGRESS,
				sourceTemplateId: `template-pranav-jobs`,
			},
		}),
		prisma.plannedGoal.upsert({
			where: { userId_workspaceId_date_title: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Review one LLD pattern'
			}},
			update: { status: GoalStatus.IN_PROGRESS },
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Review one LLD pattern',
				category: 'Learning',
				unit: GoalUnit.TASKS,
				targetValue: 1,
				status: GoalStatus.IN_PROGRESS,
				notes: 'Focus on Factory and Singleton patterns',
			},
		}),
	]);

	// Tomorrow's goals for Pranav (different from today)
	const pranavTomorrowGoals = await Promise.all([
		prisma.plannedGoal.upsert({
			where: { userId_workspaceId_date_title: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: getDate(1),
				title: 'Learn Kafka'
			}},
			update: {},
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: getDate(1),
				title: 'Learn Kafka',
				category: 'Learning',
				unit: GoalUnit.TOPICS,
				targetValue: 1,
				status: GoalStatus.NOT_STARTED,
				notes: 'Focus on producers and consumers',
			},
		}),
		prisma.plannedGoal.upsert({
			where: { userId_workspaceId_date_title: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: getDate(1),
				title: 'Work on Spring Boot project'
			}},
			update: {},
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: getDate(1),
				title: 'Work on Spring Boot project',
				category: 'Project',
				unit: GoalUnit.HOURS,
				targetValue: 3,
				status: GoalStatus.NOT_STARTED,
				sourceTemplateId: `template-pranav-project`,
			},
		}),
	]);

	// ===== CREATE PLANNED GOALS FOR PARTNER =====
	// Today's goals for Partner
	const partnerTodayGoals = await Promise.all([
		prisma.plannedGoal.upsert({
			where: { userId_workspaceId_date_title: {
				userId: partner.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Solve 4 DSA problems'
			}},
			update: { status: GoalStatus.IN_PROGRESS },
			create: {
				userId: partner.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Solve 4 DSA problems',
				category: 'DSA',
				unit: GoalUnit.PROBLEMS,
				targetValue: 4,
				status: GoalStatus.IN_PROGRESS,
				sourceTemplateId: `template-partner-dsa`,
			},
		}),
		prisma.plannedGoal.upsert({
			where: { userId_workspaceId_date_title: {
				userId: partner.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Watch System Design video'
			}},
			update: { status: GoalStatus.COMPLETED },
			create: {
				userId: partner.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Watch System Design video',
				category: 'System Design',
				unit: GoalUnit.VIDEOS,
				targetValue: 1,
				status: GoalStatus.COMPLETED,
				sourceTemplateId: `template-partner-system-design`,
			},
		}),
		prisma.plannedGoal.upsert({
			where: { userId_workspaceId_date_title: {
				userId: partner.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Mock interview prep'
			}},
			update: { status: GoalStatus.IN_PROGRESS },
			create: {
				userId: partner.id,
				workspaceId: workspace.id,
				date: today,
				title: 'Mock interview prep',
				category: 'Interview',
				unit: GoalUnit.SESSIONS,
				targetValue: 1,
				status: GoalStatus.IN_PROGRESS,
				notes: 'Behavioral round practice',
			},
		}),
	]);

	// ===== CREATE GOAL PROGRESS FOR TODAY =====
	// Pranav's today progress
	await Promise.all([
		prisma.goalProgress.upsert({
			where: { plannedGoalId: pranavTodayGoals[0].id },
			update: { completedValue: 1 },
			create: {
				plannedGoalId: pranavTodayGoals[0].id,
				userId: pranav.id,
				workspaceId: workspace.id,
				completedValue: 1,
				notes: 'Started with arrays, LeetCode 1-2',
			},
		}),
		prisma.goalProgress.upsert({
			where: { plannedGoalId: pranavTodayGoals[1].id },
			update: { completedValue: 2 },
			create: {
				plannedGoalId: pranavTodayGoals[1].id,
				userId: pranav.id,
				workspaceId: workspace.id,
				completedValue: 2,
				notes: 'Applied to Amazon backend and Google',
			},
		}),
		prisma.goalProgress.upsert({
			where: { plannedGoalId: pranavTodayGoals[2].id },
			update: { completedValue: 0 },
			create: {
				plannedGoalId: pranavTodayGoals[2].id,
				userId: pranav.id,
				workspaceId: workspace.id,
				completedValue: 0,
				notes: 'Not started yet, aiming for evening',
			},
		}),
	]);

	// Partner's today progress
	await Promise.all([
		prisma.goalProgress.upsert({
			where: { plannedGoalId: partnerTodayGoals[0].id },
			update: { completedValue: 1 },
			create: {
				plannedGoalId: partnerTodayGoals[0].id,
				userId: partner.id,
				workspaceId: workspace.id,
				completedValue: 1,
				notes: 'Completed arrays problems',
			},
		}),
		prisma.goalProgress.upsert({
			where: { plannedGoalId: partnerTodayGoals[1].id },
			update: { completedValue: 1, completed: true, completedAt: new Date() },
			create: {
				plannedGoalId: partnerTodayGoals[1].id,
				userId: partner.id,
				workspaceId: workspace.id,
				completedValue: 1,
				completed: true,
				completedAt: new Date(),
				notes: 'Watched ByteByteGo video on caching',
			},
		}),
		prisma.goalProgress.upsert({
			where: { plannedGoalId: partnerTodayGoals[2].id },
			update: { completedValue: 0 },
			create: {
				plannedGoalId: partnerTodayGoals[2].id,
				userId: partner.id,
				workspaceId: workspace.id,
				completedValue: 0,
				notes: 'Will do tomorrow morning',
			},
		}),
	]);

	// ===== UPDATE STREAK SUMMARIES =====
	await Promise.all([
		prisma.streakSummary.upsert({
			where: {
				userId_workspaceId: {
					userId: pranav.id,
					workspaceId: workspace.id,
				},
			},
			update: {
				currentStreakDays: 2,
				bestStreakDays: 4,
				lastCompletedDate: today,
			},
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				currentStreakDays: 2,
				bestStreakDays: 4,
				lastCompletedDate: today,
			},
		}),
		prisma.streakSummary.upsert({
			where: {
				userId_workspaceId: {
					userId: partner.id,
					workspaceId: workspace.id,
				},
			},
			update: {
				currentStreakDays: 3,
				bestStreakDays: 5,
				lastCompletedDate: today,
			},
			create: {
				userId: partner.id,
				workspaceId: workspace.id,
				currentStreakDays: 3,
				bestStreakDays: 5,
				lastCompletedDate: today,
			},
		}),
	]);

	// Also keep old DailyGoal/DailyProgress for backward compat
	await Promise.all([
		prisma.dailyGoal.upsert({
			where: {
				userId_workspaceId_date: {
					userId: pranav.id,
					workspaceId: workspace.id,
					date: today,
				},
			},
			update: {
				targetDsaCount: 5,
				targetJobAppsCount: 3,
				targetSystemDesignCount: 1,
				customGoalText: 'Review one low-level design concept',
			},
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: today,
				targetDsaCount: 5,
				targetJobAppsCount: 3,
				targetSystemDesignCount: 1,
				customGoalText: 'Review one low-level design concept',
			},
		}),
		prisma.dailyGoal.upsert({
			where: {
				userId_workspaceId_date: {
					userId: partner.id,
					workspaceId: workspace.id,
					date: today,
				},
			},
			update: {
				targetDsaCount: 4,
				targetJobAppsCount: 2,
				targetSystemDesignCount: 1,
				customGoalText: 'Review one behavioral interview story',
			},
			create: {
				userId: partner.id,
				workspaceId: workspace.id,
				date: today,
				targetDsaCount: 4,
				targetJobAppsCount: 2,
				targetSystemDesignCount: 1,
				customGoalText: 'Review one behavioral interview story',
			},
		}),
	]);

	await Promise.all([
		prisma.dailyProgress.upsert({
			where: {
				userId_workspaceId_date: {
					userId: pranav.id,
					workspaceId: workspace.id,
					date: today,
				},
			},
			update: {
				completedDsaCount: 1,
				completedJobAppsCount: 2,
				completedSystemDesignCount: 0,
				notes: 'Started with arrays and submitted to two backend roles.',
				overallCompletionPercent: 44.44,
			},
			create: {
				userId: pranav.id,
				workspaceId: workspace.id,
				date: today,
				completedDsaCount: 1,
				completedJobAppsCount: 2,
				completedSystemDesignCount: 0,
				notes: 'Started with arrays and submitted to two backend roles.',
				overallCompletionPercent: 44.44,
			},
		}),
		prisma.dailyProgress.upsert({
			where: {
				userId_workspaceId_date: {
					userId: partner.id,
					workspaceId: workspace.id,
					date: today,
				},
			},
			update: {
				completedDsaCount: 1,
				completedJobAppsCount: 1,
				completedSystemDesignCount: 1,
				notes: 'On track and likely to complete before evening.',
				overallCompletionPercent: 66.67,
			},
			create: {
				userId: partner.id,
				workspaceId: workspace.id,
				date: today,
				completedDsaCount: 1,
				completedJobAppsCount: 1,
				completedSystemDesignCount: 1,
				notes: 'On track and likely to complete before evening.',
				overallCompletionPercent: 66.67,
			},
		}),
	]);

	console.log('✅ Seed complete: New flexible goal system initialized.');
	console.log('  - Created goal templates for Pranav and Sneha');
	console.log('  - Seeded planned goals for today and tomorrow');
	console.log('  - Tracked goal progress');
	console.log('  - Maintained backward compatibility with old DailyGoal/DailyProgress');
}

seed()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
