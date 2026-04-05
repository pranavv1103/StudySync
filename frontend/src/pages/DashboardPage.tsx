import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CelebrationToast, type CelebrationPayload } from '../components/CelebrationToast';
import { CompanionWidget } from '../components/CompanionWidget';
import { DashboardGoalList, type GoalFilter } from '../components/DashboardGoalList';
import { FocusCard } from '../components/FocusCard';
import { GreetingBanner } from '../components/GreetingBanner';
import { MemberProgressCard } from '../components/MemberProgressCard';
import { WeeklyBadgeCard } from '../components/WeeklyBadgeCard';
import { api } from '../lib/api';
import { addDaysToDateKey, parseDateKeyToLocalDate } from '../lib/dateKey';
import {
  detectMilestone,
  getMilestoneMessage,
  getWeeklyBadge,
  hasMilestoneBeenShown,
  markMilestoneShown,
} from '../lib/motivation';
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
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [myGoalFilter, setMyGoalFilter] = useState<GoalFilter>('all');
  const [scrollToList, setScrollToList] = useState(false);
  const goalListRef = useRef<HTMLDivElement>(null);

  const prevSummaryRef = useRef<{
    completedGoals: number;
    completionPercent: number;
    totalGoals: number;
  } | null>(null);

  const isToday = useMemo(() => {
    const today = new Date();
    const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return selectedDate === d;
  }, [selectedDate]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
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
    if (!data || !isToday) return;

    const myMember = data.members.find((m) => m.user.id === data.currentUserId);
    const partnerMember = data.members.find((m) => m.user.id !== data.currentUserId);

    if (!myMember) return;

    const next = {
      completedGoals: myMember.summary.completedGoals,
      completionPercent: myMember.summary.completionPercentage,
      totalGoals: myMember.summary.totalGoals,
    };

    const partnerDone =
      !!partnerMember &&
      partnerMember.summary.totalGoals > 0 &&
      partnerMember.summary.completedGoals >= partnerMember.summary.totalGoals;

    const milestoneType = detectMilestone(prevSummaryRef.current, next, partnerDone);

    if (milestoneType && !hasMilestoneBeenShown(selectedDate, milestoneType)) {
      markMilestoneShown(selectedDate, milestoneType);
      const msg = getMilestoneMessage(milestoneType);
      const effect =
        milestoneType === 'all-done' || milestoneType === 'both-done'
          ? 'confetti'
          : milestoneType === 'three-quarter'
          ? 'burst'
          : 'none';
      setCelebration({ ...msg, effect });
    }

    prevSummaryRef.current = next;
  }, [data, isToday, selectedDate]);

  useEffect(() => {
    prevSummaryRef.current = null;
    setMyGoalFilter('all');
    setScrollToList(false);
  }, [selectedDate]);

  useEffect(() => {
    if (!data?.workspaceId || !user?.id) return;
    if (!realtimeEnabled) return;

    const socket = createRealtimeSocket();
    const onConnect = () => {
      socket.emit('join-workspace', { workspaceId: data.workspaceId, userId: user.id });
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
    if (totalGoals === 0) return { label: 'No Goals Planned', tone: 'bg-slate-100 text-slate-700' };
    if (pendingGoals === 0 || percent >= 100) return { label: 'Completed', tone: 'bg-emerald-100 text-emerald-700' };
    if (percent < 50) return { label: 'Behind', tone: 'bg-rose-100 text-rose-700' };
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
  const allGoals = mySummary?.goals ?? [];

  function handleStatClick(filter: GoalFilter) {
    setMyGoalFilter(filter);
    setScrollToList(true);
    // reset scroll trigger after next paint so it can re-fire on repeated clicks
    requestAnimationFrame(() => setScrollToList(false));
  }

  const streakDays = mySummary?.streak?.currentStreakDays ?? 0;
  const streakAtRisk = isToday && streakDays > 0 && (mySummary?.completedGoals ?? 0) === 0;

  const greetingCtx = {
    name: user?.name?.split(' ')[0] ?? 'there',
    totalGoals: mySummary?.totalGoals ?? 0,
    completedGoals: mySummary?.completedGoals ?? 0,
    completionPercent: Math.round(mySummary?.completionPercentage ?? 0),
    streakDays,
    isToday,
    streakAtRisk,
  };

  const pendingFocusGoals = (mySummary?.goals ?? []).filter((g) => !g.completed);
  const weeklyBadge = getWeeklyBadge(streakDays, false);
  const partnerDone =
    !!partnerMember &&
    partnerMember.summary.totalGoals > 0 &&
    partnerMember.summary.completedGoals >= partnerMember.summary.totalGoals;

  return (
    <section className="grid gap-5">
      {!loading && (
        <GreetingBanner
          ctx={greetingCtx}
          partnerName={partnerMember?.user.name}
          partnerDone={partnerDone}
        />
      )}

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
              onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, -1))}
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
              onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, 1))}
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



      {isToday && pendingFocusGoals.length > 0 && (
        <FocusCard goals={pendingFocusGoals} />
      )}

      {isToday && weeklyBadge && streakDays >= 1 && (
        <WeeklyBadgeCard badge={weeklyBadge} daysCompleted={streakDays} />
      )}

      {myMember ? (
        <MemberProgressCard
          title="My Dashboard"
          member={myMember}
          tone="self"
          activeFilter={myGoalFilter}
          onStatClick={handleStatClick}
        />
      ) : null}

      {/* Filtered goal list - renders directly below My Dashboard card */}
      {mySummary && allGoals.length > 0 ? (
        <div ref={goalListRef}>
          <DashboardGoalList
            filter={myGoalFilter}
            goals={allGoals}
            onReset={() => setMyGoalFilter('all')}
            scrollIntoView={scrollToList}
          />
        </div>
      ) : null}

      {partnerMember ? (
        <MemberProgressCard title="Accountability Buddy Dashboard" member={partnerMember} tone="partner" />
      ) : null}

      <CompanionWidget
        completionPercent={Math.round(mySummary?.completionPercentage ?? 0)}
        totalGoals={mySummary?.totalGoals ?? 0}
      />

      <CelebrationToast payload={celebration} onDismiss={() => setCelebration(null)} />
    </section>
  );
}
