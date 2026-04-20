import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { createRealtimeSocket } from '../lib/realtime';
import { useAuthStore } from '../store/authStore';
import { DashboardPage } from './DashboardPage';
import { useRealtimeUpdatesEnabled } from '../lib/preferences';

vi.mock('../lib/api', () => ({
  api: {
    getDashboard: vi.fn(),
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

describe('DashboardPage', () => {
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

  it('renders self and accountability buddy cards from dashboard payload', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue({
      date: '2026-03-31T00:00:00.000Z',
      workspaceId: 'workspace-1',
      currentUserId: 'user-1',
      members: [
        {
          user: { id: 'user-1', name: 'Pranav', email: 'test@example.com' },
          role: 'OWNER',
          summary: {
            userId: 'user-1',
            date: '2026-03-31',
            totalGoals: 3,
            completedGoals: 1,
            pendingGoals: 2,
            completionPercentage: 33.3,
            targetTotal: 7,
            completedTotal: 2,
            remainingGoalTitles: ['Solve 5 DSA problems', 'Apply to 3 companies'],
            groupedCategories: [
              {
                category: 'DSA',
                goals: 1,
                completedGoals: 0,
                targetTotal: 5,
                completedTotal: 2,
                completionPercentage: 40,
              },
            ],
            goals: [],
            streak: { currentStreakDays: 2, bestStreakDays: 4, missedDayCount: 0 },
          },
        },
        {
          user: { id: 'user-2', name: 'Sneha', email: 'partner@example.com' },
          role: 'MEMBER',
          summary: {
            userId: 'user-2',
            date: '2026-03-31',
            totalGoals: 2,
            completedGoals: 1,
            pendingGoals: 1,
            completionPercentage: 50,
            targetTotal: 4,
            completedTotal: 2,
            remainingGoalTitles: ['Review one LLD pattern'],
            groupedCategories: [
              {
                category: 'Learning',
                goals: 1,
                completedGoals: 0,
                targetTotal: 1,
                completedTotal: 0,
                completionPercentage: 0,
              },
            ],
            goals: [],
            streak: { currentStreakDays: 3, bestStreakDays: 5, missedDayCount: 0 },
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('My Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Accountability Buddy Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Sneha')).toBeInTheDocument();
    });
  });

  it('does not subscribe realtime when realtime toggle is disabled', async () => {
    vi.mocked(useRealtimeUpdatesEnabled).mockReturnValue(false);
    vi.mocked(api.getDashboard).mockResolvedValue({
      date: '2026-03-31T00:00:00.000Z',
      workspaceId: 'workspace-1',
      currentUserId: 'user-1',
      members: [],
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(api.getDashboard).toHaveBeenCalled();
    });

    expect(createRealtimeSocket).not.toHaveBeenCalled();
  });

  it('cleans up connect and workspace listeners on unmount', async () => {
    vi.mocked(useRealtimeUpdatesEnabled).mockReturnValue(true);
    vi.mocked(api.getDashboard).mockResolvedValue({
      date: '2026-03-31T00:00:00.000Z',
      workspaceId: 'workspace-1',
      currentUserId: 'user-1',
      members: [],
    });

    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(createRealtimeSocket).toHaveBeenCalled();
    });

    const socket = vi.mocked(createRealtimeSocket).mock.results[0]?.value;
    expect(socket).toBeDefined();

    unmount();

    expect(socket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('workspace:progress-updated', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('workspace:goal-updated', expect.any(Function));
  });
});
