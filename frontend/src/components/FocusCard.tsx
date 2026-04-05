type FocusGoal = {
  id: string;
  title: string;
  category: string;
  completedValue: number;
  targetValue: number;
  unit: string;
  completed: boolean;
};

type FocusCardProps = {
  goals: FocusGoal[];
  onGoToGoals?: () => void;
};

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mt-1.5 h-1 w-full rounded-full bg-slate-200">
      <div
        className="h-1 rounded-full bg-gradient-to-r from-sky-400 to-sky-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function FocusCard({ goals, onGoToGoals }: FocusCardProps) {
  if (goals.length === 0) return null;

  const displayed = goals.slice(0, 3);

  return (
    <div className="rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-50 to-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">🎯</span>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">
            Today's Focus
          </h3>
        </div>
        {onGoToGoals && (
          <button
            onClick={onGoToGoals}
            className="text-[11px] font-medium text-sky-500 hover:text-sky-700 transition-colors"
          >
            View all →
          </button>
        )}
      </div>

      <ul className="space-y-3">
        {displayed.map((goal) => {
          const remaining = Math.max(goal.targetValue - goal.completedValue, 0);
          const isDone = goal.completed;
          return (
            <li key={goal.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                  <span className={`text-sm font-medium truncate ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {goal.title}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {isDone ? 'done' : `${remaining} left`}
                </span>
              </div>
              <div className="pl-3.5">
                <ProgressBar value={goal.completedValue} max={goal.targetValue} />
              </div>
            </li>
          );
        })}
      </ul>

      {goals.length > 3 && (
        <p className="mt-3 text-[11px] text-slate-400">
          +{goals.length - 3} more goal{goals.length - 3 !== 1 ? 's' : ''} today
        </p>
      )}
    </div>
  );
}
