import { useState } from 'react';

interface GoalCardProps {
  title: string;
  category: string;
  targetValue: number;
  completedValue: number;
  completed?: boolean;
  unit: string;
  date: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  notes?: string;
  isEditable?: boolean;
  isMutating?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdateProgress?: (completed: number) => void;
  onMarkComplete?: () => void;
}

const UNIT_LABELS: Record<string, string> = {
  PROBLEMS: 'problems',
  JOBS: 'job apps',
  TOPICS: 'topics',
  HOURS: 'hours',
  TASKS: 'tasks',
  VIDEOS: 'videos',
  APPLICATIONS: 'applications',
  SESSIONS: 'sessions',
  MINUTES: 'minutes',
  ITEMS: 'items',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  DSA: { bg: 'bg-blue-50', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-700' },
  'Job Search': { bg: 'bg-emerald-50', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-700' },
  Learning: { bg: 'bg-purple-50', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-700' },
  Project: { bg: 'bg-amber-50', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-700' },
  Interview: { bg: 'bg-rose-50', text: 'text-rose-900', badge: 'bg-rose-100 text-rose-700' },
  System: { bg: 'bg-cyan-50', text: 'text-cyan-900', badge: 'bg-cyan-100 text-cyan-700' },
};

export function GoalCard({
  title,
  category,
  targetValue,
  completedValue,
  completed = false,
  unit,
  date,
  status,
  notes,
  isEditable = true,
  isMutating = false,
  onEdit,
  onDelete,
  onUpdateProgress,
  onMarkComplete,
}: GoalCardProps) {
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [progressInput, setProgressInput] = useState('');

  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Learning'];
  const unitLabel = UNIT_LABELS[unit] || unit.toLowerCase();
  const isCompleted = completed || status === 'COMPLETED' || completedValue >= targetValue;
  const normalizedCompletedValue = Math.min(isCompleted ? targetValue : completedValue, targetValue);
  const progressPercent = Math.min(100, Math.round((normalizedCompletedValue / targetValue) * 100) || 0);

  const handleIncrementProgress = () => {
    if (!onUpdateProgress || isCompleted || isMutating) return;
    const newValue = Math.min(normalizedCompletedValue + 1, targetValue);
    onUpdateProgress(newValue);
  };

  const handleSetProgress = () => {
    if (!onUpdateProgress || progressInput === '' || isMutating) return;
    const value = Math.min(parseInt(progressInput, 10), targetValue);
    if (!isNaN(value)) {
      onUpdateProgress(value);
      setProgressInput('');
      setIsUpdatingProgress(false);
    }
  };

  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className={`rounded-lg border border-slate-200 p-4 shadow-sm transition ${colors.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-base font-semibold ${colors.text}`}>{title}</h3>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors.badge}`}>
              {category}
            </span>
          </div>
          {notes && <p className="mt-2 text-xs text-slate-600">{notes}</p>}
        </div>

        {/* Action buttons */}
        <div className="ml-4 flex gap-1">
          <button
            onClick={onEdit}
            disabled={!isEditable || isMutating || !onEdit}
            className="rounded p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-700"
            title="Edit goal"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-7-4l4.35-4.35m0 0a2.828 2.828 0 114 4v4h-4v-4z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            disabled={!isEditable || isMutating || !onDelete}
            className="rounded p-1.5 text-slate-500 transition hover:bg-white hover:text-rose-600"
            title="Delete goal"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4v2h16V7h-3z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Target info */}
      <div className="mt-3 text-sm text-slate-700">
        <span className="font-medium">{targetValue}</span> {unitLabel}
        <span className="ml-2 text-slate-500">({dateStr})</span>
      </div>

      {/* Progress bar */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">
            {normalizedCompletedValue} / {targetValue}
          </span>
          <span className="font-medium text-slate-700">{progressPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200">
          <div
            className={`h-2 rounded-full transition-all ${
              isCompleted ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Progress update section */}
      <div className="mt-4 flex gap-2">
        {isEditable && isUpdatingProgress ? (
          <>
            <input
              name="manualProgress"
              type="number"
              min={0}
              max={targetValue}
              value={progressInput}
              onChange={(e) => setProgressInput(e.target.value)}
              placeholder="Enter progress"
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSetProgress()}
            />
            <button
              onClick={handleSetProgress}
              className="rounded bg-blue-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600"
            >
              Set
            </button>
            <button
              onClick={() => setIsUpdatingProgress(false)}
              className="rounded bg-slate-300 px-2.5 py-1.5 text-xs font-medium transition hover:bg-slate-400"
            >
              Cancel
            </button>
          </>
        ) : isEditable ? (
          <>
            <button
              onClick={handleIncrementProgress}
              disabled={isCompleted || isMutating}
              className="flex-1 rounded bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-200 disabled:opacity-50"
            >
              +1 Progress
            </button>
            <button
              onClick={() => setIsUpdatingProgress(true)}
              disabled={isMutating}
              className="rounded bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-300"
            >
              Edit
            </button>
            {!isCompleted && (
              <button
                onClick={onMarkComplete}
                disabled={isMutating || !onMarkComplete}
                className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-600"
              >
                Mark Done
              </button>
            )}
          </>
        ) : (
          <div className="w-full rounded bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            View only (partner goal)
          </div>
        )}
      </div>

      {/* Status indicator */}
      {isCompleted && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-700">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Completed
        </div>
      )}
    </div>
  );
}
