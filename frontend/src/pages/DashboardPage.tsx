import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MemberProgressCard } from '../components/MemberProgressCard';
import { api } from '../lib/api';
import { addDaysToDateKey, parseDateKeyToLocalDate } from '../lib/dateKey';
import { useRealtimeUpdatesEnabled } from '../lib/preferences';
import { createRealtimeSocket } from '../lib/realtime';
import { useAuthStore } from '../store/authStore';
import { useDateStore } from '../store/dateStore';

type DashboardData = Awaited<ReturnType<typeof api.getDashboard>>;

export function DashboardPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const selectedDate = useDateStore((state) => state.selectedDate);
  const setSelectedDate = useDateStore((state) => state.setSelectedDate);
  const resetToToday = useDateStore((state) => state.resetToToday);
  const realtimeEnabled = useRealtimeUpdatesEnabled();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getDashboard(token, selectedDate);
      setData(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!data?.workspaceId || !user?.id) {
      return;
    }

    if (!realtimeEnabled) {
      return;
    }

    const socket = createRealtimeSocket();

    const onConnect = () => {
      socket.emit('join-workspace', {
        workspaceId: data.workspaceId,
        userId: user.id,
      });
    };

    socket.on('connect', onConnect);

    socket.on('workspace:progress-updated', loadDashboard);
    socket.on('workspace:goal-updated', loadDashboard);

    return () => {
      socket.off('connect', onConnect);
      socket.off('workspace:progress-updated', loadDashboard);
      socket.off('workspace:goal-updated', loadDashboard);
    };
  }, [data?.workspaceId, loadDashboard, realtimeEnabled, user?.id]);

  const myMember = useMemo(
    () => data?.members.find((member) => member.user.id === data.currentUserId) ?? null,
    [data],
  );

  const partnerMember = useMemo(
    () => data?.members.find((member) => member.user.id !== data.currentUserId) ?? null,
    [data],
  );

  const dateLabel = parseDateKeyToLocalDate(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const describeStatus = (percent: number, totalGoals: number, pendingGoals: number) => {
    if (totalGoals === 0) {
      return { label: 'No Goals Planned', tone: 'bg-slate-100 text-slate-700' };
    }

    if (pendingGoals === 0 || percent >= 100) {
      return { label: 'Completed', tone: 'bg-emerald-100 text-emerald-700' };
    }

    if (percent < 50) {
      return { label: 'Behind', tone: 'bg-rose-100 text-rose-700' };
    }

    return { label: 'On Track', tone: 'bg-amber-100 text-amber-700' };
  };

  const mySummary = myMember?.summary;
  const partnerSummary = partnerMember?.summary;

  const myStatus = mySummary
    ? describeStatus(mySummary.completionPercentage, mySummary.totalGoals, mySummary.pendingGoals)
    : null;
  const partnerStatus = partnerSummary
    ? describeStatus(partnerSummary.completionPercentage, partnerSummary.totalGoals, partnerSummary.pendingGoals)
    : null;
  const topPending = mySummary?.remainingGoalTitles.slice(0, 3) ?? [];

  return (
    <section className="grid gap-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Accountability Pulse</h2>
            <p className="mt-1 text-sm text-slate-600">Summarizing goals for the selected date.</p>
            <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
              Date Context: {dateLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedDate(addDaysToDateKey(selectedDate, -1));
              }}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Prev
            </button>
            <input
              id="dashboard-date"
              name="dashboardDate"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                setSelectedDate(addDaysToDateKey(selectedDate, 1));
              }}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Next
            </button>
            <button
              onClick={resetToToday}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Today
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Live overview for self and accountability buddy progress derived from dynamic planned goals.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading dashboard...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {mySummary ? (
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">My Action Status</h3>
              {myStatus ? <span className={`rounded-full px-3 py-1 text-xs font-semibold ${myStatus.tone}`}>{myStatus.label}</span> : null}
            </div>
            <p className="text-sm text-slate-700">
              {mySummary.pendingGoals > 0
                ? `You have ${mySummary.pendingGoals} pending goal${mySummary.pendingGoals === 1 ? '' : 's'} today.`
                : 'You completed all goals for today.'}
            </p>
            <p className="text-xs text-slate-600">
              Top pending: {mySummary.remainingGoalTitles.join(', ') || 'No pending goals'}
            </p>
            <div className="flex gap-2">
              <Link to="/goals" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                Update Goals
              </Link>
              <Link to="/notifications" className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                View Alerts
              </Link>
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Accountability Buddy Status</h3>
              {partnerStatus ? (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${partnerStatus.tone}`}>{partnerStatus.label}</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Unavailable</span>
              )}
            </div>
            <p className="text-sm text-slate-700">
              {partnerSummary
                ? partnerSummary.pendingGoals > 0
                  ? `Accountability buddy has ${partnerSummary.pendingGoals} pending goal${partnerSummary.pendingGoals === 1 ? '' : 's'} today.`
                  : 'Accountability buddy completed all goals for today.'
                : 'Accountability buddy summary not available.'}
            </p>
            <p className="text-xs text-slate-600">
              Top pending: {partnerSummary?.remainingGoalTitles.join(', ') || 'No pending goals'}
            </p>
            <div className="flex gap-2">
              <Link to="/notifications" className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                Buddy Alerts
              </Link>
              <Link to="/goals" className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                Open Planner
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {mySummary ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Today's Top Pending Goals</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {mySummary.pendingGoals} Pending
            </span>
          </div>
          {topPending.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {topPending.map((title, index) => (
                <li key={title} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-700">{title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              No pending goals. You are fully caught up for this date.
            </p>
          )}
        </section>
      ) : null}

      {myMember ? <MemberProgressCard title="My Dashboard" member={myMember} tone="self" /> : null}
      {partnerMember ? (
        <MemberProgressCard title="Accountability Buddy Dashboard" member={partnerMember} tone="partner" />
      ) : null}
    </section>
  );
}
