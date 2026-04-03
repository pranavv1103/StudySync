import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { useRealtimeUpdatesEnabled } from '../lib/preferences';
import { createRealtimeSocket } from '../lib/realtime';
import { useAuthStore } from '../store/authStore';
import { GoalsPage } from './GoalsPage';

vi.mock('../lib/api', () => ({
  api: {
    getPlannedGoalsByDate: vi.fn(),
    getPlannedGoalsByWeek: vi.fn(),
    createPlannedGoal: vi.fn(),
    updatePlannedGoal: vi.fn(),
    deletePlannedGoal: vi.fn(),
    updatePlannedGoalProgress: vi.fn(),
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
  getRealtimeUpdatesEnabled: vi.fn(() => false),
  useRealtimeUpdatesEnabled: vi.fn(() => false),
}));

describe('GoalsPage realtime toggle', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'token-1',
      user: {
        id: 'user-1',
        name: 'Pranav',
        email: 'pranav.l1903@gmail.com',
        workspaceId: 'workspace-1',
      },
    });
    vi.clearAllMocks();
  });

  it('does not subscribe realtime when realtime toggle is disabled', async () => {
    vi.mocked(useRealtimeUpdatesEnabled).mockReturnValue(false);
    vi.mocked(api.getPlannedGoalsByDate).mockResolvedValue([]);

    render(<GoalsPage />);

    await waitFor(() => {
      expect(api.getPlannedGoalsByDate).toHaveBeenCalled();
    });

    expect(createRealtimeSocket).not.toHaveBeenCalled();
  });

  it('cleans up connect and workspace listeners on unmount', async () => {
    vi.mocked(useRealtimeUpdatesEnabled).mockReturnValue(true);
    vi.mocked(api.getPlannedGoalsByDate).mockResolvedValue([]);

    const { unmount } = render(<GoalsPage />);

    await waitFor(() => {
      expect(createRealtimeSocket).toHaveBeenCalled();
    });

    const socket = vi.mocked(createRealtimeSocket).mock.results[0]?.value;
    expect(socket).toBeDefined();

    unmount();

    expect(socket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('workspace:goal-updated', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('workspace:progress-updated', expect.any(Function));
  });
});
