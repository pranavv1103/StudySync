export type BadgeId =
  | 'FIRST_WIN'
  | 'THREE_DAY_STREAK'
  | 'SEVEN_DAY_STREAK'
  | 'PERFECT_DAY'
  | 'COMEBACK_DAY'
  | 'POWER_DUO';

export type Badge = {
  id: BadgeId;
  label: string;
  description: string;
  colorClass: string;
};

const BADGE_DEFS: Record<BadgeId, Badge> = {
  FIRST_WIN: {
    id: 'FIRST_WIN',
    label: 'First Win',
    description: 'Completed your first goal',
    colorClass: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  THREE_DAY_STREAK: {
    id: 'THREE_DAY_STREAK',
    label: '3-Day Streak',
    description: 'Active 3 days in a row',
    colorClass: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  SEVEN_DAY_STREAK: {
    id: 'SEVEN_DAY_STREAK',
    label: '7-Day Streak',
    description: 'Active 7 days in a row',
    colorClass: 'bg-orange-50 border-orange-200 text-orange-800',
  },
  PERFECT_DAY: {
    id: 'PERFECT_DAY',
    label: 'Perfect Day',
    description: 'Completed 100% of goals today',
    colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  COMEBACK_DAY: {
    id: 'COMEBACK_DAY',
    label: 'Comeback Day',
    description: 'Returned after missing a day',
    colorClass: 'bg-purple-50 border-purple-200 text-purple-800',
  },
  POWER_DUO: {
    id: 'POWER_DUO',
    label: 'Power Duo',
    description: 'Both partners hit 100% today',
    colorClass: 'bg-rose-50 border-rose-200 text-rose-800',
  },
};

type StreakInfo = {
  currentStreakDays: number;
  bestStreakDays: number;
} | null;

type MemberSummary = {
  totalGoals: number;
  completedGoals: number;
  completionPercentage: number;
  streak: StreakInfo;
};

export function computeBadges(self: MemberSummary, partner?: MemberSummary | null): Badge[] {
  const earned: Badge[] = [];
  const streak = self.streak;

  // First Win - first time ever completing at least 1 goal and streak best is 1
  if (self.completedGoals > 0 && streak && streak.bestStreakDays <= 1) {
    earned.push(BADGE_DEFS.FIRST_WIN);
  }

  // Perfect Day - 100% completion with at least 1 goal
  if (self.totalGoals > 0 && self.completionPercentage >= 100) {
    earned.push(BADGE_DEFS.PERFECT_DAY);
  }

  // Streak badges
  if (streak) {
    if (streak.currentStreakDays >= 7) {
      earned.push(BADGE_DEFS.SEVEN_DAY_STREAK);
    } else if (streak.currentStreakDays >= 3) {
      earned.push(BADGE_DEFS.THREE_DAY_STREAK);
    }

    // Comeback Day - streak reset to 1 but had a longer streak before
    if (streak.currentStreakDays === 1 && streak.bestStreakDays > 1) {
      earned.push(BADGE_DEFS.COMEBACK_DAY);
    }
  }

  // Power Duo - both partners at 100%
  if (
    partner &&
    self.totalGoals > 0 &&
    self.completionPercentage >= 100 &&
    partner.totalGoals > 0 &&
    partner.completionPercentage >= 100
  ) {
    earned.push(BADGE_DEFS.POWER_DUO);
  }

  return earned;
}
