import { ProgressBar } from './ProgressBar';
import type { DynamicDailyGoalSummary } from '../lib/api';

type MemberProgress = {
  user: { id: string; name: string; email: string; avatarUrl?: string | null };
  role: string;
  summary: DynamicDailyGoalSummary;
};

type MemberProgressCardProps = {
  title: string;
  member: MemberProgress;
  tone: 'self' | 'partner';
};

export function MemberProgressCard({ title, member, tone }: MemberProgressCardProps) {
  const overall = member.summary.completionPercentage;

  const accent = tone === 'self' ? 'bg-sky-600' : 'bg-emerald-600';
  const badge = tone === 'self' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700';

  const topCategories = member.summary.groupedCategories.slice(0, 3);
  const pendingTitles = member.summary.remainingGoalTitles.slice(0, 3);

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

      <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Goals Completed</p>
          <p className="mt-1 font-semibold">
            {member.summary.completedGoals} / {member.summary.totalGoals}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending Goals</p>
          <p className="mt-1 font-semibold">
            {member.summary.pendingGoals}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Progress Units</p>
          <p className="mt-1 font-semibold">
            {member.summary.completedTotal} / {member.summary.targetTotal}
          </p>
        </div>
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
    </article>
  );
}
