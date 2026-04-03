type ProgressBarProps = {
  value: number;
  colorClass?: string;
};

export function ProgressBar({ value, colorClass = 'bg-sky-500' }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2.5 w-full rounded-full bg-slate-200" data-testid="progress-track">
      <div
        data-testid="progress-fill"
        className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
