import { useEffect, useRef, useState } from 'react';
import type { MilestoneType } from '../lib/motivation';

export type CelebrationPayload = {
  emoji: string;
  title: string;
  body: string;
  /** Which milestone triggered this - used for accent color */
  milestoneType?: MilestoneType;
  /** 'confetti' = many falling orbs, 'burst' = radial sparkle, 'none' */
  effect?: 'confetti' | 'burst' | 'none';
};

type Props = {
  payload: CelebrationPayload | null;
  onDismiss: () => void;
};

const CONFETTI_COLORS = [
  'bg-sky-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-violet-400',
  'bg-teal-400',
];

type Flake = { id: number; color: string; left: string; delay: string; size: number };

function makeFlakes(count: number): Flake[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${5 + Math.floor((i / count) * 90)}%`,
    delay: `${(i * 0.07) % 1.4}s`,
    size: 6 + (i % 4) * 2,
  }));
}

type SparkleParticle = {
  id: number;
  color: string;
  tx: string;
  ty: string;
  size: number;
  delay: string;
};

function makeSparkles(count: number): SparkleParticle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360;
    const rad = (angle * Math.PI) / 180;
    const dist = 55 + (i % 3) * 22;
    return {
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      tx: `${(Math.cos(rad) * dist).toFixed(1)}px`,
      ty: `${(Math.sin(rad) * dist).toFixed(1)}px`,
      size: 7 + (i % 3) * 3,
      delay: `${(i * 0.045).toFixed(2)}s`,
    };
  });
}

const SPARKLES = makeSparkles(12);

// Per-milestone accent gradient on the top strip
function getAccentGradient(type?: MilestoneType): string {
  switch (type) {
    case 'first-task':
    case 'quarter':
      return 'from-emerald-400 to-teal-400';
    case 'halfway':
      return 'from-amber-400 to-orange-400';
    case 'three-quarter':
      return 'from-violet-400 to-purple-400';
    case 'all-done':
    case 'both-done':
      return 'from-sky-400 via-emerald-400 to-amber-400';
    case 'comeback':
      return 'from-rose-400 to-pink-400';
    case 'partner-done':
      return 'from-teal-400 to-sky-400';
    case 'streak-alive':
      return 'from-orange-400 to-rose-400';
    default:
      return 'from-sky-400 via-emerald-400 to-amber-400';
  }
}

function getFlakeCount(type?: MilestoneType): number {
  switch (type) {
    case 'first-task':
    case 'quarter':
      return 6;
    case 'halfway':
      return 12;
    case 'three-quarter':
      return 16;
    case 'all-done':
    case 'both-done':
      return 22;
    default:
      return 10;
  }
}

export function CelebrationToast({ payload, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!payload) return;

    const showTimer = setTimeout(() => {
      setVisible(true);
      if (payload.effect === 'burst') {
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 900);
      }
    }, 10);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 6000);

    return () => {
      clearTimeout(showTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [payload, onDismiss]);

  if (!payload) return null;

  const flakeCount = getFlakeCount(payload.milestoneType);
  const flakes = makeFlakes(flakeCount);
  const accentGradient = getAccentGradient(payload.milestoneType);
  const showConfetti = payload.effect === 'confetti';

  return (
    <>
      {/* Confetti layer */}
      {showConfetti && visible && (
        <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden="true">
          {flakes.map((f) => (
            <div
              key={f.id}
              className={`absolute -top-3 rounded-full opacity-0 ${f.color} animate-confetti-fall`}
              style={{ left: f.left, width: f.size, height: f.size, animationDelay: f.delay }}
            />
          ))}
        </div>
      )}

      {/* Burst layer - radial sparkle particles anchored near toast */}
      {showBurst && (
        <div
          className="pointer-events-none fixed bottom-[96px] right-[80px] z-[80]"
          aria-hidden="true"
        >
          {SPARKLES.map((s) => (
            <div
              key={s.id}
              className={`absolute rounded-full ${s.color} animate-sparkle-fling`}
              style={
                {
                  width: s.size,
                  height: s.size,
                  '--tx': s.tx,
                  '--ty': s.ty,
                  '--sdelay': s.delay,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Toast card */}
      <div
        aria-live="polite"
        className={`fixed bottom-6 right-4 z-[90] max-w-xs transition-all duration-400 ${
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-4 shadow-[0_8px_40px_-8px_rgba(2,6,23,0.25)] backdrop-blur-sm">
          {/* Accent strip - color varies by milestone */}
          <div
            className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${accentGradient}`}
          />

          <div className="flex items-start gap-3 pt-1">
            <span className="text-3xl leading-none" aria-hidden="true">
              {payload.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">{payload.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{payload.body}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setVisible(false);
                setTimeout(onDismiss, 400);
              }}
              className="shrink-0 text-slate-400 transition hover:text-slate-600"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
