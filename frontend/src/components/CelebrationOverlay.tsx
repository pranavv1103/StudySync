import { useEffect, useRef, useState } from 'react';

export type OverlayVariant = 'all-done' | 'both-done';

type CelebrationOverlayProps = {
  visible: boolean;
  variant?: OverlayVariant;
  customTitle?: string;
  customBody?: string;
  onClose: () => void;
};

const PIECE_COLORS = [
  'bg-sky-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-violet-400',
  'bg-teal-400',
  'bg-orange-400',
  'bg-pink-400',
  'bg-indigo-400',
];

type ConfettiPiece = {
  id: number;
  color: string;
  left: string;
  delay: string;
  dur: string;
  size: number;
  round: boolean;
};

function makePieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: PIECE_COLORS[i % PIECE_COLORS.length],
    left: `${(i / count) * 100}%`,
    delay: `${((i * 0.09) % 2.6).toFixed(2)}s`,
    dur: `${2.4 + (i % 6) * 0.32}s`,
    size: 8 + (i % 5) * 4,
    round: i % 3 !== 0,
  }));
}

const PIECES = makePieces(44);

const VARIANT_COPY: Record<
  OverlayVariant,
  { emoji: string; title: string; body: string; stars: string }
> = {
  'all-done': {
    emoji: '🏆',
    title: 'Day Complete!',
    body: 'Every goal checked off. That takes real discipline.',
    stars: '⭐ ✨ ⭐ ✨ ⭐',
  },
  'both-done': {
    emoji: '💫',
    title: 'Power Duo!',
    body: 'Both of you finished today. That is rare consistency.',
    stars: '🔥 ✨ 🔥 ✨ 🔥',
  },
};

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pref = localStorage.getItem('studysync-companion-prefs');
    const parsed = pref ? (JSON.parse(pref) as { reducedMotion?: boolean }) : {};
    if (parsed.reducedMotion) return true;
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CelebrationOverlay({
  visible,
  variant = 'all-done',
  customTitle,
  customBody,
  onClose,
}: CelebrationOverlayProps) {
  const [shown, setShown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = VARIANT_COPY[variant];
  const reducedMotion = isReducedMotion();

  useEffect(() => {
    if (!visible) {
      const hideTimer = setTimeout(() => setShown(false), 0);
      if (timerRef.current) clearTimeout(timerRef.current);
      return () => clearTimeout(hideTimer);
    }

    // Allow mount before animating in
    const mountTimer = setTimeout(() => setShown(true), 20);

    // Auto-dismiss
    const dismissDelay = reducedMotion ? 3200 : 8000;
    timerRef.current = setTimeout(() => {
      setShown(false);
      setTimeout(onClose, 400);
    }, dismissDelay);

    return () => {
      clearTimeout(mountTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onClose, reducedMotion]);

  if (!visible) return null;

  const title = customTitle ?? copy.title;
  const body = customBody ?? copy.body;
  const stars = copy.stars.split(' ');

  const handleDismiss = () => {
    setShown(false);
    setTimeout(onClose, 380);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${
        shown ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Confetti rising from bottom */}
      {!reducedMotion && shown && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {PIECES.map((piece) => (
            <div
              key={piece.id}
              className={`absolute bottom-0 ${piece.color} ${piece.round ? 'rounded-full' : 'rounded'} animate-confetti-rise`}
              style={
                {
                  left: piece.left,
                  width: piece.size,
                  height: piece.size,
                  '--cdur': piece.dur,
                  '--cdelay': piece.delay,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Card */}
      <div
        className={`relative z-10 mx-4 w-full max-w-sm ${
          !reducedMotion && shown ? 'animate-celebration-enter' : ''
        }`}
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/25 bg-white shadow-[0_28px_90px_-14px_rgba(2,6,23,0.55)]">
          {/* Rainbow accent strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-sky-400 via-violet-400 via-emerald-400 to-amber-400" />

          {/* Shimmer sweep - one-shot on mount */}
          {!reducedMotion && (
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
              aria-hidden="true"
            >
              <div className="animate-shimmer-sweep absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>
          )}

          <div className="px-8 pb-8 pt-7 text-center">
            {/* Emoji */}
            <p
              className={`text-7xl leading-none select-none ${!reducedMotion ? 'animate-emoji-pulse' : ''}`}
              aria-hidden="true"
            >
              {copy.emoji}
            </p>

            {/* Title */}
            <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-900">{title}</h2>

            {/* Body */}
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>

            {/* Stars row */}
            <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
              {stars.map((star, i) => (
                <span key={i} className="select-none text-lg">
                  {star}
                </span>
              ))}
            </div>

            {/* CTA button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="mt-7 w-full rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-95"
            >
              Keep Going
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
