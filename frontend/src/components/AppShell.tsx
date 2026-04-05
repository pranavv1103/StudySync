import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { createRealtimeSocket } from '../lib/realtime';
import { useAuthStore } from '../store/authStore';

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [unreadCount, setUnreadCount] = useState(0);

  const initials = (user?.name ?? 'M')
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Fetch initial unread count
  useEffect(() => {
    if (!token) return;
    api.getUnreadCount(token).then((res) => setUnreadCount(res.unread)).catch(() => {});
  }, [token]);

  // Subscribe to real-time notification:new events
  useEffect(() => {
    if (!token || !user) return;
    const socket = createRealtimeSocket();
    const onNew = () => {
      setUnreadCount((c) => c + 1);
    };
    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, [token, user]);

  // When user visits notifications page, reset badge by re-fetching
  const isOnNotifications = location.pathname.startsWith('/notifications');
  useEffect(() => {
    if (isOnNotifications && token) {
      api.getUnreadCount(token).then((res) => setUnreadCount(res.unread)).catch(() => {});
    }
  }, [isOnNotifications, token]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eff6ff_35%,_#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-8 pt-6 md:px-8">
        <header className="rounded-2xl border border-slate-200/70 bg-white/80 px-5 py-4 shadow-[0_12px_48px_-32px_rgba(2,6,23,0.55)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">StudySync</p>
              <h1 className="text-2xl font-bold tracking-tight">Accountability Workspace</h1>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`${user.name} profile`}
                  className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                  {initials}
                </span>
              )}
              <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-800">
                {user?.name ?? 'Member'}
              </span>
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                onClick={() => {
                  clearAuth();
                  navigate('/login');
                }}
              >
                Logout
              </button>
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            {[
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/goals', label: 'Goals' },
              { to: '/notifications', label: 'Notifications', badge: unreadCount },
              { to: '/analytics', label: 'Analytics' },
              { to: '/settings', label: 'Settings' },
            ].map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {item.label}
                  {'badge' in item && (item.badge ?? 0) > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                      {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
