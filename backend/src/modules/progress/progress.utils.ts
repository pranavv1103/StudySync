type GoalInput = {
  targetDsaCount: number;
  targetJobAppsCount: number;
  targetSystemDesignCount: number;
};

type ProgressInput = {
  completedDsaCount: number;
  completedJobAppsCount: number;
  completedSystemDesignCount: number;
};

function ratio(completed: number, target: number): number {
  if (target <= 0) {
    return 0;
  }

  return Math.min(completed / target, 1);
}

export function calculateProgressSummary(goal: GoalInput, progress: ProgressInput) {
  const categories = [
    {
      key: 'dsa',
      target: goal.targetDsaCount,
      completed: progress.completedDsaCount,
      label: 'DSA problems',
    },
    {
      key: 'jobApps',
      target: goal.targetJobAppsCount,
      completed: progress.completedJobAppsCount,
      label: 'job applications',
    },
    {
      key: 'systemDesign',
      target: goal.targetSystemDesignCount,
      completed: progress.completedSystemDesignCount,
      label: 'system design topics',
    },
  ] as const;

  const activeCategories = categories.filter((category) => category.target > 0);

  const overallCompletionPercent =
    activeCategories.length === 0
      ? 0
      : Number(
          (
            (activeCategories.reduce(
              (sum, category) => sum + ratio(category.completed, category.target),
              0,
            ) /
              activeCategories.length) *
            100
          ).toFixed(2),
        );

  const remaining = {
    dsa: Math.max(goal.targetDsaCount - progress.completedDsaCount, 0),
    jobApps: Math.max(goal.targetJobAppsCount - progress.completedJobAppsCount, 0),
    systemDesign: Math.max(
      goal.targetSystemDesignCount - progress.completedSystemDesignCount,
      0,
    ),
  };

  const categoryCompletion = {
    dsa: goal.targetDsaCount > 0 ? Number((ratio(progress.completedDsaCount, goal.targetDsaCount) * 100).toFixed(2)) : 0,
    jobApps:
      goal.targetJobAppsCount > 0
        ? Number((ratio(progress.completedJobAppsCount, goal.targetJobAppsCount) * 100).toFixed(2))
        : 0,
    systemDesign:
      goal.targetSystemDesignCount > 0
        ? Number((ratio(progress.completedSystemDesignCount, goal.targetSystemDesignCount) * 100).toFixed(2))
        : 0,
  };

  return {
    overallCompletionPercent,
    remaining,
    categoryCompletion,
  };
}
