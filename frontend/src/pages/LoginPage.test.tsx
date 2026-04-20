import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { LoginPage } from './LoginPage';

vi.mock('../lib/api', () => ({
  api: {
    login: vi.fn(),
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null });
    vi.clearAllMocks();
  });

  it('logs in and navigates to dashboard route', async () => {
    vi.mocked(api.login).mockResolvedValue({
      token: 'test-token',
      user: {
        id: 'u1',
        name: 'Pranav',
        email: 'test@example.com',
        workspaceId: 'w1',
        workspaceRole: 'OWNER',
      },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await screen.findByText('Dashboard Route');

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('test-token');
    });
  });
});
