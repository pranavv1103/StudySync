import type { WeeklyBadge } from '../lib/motivation';

type WeeklyBadgeCardProps = {
  badge: WeeklyBadge;
  daysCompleted: number;
};

export function WeeklyBadgeCard({ badge, daysCompleted }: WeeklyBadgeCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-white px-4 py-3 shadow-sm">
      <span className="text-2xl" aria-hidden="true">{badge.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">Weekly badge</p>
        </div>
        <p className="text-sm font-bold text-slate-800 leading-tight">{badge.label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{daysCompleted} day{daysCompleted !== 1 ? 's' : ''} this week</p>
      </div>
    </div>
  );
}
