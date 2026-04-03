import { create } from 'zustand';

type User = {
  id: string;
  name: string;
  email: string;
  timezone?: string;
  avatarUrl?: string | null;
  workspaceId?: string;
  workspaceRole?: string;
  loginMethod?: 'GOOGLE' | 'PASSWORD';
};

type AuthState = {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
};

const storageKey = 'studysync-auth';

function loadPersistedAuth(): Pick<AuthState, 'token' | 'user'> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { token: null, user: null };
    }

    return JSON.parse(raw) as Pick<AuthState, 'token' | 'user'>;
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const initialState =
    typeof window === 'undefined' ? { token: null, user: null } : loadPersistedAuth();

  return {
    token: initialState.token,
    user: initialState.user,
    setAuth: (token, user) => {
      localStorage.setItem(storageKey, JSON.stringify({ token, user }));
      set({ token, user });
    },
    clearAuth: () => {
      localStorage.removeItem(storageKey);
      set({ token: null, user: null });
    },
  };
});
