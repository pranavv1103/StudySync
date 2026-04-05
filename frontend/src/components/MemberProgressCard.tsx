import { ProgressBar } from './ProgressBar';
import type { DynamicDailyGoalSummary } from '../lib/api';
import type { GoalFilter } from './DashboardGoalList';

type MemberProgress = {
  user: { id: string; name: string; email: string; avatarUrl?: string | null };
  role: string;
  summary: DynamicDailyGoalSummary;
};

type MemberProgressCardProps = {
  title: string;
  member: MemberProgress;
  tone: 'self' | 'partner';
  /** When provided the stat boxes become clickable filter triggers */
  activeFilter?: GoalFilter;
  onStatClick?: (filter: GoalFilter) => void;
  /** Cheer/nudge handlers - only shown when tone is 'partner' */
  onCheer?: () => void;
  onNudge?: () => void;
};

export function MemberProgressCard({ title, member, tone, activeFilter, onStatClick, onCheer, onNudge }: MemberProgressCardProps) {
  const overall = member.summary.completionPercentage;
  const interactive = !!onStatClick;

  const accent = tone === 'self' ? 'bg-sky-600' : 'bg-emerald-600';
  const badge = tone === 'self' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700';

  const topCategories = member.summary.groupedCategories.slice(0, 3);
  const pendingTitles = member.summary.remainingGoalTitles.slice(0, 3);

  function statBoxClass(filter: GoalFilter): string {
    const base = 'rounded-xl p-3 text-left w-full transition-all duration-150';
    if (!interactive) return `${base} bg-slate-50`;
    const selected = activeFilter === filter;
    if (filter === 'completed') {
      return `${base} ${selected ? 'bg-emerald-50 ring-2 ring-emerald-300 shadow-sm' : 'bg-slate-50 hover:bg-emerald-50/60 cursor-pointer active:scale-[0.98]'}`;
    }
    if (filter === 'pending') {
      return `${base} ${selected ? 'bg-sky-50 ring-2 ring-sky-300 shadow-sm' : 'bg-slate-50 hover:bg-sky-50/60 cursor-pointer active:scale-[0.98]'}`;
    }
    // 'all' — progress units
    return `${base} ${selected ? 'bg-violet-50 ring-2 ring-violet-300 shadow-sm' : 'bg-slate-50 hover:bg-violet-50/60 cursor-pointer active:scale-[0.98]'}`;
  }

  function handleStatClick(filter: GoalFilter) {
    if (!onStatClick) return;
    // Clicking the active filter resets to all
    onStatClick(activeFilter === filter ? 'all' : filter);
  }

  const StatBox = interactive ? 'button' : 'div';

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{member.user.name}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>
          {member.summary.streak?.currentStreakDays ?? 0} day streak
        </span>
      </div>

      {interactive && (
        <p className="mt-2 text-[11px] text-slate-400">Click a card to filter goals below</p>
      )}

      <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
        <StatBox
          className={statBoxClass('completed')}
          {...(interactive ? { onClick: () => handleStatClick('completed'), type: 'button', 'aria-pressed': activeFilter === 'completed' } : {})}
        >
          <p className={`text-xs uppercase tracking-wide ${activeFilter === 'completed' ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
            Goals Completed {activeFilter === 'completed' ? '↓' : ''}
          </p>
          <p className="mt-1 font-semibold">
            {member.summary.completedGoals} / {member.summary.totalGoals}
          </p>
        </StatBox>
        <StatBox
          className={statBoxClass('pending')}
          {...(interactive ? { onClick: () => handleStatClick('pending'), type: 'button', 'aria-pressed': activeFilter === 'pending' } : {})}
        >
          <p className={`text-xs uppercase tracking-wide ${activeFilter === 'pending' ? 'text-sky-600 font-bold' : 'text-slate-500'}`}>
            Pending Goals {activeFilter === 'pending' ? '↓' : ''}
          </p>
          <p className="mt-1 font-semibold">
            {member.summary.pendingGoals}
          </p>
        </StatBox>
        <StatBox
          className={statBoxClass('all')}
          {...(interactive ? { onClick: () => handleStatClick('all'), type: 'button', 'aria-pressed': activeFilter === 'all' } : {})}
        >
          <p className={`text-xs uppercase tracking-wide ${activeFilter === 'all' && interactive ? 'text-violet-600 font-bold' : 'text-slate-500'}`}>
            Progress Units {interactive ? '↓' : ''}
          </p>
          <p className="mt-1 font-semibold">
            {member.summary.completedTotal} / {member.summary.targetTotal}
          </p>
        </StatBox>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Overall Completion</span>
          <span className="font-bold text-slate-900">{overall.toFixed(2)}%</span>
        </div>
        <ProgressBar value={overall} colorClass={accent} />
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        {topCategories.map((group) => (
          <p key={group.category}>
            {group.category}: {group.completedTotal}/{group.targetTotal} ({group.completionPercentage.toFixed(2)}%)
          </p>
        ))}
      </div>

      {pendingTitles.length > 0 ? (
        <p className="mt-3 text-sm text-slate-600">Top pending: {pendingTitles.join(', ')}</p>
      ) : (
        <p className="mt-3 text-sm text-emerald-700">All goals completed for this date.</p>
      )}

      {tone === 'partner' && (onCheer || onNudge) && (
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          {onCheer && (
            <button
              type="button"
              onClick={onCheer}
              className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.97]"
            >
              Cheer
            </button>
          )}
          {onNudge && (
            <button
              type="button"
              onClick={onNudge}
              className="flex-1 rounded-lg border border-amber-200 bg-amber-50 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 active:scale-[0.97]"
            >
              Nudge
            </button>
          )}
        </div>
      )}
    </article>
  );
}
