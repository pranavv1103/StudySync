function normalizeApiBaseUrl(value?: string): string {
  const candidate = value?.trim();
  if (!candidate) {
    return '/api';
  }

  return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate;
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

type AuthUser = {
  id: string;
  name: string;
  email: string;
  timezone?: string;
  avatarUrl?: string | null;
  workspaceId?: string;
  workspaceRole?: string;
  loginMethod?: 'GOOGLE' | 'PASSWORD';
};

export type PlannedGoal = {
  id: string;
  userId: string;
  title: string;
  category: string;
  unit: string;
  targetValue: number;
  date: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  notes?: string;
  progress: Array<{
    id: string;
    completedValue: number;
    completed: boolean;
    completedAt?: string;
  }>;
};

export type DynamicDailyGoalSummary = {
  userId: string;
  date: string;
  totalGoals: number;
  completedGoals: number;
  pendingGoals: number;
  completionPercentage: number;
  targetTotal: number;
  completedTotal: number;
  remainingGoalTitles: string[];
  groupedCategories: Array<{
    category: string;
    goals: number;
    completedGoals: number;
    targetTotal: number;
    completedTotal: number;
    completionPercentage: number;
  }>;
  goals: Array<{
    id: string;
    title: string;
    category: string;
    unit: string;
    targetValue: number;
    completedValue: number;
    completed: boolean;
    remainingValue: number;
    date: string;
  }>;
  streak: {
    currentStreakDays: number;
    bestStreakDays: number;
    missedDayCount: number;
  } | null;
};

export type LoginPayload = {
  email: string;
  password: string;
  workspaceSlug?: string;
};

export type SignupPayload = {
  name: string;
  email: string;
  password: string;
  workspaceSlug?: string;
};

export type SettingsResponse = {
  profile: {
    name: string;
    email: string;
    timezone: string;
    avatarUrl: string | null;
  };
  authentication: {
    loginMethod: 'GOOGLE' | 'PASSWORD';
    googleLinked: boolean;
  };
  notificationPreferences: {
    remindSelfPendingGoals: boolean;
    remindPartnerPendingGoals: boolean;
    middayReminderEnabled: boolean;
    eveningReminderEnabled: boolean;
    middayReminderTime: string;
    eveningReminderTime: string;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    browserNotificationsEnabled: boolean;
  };
  accountabilityPreferences: {
    notifyWhenPartnerBehind: boolean;
    notifyWhenPartnerCompletedAll: boolean;
    notifyWhenSelfCompletedAll: boolean;
    realtimePartnerUpdatesEnabled: boolean;
    dailySummaryEnabled: boolean;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    type: 'PARTNER' | 'TEAM';
    partner: {
      id: string;
      name: string;
      email: string;
    } | null;
    teamModePlanned: boolean;
  };
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? 'Request failed.');
  }

  return payload as T;
}

export const api = {
  login(payload: LoginPayload) {
    return request<{
      token: string;
      user: AuthUser;
    }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  signup(payload: SignupPayload) {
    return request<{
      token: string;
      user: AuthUser;
    }>(
      '/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  loginWithGoogle(payload: { idToken: string; workspaceSlug?: string }) {
    return request<{
      token: string;
      user: AuthUser;
    }>(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  me(token: string) {
    return request<{ user: AuthUser }>('/auth/me', {}, token);
  },
  getDashboard(token: string, date: string) {
    return request<{
      date: string;
      workspaceId: string;
      currentUserId: string;
      members: Array<{
        user: { id: string; name: string; email: string };
        role: string;
        summary: DynamicDailyGoalSummary;
      }>;
    }>(`/dashboard?date=${date}`, {}, token);
  },
  getPlannedGoalsByDate(token: string, date: string) {
    return request<PlannedGoal[]>(`/planned-goals/by-date/${date}`, {}, token);
  },
  getPlannedGoalsByWeek(token: string, weekStartDate: string) {
    return request<PlannedGoal[]>(`/planned-goals/by-week/${weekStartDate}`, {}, token);
  },
  createPlannedGoal(
    token: string,
    payload: {
      date: string;
      title: string;
      category: string;
      unit: string;
      targetValue: number;
      notes?: string;
    },
  ) {
    return request<PlannedGoal>(
      '/planned-goals',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  updatePlannedGoal(
    token: string,
    goalId: string,
    payload: {
      title?: string;
      category?: string;
      unit?: string;
      targetValue?: number;
      notes?: string;
      status?: string;
    },
  ) {
    return request<PlannedGoal>(
      `/planned-goals/${goalId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  deletePlannedGoal(token: string, goalId: string) {
    return request<void>(`/planned-goals/${goalId}`, { method: 'DELETE' }, token);
  },
  updatePlannedGoalProgress(
    token: string,
    goalId: string,
    payload: { completedValue?: number; completed?: boolean; notes?: string },
  ) {
    return request<{ progress: unknown; plannedGoal: PlannedGoal }>(
      `/planned-goals/${goalId}/progress`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  upsertGoal(token: string, payload: {
    date: string;
    targetDsaCount: number;
    targetJobAppsCount: number;
    targetSystemDesignCount: number;
    customGoalText?: string;
  }) {
    return request('/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
    getNotifications(token: string, date?: string) {
    return request<{
      myAlerts: Array<{
        id: string;
        title: string;
        message: string;
        type: string;
        audience: string;
        isRead: boolean;
        createdAt: string;
      }>;
      partnerAlerts: Array<{
        id: string;
        title: string;
        message: string;
        type: string;
        audience: string;
        isRead: boolean;
        createdAt: string;
      }>;
      dynamicContext: {
        date: string;
        mySummary: DynamicDailyGoalSummary;
        partnerSummaries: DynamicDailyGoalSummary[];
      };
    }>(`/notifications${date ? `?date=${date}` : ''}`, {}, token);
  },
  markNotificationRead(token: string, notificationId: string) {
    return request(`/notifications/${notificationId}/read`, { method: 'PATCH' }, token);
  },
  markAllNotificationsRead(token: string, audience?: 'SELF' | 'PARTNER') {
    return request<{ message: string; count: number }>(
      '/notifications/read-all',
      {
        method: 'PATCH',
        body: JSON.stringify(audience ? { audience } : {}),
      },
      token,
    );
  },
  getAnalytics(token: string, days = 7, date?: string) {
    return request<{
      trend: Array<{
        date: string;
        selfPercent: number;
        partnerPercent: number;
        selfCompletedGoals: number;
        selfTotalGoals: number;
      }>;
      summary: {
        date: string;
        todayPercent: number;
        hasGoalToday: boolean;
        completedGoalsToday: number;
        totalGoalsToday: number;
        averageCompletion: number;
        currentStreakDays: number;
        bestStreakDays: number;
        missedDayCount: number;
        remainingGoalTitles: string[];
        groupedCategories: DynamicDailyGoalSummary['groupedCategories'];
      };
    }>(`/analytics?days=${days}${date ? `&date=${date}` : ''}`, {}, token);
  },
  getSettings(token: string) {
    return request<SettingsResponse>('/settings', {}, token);
  },
  updateSettings(
    token: string,
    payload: {
      profile?: {
        name?: string;
        timezone?: string;
        avatarUrl?: string | null;
      };
      notificationPreferences?: Partial<SettingsResponse['notificationPreferences']>;
      accountabilityPreferences?: Partial<SettingsResponse['accountabilityPreferences']>;
    },
  ) {
    return request<{ message: string }>(
      '/settings',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  async uploadAvatar(token: string, file: File) {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`${API_BASE_URL}/settings/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message ?? 'Avatar upload failed.');
    }

    return payload as { message: string; avatarUrl: string };
  },
};
