import { useCallback, useEffect, useRef, useState } from 'react';
import { GoalCard } from '../components/GoalCard';
import { GoalFormModal } from '../components/GoalFormModal';
import { api, type PlannedGoal } from '../lib/api';
import { addDaysToDateKey, getWeekDateKeys, parseDateKeyToLocalDate } from '../lib/dateKey';
import { useRealtimeUpdatesEnabled } from '../lib/preferences';
import { createRealtimeSocket } from '../lib/realtime';
import { useAuthStore } from '../store/authStore';
import { useDateStore } from '../store/dateStore';

function getWeekDates(dateKey: string) {
  return getWeekDateKeys(dateKey);
}

function formatDateRange(startDateKey: string, endDateKey: string): string {
  const fmt = (dateKey: string) =>
    parseDateKeyToLocalDate(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(startDateKey)} - ${fmt(endDateKey)}`;
}

export function GoalsPage() {
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const workspaceId = useAuthStore((state) => state.user?.workspaceId);
  const selectedDate = useDateStore((state) => state.selectedDate);
  const setSelectedDate = useDateStore((state) => state.setSelectedDate);
  const resetToToday = useDateStore((state) => state.resetToToday);
  const realtimeEnabled = useRealtimeUpdatesEnabled();
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [goals, setGoals] = useState<PlannedGoal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PlannedGoal | null>(null);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const successTimeoutRef = useRef<number | null>(null);

  const showTransientSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    if (successTimeoutRef.current !== null) {
      window.clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
      successTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const loadGoals = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      let fetchedGoals: PlannedGoal[] = [];

      if (viewMode === 'day') {
        fetchedGoals = await api.getPlannedGoalsByDate(token, selectedDate);
      } else {
        const weekStart = getWeekDates(selectedDate)[0];
        fetchedGoals = await api.getPlannedGoalsByWeek(token, weekStart);
      }

      setGoals(fetchedGoals);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load goals';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, token, viewMode]);

  // Fetch goals for the selected date or week
  useEffect(() => {
    loadGoals();
  }, [loadGoals, refetchTrigger]);

  useEffect(() => {
    if (!workspaceId || !currentUserId) {
      return;
    }

    if (!realtimeEnabled) {
      return;
    }

    const socket = createRealtimeSocket();

    const onConnect = () => {
      socket.emit('join-workspace', {
        workspaceId,
        userId: currentUserId,
      });
    };

    socket.on('connect', onConnect);

    const refresh = () => setRefetchTrigger((prev) => prev + 1);

    socket.on('workspace:goal-updated', refresh);
    socket.on('workspace:progress-updated', refresh);

    return () => {
      socket.off('connect', onConnect);
      socket.off('workspace:goal-updated', refresh);
      socket.off('workspace:progress-updated', refresh);
    };
  }, [currentUserId, realtimeEnabled, workspaceId]);

  // Create or update goal
  const handleSaveGoal = async (formData: {
    title: string;
    category: string;
    unit: string;
    targetValue: number;
    date: string;
    notes?: string;
    recurrenceType?: 'NONE' | 'DAILY' | 'WEEKLY';
    recurrenceDays?: number[];
    endDate?: string;
  }) => {
    if (!token) return;
    setFormError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (editingGoal) {
        if (editingGoal.userId !== currentUserId) {
          setFormError('You can only edit your own goals.');
          setIsLoading(false);
          return;
        }
        // Update existing goal
        await api.updatePlannedGoal(token, editingGoal.id, {
          title: formData.title,
          category: formData.category,
          unit: formData.unit,
          targetValue: formData.targetValue,
          notes: formData.notes,
        });
      } else {
        // Create new goal — send date as YYYY-MM-DD so backend always
        // stores UTC midnight of the user's intended local date.
        await api.createPlannedGoal(token, {
          date: formData.date,
          title: formData.title,
          category: formData.category,
          unit: formData.unit,
          targetValue: formData.targetValue,
          notes: formData.notes,
        });
      }

      showTransientSuccess(editingGoal ? 'Goal updated successfully!' : 'Goal created successfully!');
      setShowFormModal(false);
      setEditingGoal(null);
      setFormError(null);
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete goal
  const handleDeleteGoal = async (goalId: string) => {
    if (!token || !confirm('Are you sure you want to delete this goal?')) return;
    setError(null);
    setSuccessMessage(null);
    setActiveGoalId(goalId);

    try {
      await api.deletePlannedGoal(token, goalId);

      showTransientSuccess('Goal deleted successfully!');
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
    } finally {
      setActiveGoalId(null);
    }
  };

  // Update goal progress
  const handleUpdateProgress = async (goalId: string, completedValue: number) => {
    if (!token) return;
    setError(null);
    setSuccessMessage(null);
    setActiveGoalId(goalId);

    try {
      await api.updatePlannedGoalProgress(token, goalId, { completedValue });

      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress');
    } finally {
      setActiveGoalId(null);
    }
  };

  // Mark goal as complete
  const handleMarkComplete = async (goalId: string) => {
    if (!token) return;
    setError(null);
    setSuccessMessage(null);
    setActiveGoalId(goalId);

    try {
      await api.updatePlannedGoalProgress(token, goalId, { completed: true });

      showTransientSuccess('Goal marked as complete!');
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    } finally {
      setActiveGoalId(null);
    }
  };

  const dateObj = parseDateKeyToLocalDate(selectedDate);
  const dateLabel = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const weekDates = getWeekDates(selectedDate);
  const weekLabel = formatDateRange(weekDates[0], weekDates[6]);

  const goalsToDisplay = goals.filter((goal) => {
    if (viewMode === 'day') {
      return goal.date.split('T')[0] === selectedDate;
    }
    const goalDate = goal.date.split('T')[0];
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    return goalDate >= weekStart && goalDate <= weekEnd;
  });

  const ownGoals = goalsToDisplay.filter((goal) => goal.userId === currentUserId);
  const partnerGoals = goalsToDisplay.filter((goal) => goal.userId !== currentUserId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Goal Planner</h1>
            <p className="mt-1 text-sm text-slate-600">
              {viewMode === 'day' ? `Viewing: ${dateLabel}` : `Week: ${weekLabel}`}
            </p>
          </div>

          <button
            onClick={() => {
              setEditingGoal(null);
              setFormError(null);
              setShowFormModal(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Goal
          </button>
        </div>

        {/* View Mode Toggle and Date Navigation */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('day')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                viewMode === 'day'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                viewMode === 'week'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Week
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedDate(addDaysToDateKey(selectedDate, viewMode === 'day' ? -1 : -7));
              }}
              className="rounded-lg bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <input
              id="planner-date"
              name="plannerDate"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <button
              onClick={() => {
                setSelectedDate(addDaysToDateKey(selectedDate, viewMode === 'day' ? 1 : 7));
              }}
              className="rounded-lg bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={resetToToday}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Today
            </button>
          </div>
        </div>
      </section>

      {/* Messages */}
      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>
      )}

      {/* Goals Grid */}
      <div>
        {isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-600">Loading goals...</p>
          </div>
        ) : goalsToDisplay.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-slate-900">No goals yet</h3>
            <p className="mt-2 text-sm text-slate-600">Create your first goal to get started!</p>
            <button
              onClick={() => {
                setEditingGoal(null);
                setFormError(null);
                setShowFormModal(true);
              }}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Create Goal
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">My Goals</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ownGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    title={goal.title}
                    category={goal.category}
                    targetValue={goal.targetValue}
                    completedValue={goal.progress[0]?.completedValue || 0}
                    completed={goal.progress[0]?.completed || false}
                    unit={goal.unit}
                    date={goal.date}
                    status={goal.status}
                    notes={goal.notes}
                    isEditable={true}
                    isMutating={activeGoalId === goal.id}
                    onEdit={() => {
                      setEditingGoal(goal);
                      setFormError(null);
                      setShowFormModal(true);
                    }}
                    onDelete={() => handleDeleteGoal(goal.id)}
                    onUpdateProgress={(completed) => handleUpdateProgress(goal.id, completed)}
                    onMarkComplete={() => handleMarkComplete(goal.id)}
                  />
                ))}
              </div>
            </div>

            {partnerGoals.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Accountability Buddy Goals (View Only)</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {partnerGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      title={goal.title}
                      category={goal.category}
                      targetValue={goal.targetValue}
                      completedValue={goal.progress[0]?.completedValue || 0}
                      completed={goal.progress[0]?.completed || false}
                      unit={goal.unit}
                      date={goal.date}
                      status={goal.status}
                      notes={goal.notes}
                      isEditable={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <GoalFormModal
        key={`${editingGoal?.id ?? 'create'}-${selectedDate}-${showFormModal ? 'open' : 'closed'}`}
        isOpen={showFormModal}
        mode={editingGoal ? 'edit' : 'create'}
        defaultDate={selectedDate}
        initialData={
          editingGoal
            ? {
                title: editingGoal.title,
                category: editingGoal.category,
                unit: editingGoal.unit,
                targetValue: editingGoal.targetValue,
                date: editingGoal.date.split('T')[0],
                notes: editingGoal.notes,
              }
            : undefined
        }
        error={formError}
        onSubmit={handleSaveGoal}
        onClose={() => {
          setShowFormModal(false);
          setEditingGoal(null);
          setFormError(null);
        }}
        isLoading={isLoading}
      />
    </div>
  );
}
