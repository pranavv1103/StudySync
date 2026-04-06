import { useState } from 'react';
import type { FormEvent } from 'react';
import { todayDateKey } from '../lib/dateKey';

interface GoalFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  defaultDate?: string;
  initialData?: {
    title: string;
    category: string;
    unit: string;
    targetValue: number;
    date: string;
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
    notes?: string;
    recurrenceType?: 'NONE' | 'DAILY' | 'WEEKLY';
  };
  error?: string | null;
  onSubmit: (data: {
    title: string;
    category: string;
    unit: string;
    targetValue: number;
    date: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    notes?: string;
    recurrenceType?: 'NONE' | 'DAILY' | 'WEEKLY';
    recurrenceDays?: number[];
    endDate?: string;
  }) => void;
  onClose: () => void;
  isLoading?: boolean;
}

const CATEGORIES = ['DSA', 'Job Search', 'Learning', 'Project', 'Interview', 'System', 'Other'];

const UNITS = [
  { value: 'PROBLEMS', label: 'Problems' },
  { value: 'JOBS', label: 'Jobs' },
  { value: 'TOPICS', label: 'Topics' },
  { value: 'HOURS', label: 'Hours' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'VIDEOS', label: 'Videos' },
  { value: 'APPLICATIONS', label: 'Applications' },
  { value: 'SESSIONS', label: 'Sessions' },
  { value: 'MINUTES', label: 'Minutes' },
  { value: 'ITEMS', label: 'Items' },
];

function todayDate() {
  return todayDateKey();
}

function buildFormData(
  initialData?: GoalFormModalProps['initialData'],
  defaultDate?: string,
) {
  return {
    title: initialData?.title || '',
    category: initialData?.category || 'Learning',
    unit: initialData?.unit || 'ITEMS',
    targetValue: initialData?.targetValue || 1,
    date: initialData?.date || defaultDate || todayDate(),
    difficulty: (initialData?.difficulty || 'MEDIUM') as 'EASY' | 'MEDIUM' | 'HARD',
    notes: initialData?.notes || '',
    recurrenceType: initialData?.recurrenceType || 'NONE',
    endDate: '',
    selectedWeekdays: [false, false, false, false, false, false, false],
  };
}

export function GoalFormModal({
  isOpen,
  mode,
  defaultDate,
  initialData,
  error,
  onSubmit,
  onClose,
  isLoading = false,
}: GoalFormModalProps) {
  const [formData, setFormData] = useState(() => buildFormData(initialData, defaultDate));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const selectedWeekdayIndices = formData.selectedWeekdays
      .map((selected, index) => (selected ? index : -1))
      .filter((index) => index !== -1);

    onSubmit({
      title: formData.title,
      category: formData.category,
      unit: formData.unit,
      targetValue: formData.targetValue,
      date: formData.date,
      difficulty: formData.difficulty,
      notes: formData.notes || undefined,
      recurrenceType: formData.recurrenceType as 'NONE' | 'DAILY' | 'WEEKLY',
      recurrenceDays: selectedWeekdayIndices.length > 0 ? selectedWeekdayIndices : undefined,
      endDate: formData.endDate || undefined,
    });
  };

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'create' ? 'Create New Goal' : 'Edit Goal'}
          </h2>
        </div>

        {/* Scrollable form body */}
        <form id="goal-form" onSubmit={handleSubmit} className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
          {/* Inline error banner */}
          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="goal-title" className="block text-sm font-medium text-slate-700">
              Goal Title *
            </label>
            <input
              id="goal-title"
              name="title"
              type="text"
              required
              placeholder="e.g., Solve DSA problems"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Category and Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="goal-category" className="block text-sm font-medium text-slate-700">
                Category *
              </label>
              <select
                id="goal-category"
                name="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:border-blue-500 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="goal-unit" className="block text-sm font-medium text-slate-700">
                Unit *
              </label>
              <select
                id="goal-unit"
                name="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:border-blue-500 focus:outline-none"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Value */}
          <div>
            <label htmlFor="goal-target-value" className="block text-sm font-medium text-slate-700">
              Target Value *
            </label>
            <input
              id="goal-target-value"
              name="targetValue"
              type="number"
              required
              min={1}
              value={formData.targetValue}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setFormData({ ...formData, targetValue: Number.isNaN(parsed) ? 1 : Math.max(1, parsed) });
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Difficulty */}
          <div>
            <span className="block text-sm font-medium text-slate-700">Difficulty</span>
            <div className="mt-2 flex gap-2">
              {(['EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, difficulty: level })}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${
                    formData.difficulty === level
                      ? level === 'EASY'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : level === 'MEDIUM'
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-rose-400 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {level === 'EASY' ? 'Easy (x1)' : level === 'MEDIUM' ? 'Medium (x3)' : 'Hard (x5)'}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="goal-date" className="block text-sm font-medium text-slate-700">
              Date *
            </label>
            <input
              id="goal-date"
              name="date"
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="goal-notes" className="block text-sm font-medium text-slate-700">
              Notes (Optional)
            </label>
            <textarea
              id="goal-notes"
              name="notes"
              placeholder="Add any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Recurrence */}
          <div className="space-y-3 rounded-lg bg-slate-50 p-4">
            <label htmlFor="goal-recurrence" className="block text-sm font-medium text-slate-700">
              Recurrence
            </label>
            <select
              id="goal-recurrence"
              name="recurrenceType"
              value={formData.recurrenceType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  recurrenceType: e.target.value as 'NONE' | 'DAILY' | 'WEEKLY',
                  selectedWeekdays: [false, false, false, false, false, false, false],
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 transition focus:border-blue-500 focus:outline-none"
            >
              <option value="NONE">One-time only</option>
              <option value="DAILY">Repeat daily</option>
              <option value="WEEKLY">Repeat weekly</option>
            </select>

            {/* Weekly days selector */}
            {formData.recurrenceType === 'WEEKLY' && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-slate-600">Select days:</p>
                <div className="flex gap-1">
                  {weekdayLabels.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const newWeekdays = [...formData.selectedWeekdays];
                        newWeekdays[index] = !newWeekdays[index];
                        setFormData({ ...formData, selectedWeekdays: newWeekdays });
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition ${
                        formData.selectedWeekdays[index]
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* End date for recurrence */}
            {formData.recurrenceType !== 'NONE' && (
              <div>
                <label htmlFor="goal-recurrence-end-date" className="block text-xs font-medium text-slate-700">
                  Recurs until (Optional)
                </label>
                <input
                  id="goal-recurrence-end-date"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm transition focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </form>

        {/* Sticky footer with action buttons */}
        <div className="flex-shrink-0 flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="goal-form"
            disabled={isLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : mode === 'create' ? 'Create Goal' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
