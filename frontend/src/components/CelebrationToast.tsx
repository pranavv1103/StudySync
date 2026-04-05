import { useEffect, useRef, useState } from 'react';

export type CelebrationPayload = {
  emoji: string;
  title: string;
  body: string;
  /** 'confetti' = many floating orbs, 'burst' = single radial burst, 'none' */
  effect?: 'confetti' | 'burst' | 'none';
};

type Props = {
  payload: CelebrationPayload | null;
  onDismiss: () => void;
};

const CONFETTI_COLORS = [
  'bg-sky-400', 'bg-emerald-400', 'bg-amber-400',
  'bg-rose-400', 'bg-violet-400', 'bg-teal-400',
];

type Flake = {
  id: number;
  color: string;
  left: string;
  delay: string;
  size: number;
};

function makeFlakes(count: number): Flake[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${5 + Math.floor((i / count) * 90)}%`,
    delay: `${(i * 0.07) % 1.4}s`,
    size: 6 + (i % 4) * 2,
  }));
}

const FLAKES = makeFlakes(18);

export function CelebrationToast({ payload, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!payload) {
      return;
    }

    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 10); // next tick to allow mount

    // Auto-dismiss after 6 seconds
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400); // wait for fade-out before clearing
    }, 6000);

    return () => {
      clearTimeout(showTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [payload, onDismiss]);

  if (!payload) return null;

  const showConfetti = payload.effect !== 'none' && payload.effect !== 'burst';

  return (
    <>
      {/* Confetti layer */}
      {showConfetti && visible && (
        <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
          {FLAKES.map((f) => (
            <div
              key={f.id}
              className={`absolute -top-3 rounded-full opacity-0 ${f.color} animate-confetti-fall`}
              style={{
                left: f.left,
                width: f.size,
                height: f.size,
                animationDelay: f.delay,
              }}
            />
          ))}
        </div>
      )}

      {/* Toast card */}
      <div
        aria-live="polite"
        className={`fixed bottom-6 right-4 z-[90] max-w-xs transition-all duration-400 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-4 shadow-[0_8px_40px_-8px_rgba(2,6,23,0.25)] backdrop-blur-sm">
          {/* Accent strip */}
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-400" />

          <div className="flex items-start gap-3 pt-1">
            <span className="text-3xl leading-none" aria-hidden="true">{payload.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">{payload.title}</p>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{payload.body}</p>
            </div>
            <button
              onClick={() => {
                setVisible(false);
                setTimeout(onDismiss, 400);
              }}
              className="text-slate-400 hover:text-slate-600 transition"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
