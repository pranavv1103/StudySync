import { useState, useEffect } from 'react';
import { getCompanionMessage } from '../lib/motivation';

type CompanionWidgetProps = {
  completionPercent: number;
  totalGoals: number;
};

type Mood = 'idle' | 'cheering' | 'done' | 'waiting';

function getMood(completionPercent: number, totalGoals: number): Mood {
  if (totalGoals === 0) return 'waiting';
  if (completionPercent >= 100) return 'done';
  if (completionPercent >= 50) return 'cheering';
  return 'idle';
}

const MOOD_FACE: Record<Mood, string> = {
  idle: '(ᵔ◡ᵔ)',
  cheering: '\\(^o^)/',
  done: '(★‿★)',
  waiting: '(｡◕‿◕｡)',
};

const MOOD_COLOR: Record<Mood, string> = {
  idle: 'from-sky-400 to-sky-600',
  cheering: 'from-amber-400 to-orange-500',
  done: 'from-emerald-400 to-emerald-600',
  waiting: 'from-violet-400 to-violet-600',
};

const MOOD_LABEL: Record<Mood, string> = {
  idle: 'Sync',
  cheering: 'Go!',
  done: 'Done!',
  waiting: 'Hey!',
};

export function CompanionWidget({ completionPercent, totalGoals }: CompanionWidgetProps) {
  const [open, setOpen] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const mood = getMood(completionPercent, totalGoals);
  const message = getCompanionMessage();

  // Bounce the button every ~12 seconds to gently attract attention
  useEffect(() => {
    const interval = setInterval(() => {
      if (!open) {
        setBouncing(true);
        setTimeout(() => setBouncing(false), 800);
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [open]);

  return (
    <div className="fixed bottom-6 left-4 z-[70] flex flex-col items-start gap-2">
      {/* Speech bubble popup */}
      {open && (
        <div className="animate-slide-up max-w-[220px] rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_8px_32px_-8px_rgba(2,6,23,0.2)] backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Sync says</p>
          <p className="text-xs text-slate-700 leading-relaxed">{message}</p>
          {/* Completion status */}
          {totalGoals > 0 && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-700"
                style={{ width: `${Math.min(completionPercent, 100)}%` }}
              />
            </div>
          )}
          {/* Tail pointer */}
          <div className="absolute -bottom-2 left-5 h-3 w-3 rotate-45 bg-white border-b border-r border-slate-200/80" />
        </div>
      )}

      {/* Companion button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open companion"
        className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 ${MOOD_COLOR[mood]} ${bouncing ? 'animate-bounce-once' : ''}`}
      >
        {/* Pulse ring when cheering or done */}
        {(mood === 'cheering' || mood === 'done') && (
          <span className="absolute inset-0 rounded-full animate-ping bg-current opacity-20" />
        )}
        <span className="text-[11px] font-mono font-bold leading-none select-none">
          {open ? '×' : MOOD_LABEL[mood]}
        </span>
      </button>

      {/* Mood face tooltip on hover */}
      <p className="text-[9px] text-center w-12 text-slate-400 select-none font-mono">{MOOD_FACE[mood]}</p>
    </div>
  );
}
