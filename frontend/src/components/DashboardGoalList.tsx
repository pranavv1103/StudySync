import { useEffect, useRef } from 'react';

export type GoalFilter = 'all' | 'completed' | 'pending';

type GoalEntry = {
  id: string;
  title: string;
  category: string;
  unit: string;
  targetValue: number;
  completedValue: number;
  completed: boolean;
  remainingValue: number;
};

type DashboardGoalListProps = {
  filter: GoalFilter;
  goals: GoalEntry[];
  onReset: () => void;
  /** When true the section scrolls into view */
  scrollIntoView?: boolean;
};

const FILTER_LABEL: Record<GoalFilter, string> = {
  all: 'All Goals',
  completed: 'Completed Goals',
  pending: 'Pending Goals',
};

const FILTER_EMPTY: Record<GoalFilter, string> = {
  all: 'No goals planned for this date.',
  completed: 'No completed goals yet for this date.',
  pending: 'No pending goals. Everything is done!',
};

function GoalRow({ goal }: { goal: GoalEntry }) {
  const pct = goal.targetValue > 0 ? Math.min((goal.completedValue / goal.targetValue) * 100, 100) : 0;

  return (
    <li className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* Status dot */}
          <span
            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
              goal.completed ? 'bg-emerald-400' : 'bg-sky-400'
            }`}
            aria-hidden="true"
          />
          <span
            className={`truncate text-sm font-medium ${
              goal.completed ? 'text-slate-400 line-through' : 'text-slate-800'
            }`}
          >
            {goal.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Category badge */}
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {goal.category}
          </span>
          {/* Progress fraction */}
          <span className="text-xs font-semibold text-slate-500">
            {goal.completedValue}/{goal.targetValue}
            <span className="ml-0.5 font-normal text-slate-400">{goal.unit.toLowerCase()}</span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="pl-4">
        <div className="h-1 w-full rounded-full bg-slate-200">
          <div
            className={`h-1 rounded-full transition-all duration-500 ${
              goal.completed
                ? 'bg-emerald-400'
                : pct >= 75
                ? 'bg-amber-400'
                : 'bg-sky-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </li>
  );
}

export function DashboardGoalList({ filter, goals, onReset, scrollIntoView }: DashboardGoalListProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Smooth scroll into view each time filter changes (if triggered by card click)
  useEffect(() => {
    if (scrollIntoView && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [filter, scrollIntoView]);

  const filtered = filter === 'all'
    ? goals
    : goals.filter((g) => (filter === 'completed' ? g.completed : !g.completed));

  const isFiltered = filter !== 'all';

  return (
    <div ref={ref} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            {isFiltered ? `Showing: ${FILTER_LABEL[filter]}` : 'All Goals'}
          </h3>
          {/* Count badge */}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              filter === 'completed'
                ? 'bg-emerald-100 text-emerald-700'
                : filter === 'pending'
                ? 'bg-sky-100 text-sky-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filtered.length}
          </span>
        </div>

        {/* Reset button — only show when filtered */}
        {isFiltered && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 active:scale-95"
          >
            <span aria-hidden="true">×</span> Show all
          </button>
        )}
      </div>

      {/* Goal list */}
      {filtered.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {filtered.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </ul>
      ) : (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            filter === 'completed'
              ? 'bg-slate-50 text-slate-500'
              : filter === 'pending'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-50 text-slate-500'
          }`}
        >
          {FILTER_EMPTY[filter]}
        </p>
      )}
    </div>
  );
}
