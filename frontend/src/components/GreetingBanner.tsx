import type { GreetingContext } from '../lib/motivation';
import { buildGreeting, getDailyQuote, getEnergyMessage, computeProgressState, getTimeOfDay } from '../lib/motivation';

type GreetingBannerProps = {
  ctx: GreetingContext;
  partnerName?: string;
  partnerDone?: boolean;
};

const TIME_EMOJI: Record<ReturnType<typeof getTimeOfDay>, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌆',
  night: '🌙',
};

export function GreetingBanner({ ctx, partnerName, partnerDone }: GreetingBannerProps) {
  const greeting = buildGreeting(ctx);
  const quote = getDailyQuote();
  const tod = getTimeOfDay();
  const emoji = TIME_EMOJI[tod];

  const { completedGoals, totalGoals, completionPercent, streakDays, isToday, streakAtRisk } = ctx;
  const isComplete = totalGoals > 0 && completedGoals >= totalGoals;
  const bothDone = isComplete && partnerDone;

  const progressState = computeProgressState(completedGoals, totalGoals);
  const energyMessage = getEnergyMessage(progressState);

  // Background and color theme
  const bgClass = bothDone
    ? 'from-violet-50 to-white border-violet-200/70'
    : isComplete
    ? 'from-emerald-50 to-white border-emerald-200/70'
    : streakAtRisk
    ? 'from-amber-50 to-white border-amber-300/60'
    : 'from-sky-50 to-white border-sky-200/70';

  const barColor = isComplete
    ? 'bg-emerald-500'
    : completionPercent >= 75
    ? 'bg-amber-500'
    : completionPercent >= 50
    ? 'bg-amber-400'
    : 'bg-sky-500';

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${bgClass} px-5 py-5 shadow-sm`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: greeting + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              {isComplete ? '🏆' : streakAtRisk ? '⚠️' : emoji}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {streakAtRisk ? 'Streak at risk' : tod.charAt(0).toUpperCase() + tod.slice(1) + ' greeting'}
            </p>
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900 leading-snug">{greeting}</h2>

          {/* Progress strip */}
          {isToday && totalGoals > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{completedGoals} / {totalGoals} goals done</span>
                <span className="font-semibold">{completionPercent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${Math.min(completionPercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Badges row */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Streak badge */}
            {streakDays > 0 && isToday && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  streakAtRisk
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                🔥 {streakDays}-day streak{streakAtRisk ? ' - at risk!' : ' - keep it alive'}
              </span>
            )}
            {/* Partner done badge */}
            {partnerDone && partnerName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                ✅ {partnerName} is done
              </span>
            )}
          </div>

          {/* Daily energy message */}
          {isToday && (
            <p className="mt-3 text-xs text-slate-500 italic">"{energyMessage}"</p>
          )}
        </div>

        {/* Right: daily quote card */}
        <div className="shrink-0 w-full sm:w-56 rounded-xl bg-white/70 border border-slate-200/60 px-4 py-3 shadow-xs">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Today's quote</p>
          <p className="text-xs text-slate-700 leading-relaxed">"{quote.text}"</p>
          <p className="mt-1 text-[10px] font-medium text-slate-400">- {quote.author}</p>
        </div>
      </div>
    </div>
  );
}
