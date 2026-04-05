import { useState, useEffect, useCallback } from 'react';
import { getCompanionMessage, getCompanionPrefs, setCompanionPrefs } from '../lib/motivation';

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

const MOOD_RING: Record<Mood, string> = {
  idle: 'ring-sky-300',
  cheering: 'ring-amber-400',
  done: 'ring-emerald-400',
  waiting: 'ring-violet-400',
};

const MOOD_BG: Record<Mood, string> = {
  idle: 'bg-sky-500 hover:bg-sky-400',
  cheering: 'bg-amber-500 hover:bg-amber-400',
  done: 'bg-emerald-500 hover:bg-emerald-400',
  waiting: 'bg-violet-500 hover:bg-violet-400',
};

export function CompanionWidget({ completionPercent, totalGoals }: CompanionWidgetProps) {
  const prefs = getCompanionPrefs();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(prefs.minimized);
  const [bouncing, setBouncing] = useState(false);
  const mood = getMood(completionPercent, totalGoals);
  const message = getCompanionMessage(mood);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noMotion = prefs.reducedMotion || prefersReducedMotion;

  const handleMinimize = useCallback(() => {
    const next = !minimized;
    setMinimized(next);
    setCompanionPrefs({ minimized: next });
    if (next) setOpen(false);
  }, [minimized]);

  // Bounce every ~12 seconds to draw gentle attention (respects reduced motion)
  useEffect(() => {
    if (noMotion) return;
    const interval = setInterval(() => {
      if (!open && !minimized) {
        setBouncing(true);
        setTimeout(() => setBouncing(false), 800);
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [open, minimized, noMotion]);

  if (minimized) {
    return (
      <div className="fixed bottom-6 left-4 z-[70]">
        <button
          onClick={handleMinimize}
          aria-label="Show Sync companion"
          title="Show Sync companion"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-500 shadow-sm hover:bg-slate-300 transition-colors text-[10px]"
        >
          ◉
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-4 z-[70] flex flex-col items-start gap-2">
      {/* Speech bubble popup */}
      {open && (
        <div
          className={`${noMotion ? '' : 'animate-slide-up'} relative max-w-[230px] rounded-2xl border border-slate-200/80 bg-white/97 px-4 py-3 shadow-[0_8px_32px_-8px_rgba(2,6,23,0.2)] backdrop-blur-sm`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Sync says</p>
            {/* Settings row */}
            <button
              onClick={handleMinimize}
              aria-label="Minimize companion"
              title="Minimize"
              className="text-[9px] text-slate-300 hover:text-slate-500 transition-colors ml-2"
            >
              hide
            </button>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{message}</p>
          {/* Tiny progress strip */}
          {totalGoals > 0 && (
            <div className="mt-2.5 h-1 w-full rounded-full bg-slate-200">
              <div
                className="h-1 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-700"
                style={{ width: `${Math.min(completionPercent, 100)}%` }}
              />
            </div>
          )}
          {/* Tail */}
          <div className="absolute -bottom-[7px] left-5 h-3 w-3 rotate-45 bg-white border-b border-r border-slate-200/80" />
        </div>
      )}

      {/* Avatar button */}
      <div className="flex items-end gap-1">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close companion' : 'Open companion'}
          className={`
            relative flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg
            ring-2 ring-offset-2 transition-all duration-200 active:scale-95
            ${MOOD_BG[mood]} ${MOOD_RING[mood]}
            ${!noMotion && bouncing ? 'animate-bounce-once' : ''}
            ${!noMotion ? 'hover:scale-110' : ''}
          `}
        >
          {/* Pulse ring on milestone moods */}
          {!noMotion && (mood === 'cheering' || mood === 'done') && (
            <span className="absolute inset-0 rounded-full animate-ping bg-current opacity-15 pointer-events-none" />
          )}
          <span className="text-[10px] font-mono font-bold leading-none select-none">
            {open ? '×' : 'Sync'}
          </span>
        </button>
        {/* ASCII face */}
        <p className="text-[9px] text-slate-400 font-mono select-none pb-0.5">{MOOD_FACE[mood]}</p>
      </div>
    </div>
  );
}
