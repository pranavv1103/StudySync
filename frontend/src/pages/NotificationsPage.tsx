import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useRealtimeUpdatesEnabled } from '../lib/preferences';
import { createRealtimeSocket } from '../lib/realtime';
import { useAuthStore } from '../store/authStore';
import { useDateStore } from '../store/dateStore';

type NotificationsResponse = Awaited<ReturnType<typeof api.getNotifications>>;

export function NotificationsPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const selectedDate = useDateStore((state) => state.selectedDate);
  const setSelectedDate = useDateStore((state) => state.setSelectedDate);
  const realtimeEnabled = useRealtimeUpdatesEnabled();

  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingGroup, setMarkingGroup] = useState<'SELF' | 'PARTNER' | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const TYPE_FILTER_OPTIONS: { label: string; value: string | null }[] = [
    { label: 'All', value: null },
    { label: 'Cheers', value: 'CHEER' },
    { label: 'Nudges', value: 'NUDGE' },
    { label: 'Streaks', value: 'STREAK_ALERT' },
    { label: 'Progress', value: 'SELF_PROGRESS_ALERT' },
    { label: 'Missed', value: 'MISSED_GOAL_ALERT' },
  ];

  const loadNotifications = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await api.getNotifications(token, selectedDate);
      setData(response);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    }
  }, [selectedDate, token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markRead = async (notificationId: string) => {
    if (!token) {
      return;
    }

    setMarkingId(notificationId);
    try {
      await api.markNotificationRead(token, notificationId);
      setData((previous) => {
        if (!previous) {
          return previous;
        }

        const updateList = (items: typeof previous.myAlerts) =>
          items.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item));

        return {
          ...previous,
          myAlerts: updateList(previous.myAlerts),
          partnerAlerts: updateList(previous.partnerAlerts),
        };
      });
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Unable to mark notification read.');
    } finally {
      setMarkingId(null);
    }
  };

  const markAllRead = async (audience: 'SELF' | 'PARTNER') => {
    if (!token) {
      return;
    }

    setMarkingGroup(audience);
    try {
      await api.markAllNotificationsRead(token, audience);
      setData((previous) => {
        if (!previous) {
          return previous;
        }

        if (audience === 'SELF') {
          return {
            ...previous,
            myAlerts: previous.myAlerts.map((item) => ({ ...item, isRead: true })),
          };
        }

        return {
          ...previous,
          partnerAlerts: previous.partnerAlerts.map((item) => ({ ...item, isRead: true })),
        };
      });
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Unable to mark all notifications read.');
    } finally {
      setMarkingGroup(null);
    }
  };

  const filteredMyAlerts = (data?.myAlerts ?? []).filter(
    (alert) => typeFilter === null || alert.type === typeFilter,
  );
  const filteredPartnerAlerts = (data?.partnerAlerts ?? []).filter(
    (alert) => typeFilter === null || alert.type === typeFilter,
  );
  const unreadMy = filteredMyAlerts.filter((alert) => !alert.isRead).length;
  const unreadPartner = filteredPartnerAlerts.filter((alert) => !alert.isRead).length;

  useEffect(() => {
    if (!token || !user?.id || !user.workspaceId) {
      return;
    }

    if (!realtimeEnabled) {
      return;
    }

    const socket = createRealtimeSocket();

    const onConnect = () => {
      socket.emit('join-workspace', {
        workspaceId: user.workspaceId,
        userId: user.id,
      });
    };

    socket.on('connect', onConnect);

    const onNotification = () => {
      loadNotifications();
    };

    socket.on('notification:new', onNotification);
    socket.on('workspace:goal-updated', loadNotifications);
    socket.on('workspace:progress-updated', loadNotifications);

    return () => {
      socket.off('connect', onConnect);
      socket.off('notification:new', onNotification);
      socket.off('workspace:goal-updated', loadNotifications);
      socket.off('workspace:progress-updated', loadNotifications);
    };
  }, [loadNotifications, realtimeEnabled, token, user?.id, user?.workspaceId]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h2>
      <p className="mt-1 text-sm text-slate-600">
        Alerts and dynamic status are generated from planned goals and progress for the selected date.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          id="notifications-date"
          name="notificationsDate"
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Pending goals: {data?.dynamicContext.mySummary.pendingGoals ?? 0}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Completion: {data?.dynamicContext.mySummary.completionPercentage?.toFixed(2) ?? '0.00'}%
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">My Alerts Snapshot</p>
          <p className="mt-2 text-sm font-medium text-slate-800">
            {data?.dynamicContext.mySummary.pendingGoals
              ? `You still have ${data.dynamicContext.mySummary.pendingGoals} pending goal${data.dynamicContext.mySummary.pendingGoals === 1 ? '' : 's'} today.`
              : 'You completed all goals for today.'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Remaining: {data?.dynamicContext.mySummary.remainingGoalTitles.join(', ') || 'No pending goals'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Accountability Buddy Alerts Snapshot</p>
          <p className="mt-2 text-sm font-medium text-slate-800">
            {data?.dynamicContext.partnerSummaries?.[0]
              ? data.dynamicContext.partnerSummaries[0].pendingGoals > 0
                ? `Accountability buddy has ${data.dynamicContext.partnerSummaries[0].pendingGoals} pending goal${data.dynamicContext.partnerSummaries[0].pendingGoals === 1 ? '' : 's'} today.`
                : 'Accountability buddy completed all goals for today.'
              : 'No accountability buddy data available yet.'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Remaining:{' '}
            {data?.dynamicContext.partnerSummaries?.[0]?.remainingGoalTitles.join(', ') || 'No pending goals'}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">Top pending goals</p>
        <p className="mt-1 text-sm text-slate-600">
          {data?.dynamicContext.mySummary.remainingGoalTitles.join(', ') || 'No pending goals'}
        </p>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {TYPE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value ?? 'all'}
            type="button"
            onClick={() => setTypeFilter(option.value)}
            className={
              typeFilter === option.value
                ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'
                : 'rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50'
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">My Alerts</h3>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Unread: {unreadMy}
              </span>
              <button
                type="button"
                onClick={() => markAllRead('SELF')}
                disabled={unreadMy === 0 || markingGroup === 'SELF'}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
              >
                {markingGroup === 'SELF' ? 'Saving...' : 'Mark All Read'}
              </button>
            </div>
          </div>
          {filteredMyAlerts.length === 0 ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              No personal alerts yet for this date.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {filteredMyAlerts.slice(0, 8).map((alert) => (
                <li key={alert.id} className={`rounded-lg p-3 ${alert.isRead ? 'bg-slate-50' : 'bg-sky-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{alert.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!alert.isRead ? (
                      <button
                        type="button"
                        onClick={() => markRead(alert.id)}
                        disabled={markingId === alert.id}
                        className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {markingId === alert.id ? 'Saving...' : 'Mark Read'}
                      </button>
                    ) : (
                      <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Read</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Accountability Buddy Alerts</h3>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Unread: {unreadPartner}
              </span>
              <button
                type="button"
                onClick={() => markAllRead('PARTNER')}
                disabled={unreadPartner === 0 || markingGroup === 'PARTNER'}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
              >
                {markingGroup === 'PARTNER' ? 'Saving...' : 'Mark All Read'}
              </button>
            </div>
          </div>
          {filteredPartnerAlerts.length === 0 ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              No accountability buddy alerts right now. You are synced.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {filteredPartnerAlerts.slice(0, 8).map((alert) => (
                <li key={alert.id} className={`rounded-lg p-3 ${alert.isRead ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{alert.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!alert.isRead ? (
                      <button
                        type="button"
                        onClick={() => markRead(alert.id)}
                        disabled={markingId === alert.id}
                        className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {markingId === alert.id ? 'Saving...' : 'Mark Read'}
                      </button>
                    ) : (
                      <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Read</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
