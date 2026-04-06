import { prisma } from '../../lib/prisma.js';

type GoalWithProgressAndUser = {
  id: string;
  userId: string;
  date: Date;
  title: string;
  category: string;
  unit: string;
  targetValue: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  progress: Array<{
    completedValue: number;
    completed: boolean;
  }>;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export type DynamicGoalItem = {
  id: string;
  title: string;
  category: string;
  unit: string;
  targetValue: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  completedValue: number;
  completed: boolean;
  remainingValue: number;
  date: string;
};

export type DynamicCategorySummary = {
  category: string;
  goals: number;
  completedGoals: number;
  targetTotal: number;
  completedTotal: number;
  completionPercentage: number;
};

export type DynamicDailyGoalSummary = {
  userId: string;
  date: string;
  totalGoals: number;
  completedGoals: number;
  pendingGoals: number;
  completionPercentage: number;
  targetTotal: number;
  completedTotal: number;
  remainingGoalTitles: string[];
  groupedCategories: DynamicCategorySummary[];
  goals: DynamicGoalItem[];
  streak: {
    currentStreakDays: number;
    bestStreakDays: number;
    missedDayCount: number;
  } | null;
};

export type DynamicWorkspaceMemberSummary = {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  role: 'OWNER' | 'MEMBER';
  summary: DynamicDailyGoalSummary;
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcDayStart(date: Date): Date {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

function toUtcDayEndExclusive(date: Date): Date {
  const end = toUtcDayStart(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

function buildSummary(
  userId: string,
  date: Date,
  goals: GoalWithProgressAndUser[],
  streak: DynamicDailyGoalSummary['streak'],
): DynamicDailyGoalSummary {
  const mappedGoals: DynamicGoalItem[] = goals.map((goal: GoalWithProgressAndUser) => {
    const progress = goal.progress[0];
    const completedValue = Math.max(0, Math.min(progress?.completedValue ?? 0, goal.targetValue));
    const completed = Boolean(progress?.completed) || goal.status === 'COMPLETED' || completedValue >= goal.targetValue;

    return {
      id: goal.id,
      title: goal.title,
      category: goal.category,
      unit: goal.unit,
      targetValue: goal.targetValue,
      difficulty: goal.difficulty,
      completedValue,
      completed,
      remainingValue: Math.max(goal.targetValue - completedValue, 0),
      date: goal.date.toISOString(),
    };
  });

  const totalGoals = mappedGoals.length;
  const completedGoals = mappedGoals.filter((goal: DynamicGoalItem) => goal.completed).length;
  const pendingGoals = Math.max(totalGoals - completedGoals, 0);

  const targetTotal = mappedGoals.reduce((sum: number, goal: DynamicGoalItem) => sum + goal.targetValue, 0);
  const completedTotal = mappedGoals.reduce(
    (sum: number, goal: DynamicGoalItem) => sum + Math.min(goal.completedValue, goal.targetValue),
    0,
  );

  const completionPercentage =
    targetTotal > 0
      ? Number(((completedTotal / targetTotal) * 100).toFixed(2))
      : totalGoals > 0
        ? Number(((completedGoals / totalGoals) * 100).toFixed(2))
        : 0;

  const grouped = new Map<string, DynamicCategorySummary>();

  for (const goal of mappedGoals) {
    const current = grouped.get(goal.category) ?? {
      category: goal.category,
      goals: 0,
      completedGoals: 0,
      targetTotal: 0,
      completedTotal: 0,
      completionPercentage: 0,
    };

    current.goals += 1;
    current.completedGoals += goal.completed ? 1 : 0;
    current.targetTotal += goal.targetValue;
    current.completedTotal += Math.min(goal.completedValue, goal.targetValue);

    grouped.set(goal.category, current);
  }

  const groupedCategories = Array.from(grouped.values())
    .map((group: DynamicCategorySummary) => ({
      ...group,
      completionPercentage:
        group.targetTotal > 0
          ? Number(((group.completedTotal / group.targetTotal) * 100).toFixed(2))
          : group.goals > 0
            ? Number(((group.completedGoals / group.goals) * 100).toFixed(2))
            : 0,
    }))
    .sort((a: DynamicCategorySummary, b: DynamicCategorySummary) => b.targetTotal - a.targetTotal);

  const remainingGoalTitles = mappedGoals
    .filter((goal: DynamicGoalItem) => !goal.completed)
    .sort((a: DynamicGoalItem, b: DynamicGoalItem) => b.remainingValue - a.remainingValue)
    .slice(0, 5)
    .map((goal: DynamicGoalItem) => goal.title);

  return {
    userId,
    date: toDateKey(date),
    totalGoals,
    completedGoals,
    pendingGoals,
    completionPercentage,
    targetTotal,
    completedTotal,
    remainingGoalTitles,
    groupedCategories,
    goals: mappedGoals,
    streak,
  };
}

export async function getDailyGoalsForUser(userId: string, date: Date, workspaceId: string) {
  const dayStart = toUtcDayStart(date);
  const dayEnd = toUtcDayEndExclusive(dayStart);

  return prisma.plannedGoal.findMany({
    where: {
      workspaceId,
      userId,
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
    select: {
      id: true,
      userId: true,
      date: true,
      title: true,
      category: true,
      unit: true,
      targetValue: true,
      difficulty: true,
      status: true,
      progress: {
        select: {
          completedValue: true,
          completed: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  }) as Promise<GoalWithProgressAndUser[]>;
}

export async function getDailyGoalSummary(userId: string, date: Date, workspaceId: string) {
  const [goals, streak] = await Promise.all([
    getDailyGoalsForUser(userId, date, workspaceId),
    prisma.streakSummary.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      select: {
        currentStreakDays: true,
        bestStreakDays: true,
        missedDayCount: true,
      },
    }),
  ]);

  return buildSummary(userId, date, goals, streak ?? null);
}

export async function getPartnerGoalSummary(userId: string, date: Date, workspaceId: string) {
  const partners = await prisma.membership.findMany({
    where: {
      workspaceId,
      userId: { not: userId },
    },
    select: {
      userId: true,
    },
  });

  return Promise.all(
    partners.map((partner: { userId: string }) => getDailyGoalSummary(partner.userId, date, workspaceId)),
  );
}

export async function getDailyWorkspaceSummaries(workspaceId: string, date: Date) {
  const dayStart = toUtcDayStart(date);
  const dayEnd = toUtcDayEndExclusive(dayStart);

  const [memberships, goals, streaks] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    }),
    prisma.plannedGoal.findMany({
      where: {
        workspaceId,
        date: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      include: {
        progress: {
          select: {
            completedValue: true,
            completed: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
    prisma.streakSummary.findMany({
      where: { workspaceId },
      select: {
        userId: true,
        currentStreakDays: true,
        bestStreakDays: true,
        missedDayCount: true,
      },
    }),
  ]);

  const goalsByUser = new Map<string, GoalWithProgressAndUser[]>();
  for (const goal of goals as GoalWithProgressAndUser[]) {
    const list = goalsByUser.get(goal.userId) ?? [];
    list.push(goal);
    goalsByUser.set(goal.userId, list);
  }

  const streakByUser = new Map<string, DynamicDailyGoalSummary['streak']>();
  for (const streak of streaks) {
    streakByUser.set(streak.userId, {
      currentStreakDays: streak.currentStreakDays,
      bestStreakDays: streak.bestStreakDays,
      missedDayCount: streak.missedDayCount,
    });
  }

  return memberships.map((membership: {
    userId: string;
    role: 'OWNER' | 'MEMBER';
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }) => {
    const userGoals = goalsByUser.get(membership.userId) ?? [];
    const summary = buildSummary(
      membership.userId,
      dayStart,
      userGoals,
      streakByUser.get(membership.userId) ?? null,
    );

    return {
      user: membership.user,
      role: membership.role,
      summary,
    } as DynamicWorkspaceMemberSummary;
  });
}

export async function getAnalyticsSummary(
  userId: string,
  dateRange: { startDate: Date; endDate: Date },
  workspaceId: string,
) {
  const startDate = toUtcDayStart(dateRange.startDate);
  const endDate = toUtcDayStart(dateRange.endDate);
  const endExclusive = toUtcDayEndExclusive(endDate);

  const [memberships, goals, streak] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      select: { userId: true },
    }),
    prisma.plannedGoal.findMany({
      where: {
        workspaceId,
        date: {
          gte: startDate,
          lt: endExclusive,
        },
      },
      include: {
        progress: {
          select: {
            completedValue: true,
            completed: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    }),
    prisma.streakSummary.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      select: {
        currentStreakDays: true,
        bestStreakDays: true,
        missedDayCount: true,
      },
    }),
  ]);

  const memberIds = memberships.map((item: { userId: string }) => item.userId);
  const days: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const goalsByDateByUser = new Map<string, Map<string, GoalWithProgressAndUser[]>>();

  for (const goal of goals as GoalWithProgressAndUser[]) {
    const dateKey = toDateKey(goal.date);
    const byUser = goalsByDateByUser.get(dateKey) ?? new Map<string, GoalWithProgressAndUser[]>();
    const userGoals = byUser.get(goal.userId) ?? [];
    userGoals.push(goal);
    byUser.set(goal.userId, userGoals);
    goalsByDateByUser.set(dateKey, byUser);
  }

  const trend = days.map((date: Date) => {
    const dateKey = toDateKey(date);
    const byUser = goalsByDateByUser.get(dateKey) ?? new Map<string, GoalWithProgressAndUser[]>();

    const selfSummary = buildSummary(userId, date, byUser.get(userId) ?? [], null);

    const partnerSummaries = memberIds
      .filter((memberId: string) => memberId !== userId)
      .map((memberId: string) => buildSummary(memberId, date, byUser.get(memberId) ?? [], null));

    const partnerPercent =
      partnerSummaries.length > 0
        ? Number(
            (
              partnerSummaries.reduce(
                (sum: number, summary: DynamicDailyGoalSummary) => sum + summary.completionPercentage,
                0,
              ) / partnerSummaries.length
            ).toFixed(2),
          )
        : 0;

    return {
      date: dateKey,
      selfPercent: selfSummary.completionPercentage,
      partnerPercent,
      selfCompletedGoals: selfSummary.completedGoals,
      selfTotalGoals: selfSummary.totalGoals,
    };
  });

  const todaySummary = buildSummary(
    userId,
    endDate,
    goalsByDateByUser.get(toDateKey(endDate))?.get(userId) ?? [],
    streak ?? null,
  );

  const completionValues = trend.map((item) => item.selfPercent);
  const averageCompletion =
    completionValues.length > 0
      ? Number(
          (
            completionValues.reduce((sum: number, value: number) => sum + value, 0) /
            completionValues.length
          ).toFixed(2),
        )
      : 0;

  return {
    trend,
    summary: {
      date: toDateKey(endDate),
      todayPercent: todaySummary.completionPercentage,
      hasGoalToday: todaySummary.totalGoals > 0,
      completedGoalsToday: todaySummary.completedGoals,
      totalGoalsToday: todaySummary.totalGoals,
      averageCompletion,
      currentStreakDays: streak?.currentStreakDays ?? 0,
      bestStreakDays: streak?.bestStreakDays ?? 0,
      missedDayCount: streak?.missedDayCount ?? 0,
      remainingGoalTitles: todaySummary.remainingGoalTitles,
      groupedCategories: todaySummary.groupedCategories,
    },
  };
}
