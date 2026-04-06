import type { Badge } from '../lib/badges';

const BADGE_ICONS: Record<string, string> = {
  FIRST_WIN: '🏅',
  THREE_DAY_STREAK: '🔥',
  SEVEN_DAY_STREAK: '⚡',
  PERFECT_DAY: '✅',
  COMEBACK_DAY: '💪',
  POWER_DUO: '👫',
};

export function BadgeWall({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        Today's Achievements
      </h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 ${badge.colorClass}`}
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {BADGE_ICONS[badge.id] ?? '🏆'}
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">{badge.label}</p>
              <p className="text-xs opacity-80">{badge.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
