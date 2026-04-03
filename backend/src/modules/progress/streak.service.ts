import { prisma } from '../../lib/prisma.js';

type UpdateStreakInput = {
  userId: string;
  workspaceId: string;
  date: Date;
  overallCompletionPercent: number;
};

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function utcDayDiff(a: Date, b: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const aDay = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bDay = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((aDay - bDay) / oneDay);
}

export async function updateStreakForProgress(input: UpdateStreakInput) {
  const summary = await prisma.streakSummary.upsert({
    where: {
      userId_workspaceId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    },
    update: {},
    create: {
      userId: input.userId,
      workspaceId: input.workspaceId,
    },
  });

  if (input.overallCompletionPercent < 100) {
    return summary;
  }

  const currentDate = new Date(input.date);
  currentDate.setUTCHours(0, 0, 0, 0);

  if (summary.lastCompletedDate && isSameUtcDay(summary.lastCompletedDate, currentDate)) {
    return summary;
  }

  const dayGap = summary.lastCompletedDate ? utcDayDiff(currentDate, summary.lastCompletedDate) : null;

  const nextStreak = dayGap === 1 ? summary.currentStreakDays + 1 : 1;
  const nextBest = Math.max(summary.bestStreakDays, nextStreak);

  return prisma.streakSummary.update({
    where: {
      userId_workspaceId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    },
    data: {
      currentStreakDays: nextStreak,
      bestStreakDays: nextBest,
      lastCompletedDate: currentDate,
    },
  });
}
