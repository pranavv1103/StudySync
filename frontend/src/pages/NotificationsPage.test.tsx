import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { useRealtimeUpdatesEnabled } from '../lib/preferences';
import { createRealtimeSocket } from '../lib/realtime';
import { useAuthStore } from '../store/authStore';
import { NotificationsPage } from './NotificationsPage';

vi.mock('../lib/api', () => ({
  api: {
    getNotifications: vi.fn(),
  },
}));

vi.mock('../lib/realtime', () => ({
  createRealtimeSocket: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock('../lib/preferences', () => ({
  getRealtimeUpdatesEnabled: vi.fn(() => true),
  useRealtimeUpdatesEnabled: vi.fn(() => true),
}));

describe('NotificationsPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'token-1',
      user: {
        id: 'user-1',
        name: 'Pranav',
        email: 'test@example.com',
        workspaceId: 'workspace-1',
      },
    });
    vi.clearAllMocks();
  });

  it('renders both self and accountability buddy alert sections', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      myAlerts: [
        {
          id: 'n1',
          title: 'You Are On Track',
          message: 'You completed 60% today.',
          type: 'ON_TRACK_ALERT',
          audience: 'SELF',
          isRead: false,
          createdAt: '2026-03-31T00:00:00.000Z',
        },
      ],
      partnerAlerts: [
        {
          id: 'n2',
          title: 'Buddy Needs A Push',
          message: 'Pranav completed 40% today.',
          type: 'PARTNER_PROGRESS_ALERT',
          audience: 'PARTNER',
          isRead: false,
          createdAt: '2026-03-31T00:00:00.000Z',
        },
      ],
      dynamicContext: {
        date: '2026-03-31T00:00:00.000Z',
        mySummary: {
          userId: 'user-1',
          date: '2026-03-31',
          totalGoals: 3,
          completedGoals: 2,
          pendingGoals: 1,
          completionPercentage: 66.67,
          targetTotal: 6,
          completedTotal: 4,
          remainingGoalTitles: ['Review one LLD pattern'],
          groupedCategories: [],
          goals: [],
          streak: { currentStreakDays: 2, bestStreakDays: 3, missedDayCount: 0 },
        },
        partnerSummaries: [],
      },
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('My Alerts')).toBeInTheDocument();
      expect(screen.getByText('Accountability Buddy Alerts')).toBeInTheDocument();
      expect(screen.getByText('You Are On Track')).toBeInTheDocument();
      expect(screen.getByText('Buddy Needs A Push')).toBeInTheDocument();
    });
  });

  it('does not subscribe realtime when realtime toggle is disabled', async () => {
    vi.mocked(useRealtimeUpdatesEnabled).mockReturnValue(false);
    vi.mocked(api.getNotifications).mockResolvedValue({
      myAlerts: [],
      partnerAlerts: [],
      dynamicContext: {
        date: '2026-03-31T00:00:00.000Z',
        mySummary: {
          userId: 'user-1',
          date: '2026-03-31',
          totalGoals: 0,
          completedGoals: 0,
          pendingGoals: 0,
          completionPercentage: 0,
          targetTotal: 0,
          completedTotal: 0,
          remainingGoalTitles: [],
          groupedCategories: [],
          goals: [],
          streak: null,
        },
        partnerSummaries: [],
      },
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(api.getNotifications).toHaveBeenCalled();
    });

    expect(createRealtimeSocket).not.toHaveBeenCalled();
  });

  it('cleans up connect and notification listeners on unmount', async () => {
    vi.mocked(useRealtimeUpdatesEnabled).mockReturnValue(true);
    vi.mocked(api.getNotifications).mockResolvedValue({
      myAlerts: [],
      partnerAlerts: [],
      dynamicContext: {
        date: '2026-03-31T00:00:00.000Z',
        mySummary: {
          userId: 'user-1',
          date: '2026-03-31',
          totalGoals: 0,
          completedGoals: 0,
          pendingGoals: 0,
          completionPercentage: 0,
          targetTotal: 0,
          completedTotal: 0,
          remainingGoalTitles: [],
          groupedCategories: [],
          goals: [],
          streak: null,
        },
        partnerSummaries: [],
      },
    });

    const { unmount } = render(<NotificationsPage />);

    await waitFor(() => {
      expect(createRealtimeSocket).toHaveBeenCalled();
    });

    const socket = vi.mocked(createRealtimeSocket).mock.results[0]?.value;
    expect(socket).toBeDefined();

    unmount();

    expect(socket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('notification:new', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('workspace:goal-updated', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('workspace:progress-updated', expect.any(Function));
  });
});
