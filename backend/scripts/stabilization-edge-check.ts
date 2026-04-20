import { PrismaClient } from '@prisma/client';
import { runPreferenceBasedReminderSweep } from '../src/modules/notifications/notification.service.js';

type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    workspaceId: string;
  };
};

const BASE_URL = process.env.STUDYSYNC_API_URL ?? 'http://localhost:4010/api';
const WORKSPACE_SLUG = process.env.SEED_WORKSPACE_SLUG ?? 'my-accountability-circle';
const TODAY = new Date().toISOString().slice(0, 10);

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${payload.message ?? 'unknown error'}`);
  }

  return payload as T;
}

async function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      workspaceSlug: WORKSPACE_SLUG,
    }),
  });
}

function formatHmInTimezone(date: Date, timezone: string, offsetMinutes = 0): string {
  const local = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(local);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

async function main() {
  const prisma = new PrismaClient();

  const results: Record<string, unknown> = {};

  const pranav = await login(process.env.SEED_USER1_EMAIL ?? 'user1@example.com', process.env.SEED_USER1_PASSWORD ?? 'changeme1');
  const partner = await login(process.env.SEED_USER2_EMAIL ?? 'user2@example.com', process.env.SEED_USER2_PASSWORD ?? 'changeme2');

  const pranavId = pranav.user.id;
  const partnerId = partner.user.id;

  const originalPranav = await prisma.user.findUniqueOrThrow({
    where: { id: pranavId },
    select: { googleId: true, timezone: true },
  });

  const originalPranavPrefs = await prisma.userPreference.findUniqueOrThrow({
    where: { userId: pranavId },
  });

  const partnerPrefs = await prisma.userPreference.upsert({
    where: { userId: partnerId },
    update: { workspaceId: pranav.user.workspaceId },
    create: { userId: partnerId, workspaceId: pranav.user.workspaceId },
  });

  const todaysGoals = await apiRequest<Array<{
    id: string;
    userId: string;
    title: string;
    unit: string;
    category: string;
    targetValue: number;
    progress: Array<{ completedValue: number; completed: boolean }>;
  }>>(`/planned-goals/by-date/${TODAY}`, {}, pranav.token);

  const createdTempGoalIds: Array<{ token: string; goalId: string }> = [];

  let pranavGoal = todaysGoals.find((goal) => goal.userId === pranavId);
  let partnerGoal = todaysGoals.find((goal) => goal.userId === partnerId);

  if (!pranavGoal) {
    const created = await apiRequest<{
      id: string;
      userId: string;
      title: string;
      unit: string;
      category: string;
      targetValue: number;
      progress: Array<{ completedValue: number; completed: boolean }>;
    }>(
      '/planned-goals',
      {
        method: 'POST',
        body: JSON.stringify({
          date: new Date(`${TODAY}T00:00:00.000Z`).toISOString(),
          title: `Temp Pranav Goal ${Date.now()}`,
          category: 'DSA',
          unit: 'PROBLEMS',
          targetValue: 2,
        }),
      },
      pranav.token,
    );
    createdTempGoalIds.push({ token: pranav.token, goalId: created.id });

    pranavGoal = {
      ...created,
      progress: [{ completedValue: 0, completed: false }],
    };
  }

  if (!partnerGoal) {
    const created = await apiRequest<{
      id: string;
      userId: string;
      title: string;
      unit: string;
      category: string;
      targetValue: number;
      progress: Array<{ completedValue: number; completed: boolean }>;
    }>(
      '/planned-goals',
      {
        method: 'POST',
        body: JSON.stringify({
          date: new Date(`${TODAY}T00:00:00.000Z`).toISOString(),
          title: `Temp Partner Goal ${Date.now()}`,
          category: 'DSA',
          unit: 'PROBLEMS',
          targetValue: 2,
        }),
      },
      partner.token,
    );
    createdTempGoalIds.push({ token: partner.token, goalId: created.id });

    partnerGoal = {
      ...created,
      progress: [{ completedValue: 0, completed: false }],
    };
  }

  if (!pranavGoal || !partnerGoal) {
    throw new Error('Could not find both Pranav and Partner goals for today.');
  }

  const originalPranavGoalProgress = {
    completedValue: pranavGoal.progress[0]?.completedValue ?? 0,
    completed: pranavGoal.progress[0]?.completed ?? false,
  };

  const originalPartnerGoalProgress = {
    completedValue: partnerGoal.progress[0]?.completedValue ?? 0,
    completed: partnerGoal.progress[0]?.completed ?? false,
  };

  try {
    // Case 1: Existing password user + Google linking simulation
    const beforeCount = await prisma.user.count({ where: { email: process.env.SEED_USER1_EMAIL ?? 'user1@example.com' } });
    const beforeMemberships = await prisma.membership.count({ where: { userId: pranavId } });

    const simulatedGoogleId = `sim-google-${Date.now()}`;
    await prisma.user.update({
      where: { id: pranavId },
      data: { googleId: simulatedGoogleId },
    });

    const passwordLoginAfterLink = await login(process.env.SEED_USER1_EMAIL ?? 'user1@example.com', process.env.SEED_USER1_PASSWORD ?? 'changeme1');

    const afterCount = await prisma.user.count({ where: { email: process.env.SEED_USER1_EMAIL ?? 'user1@example.com' } });
    const afterMemberships = await prisma.membership.count({ where: { userId: pranavId } });

    results.googleLinking = {
      duplicateUserCreated: afterCount !== beforeCount,
      passwordLoginStillWorks: Boolean(passwordLoginAfterLink.token),
      sameUserIdAfterLogin: passwordLoginAfterLink.user.id === pranavId,
      workspaceMembershipPreserved: beforeMemberships === afterMemberships,
      loginMethodFromPasswordFlow: passwordLoginAfterLink.user,
    };

    // Case 2: Quiet-hours suppression and resume
    const beforeQuietRun = await apiRequest<{ myAlerts: Array<{ id: string }>; partnerAlerts: Array<{ id: string }> }>(
      `/notifications?date=${TODAY}`,
      {},
      pranav.token,
    );
    const beforeQuietCount = beforeQuietRun.myAlerts.length + beforeQuietRun.partnerAlerts.length;

    await apiRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        profile: { timezone: 'Asia/Kolkata' },
        notificationPreferences: {
          remindSelfPendingGoals: true,
          remindPartnerPendingGoals: true,
          quietHoursEnabled: true,
          quietHoursStart: '00:00',
          quietHoursEnd: '00:00',
          middayReminderEnabled: true,
          eveningReminderEnabled: false,
        },
        accountabilityPreferences: {
          notifyWhenPartnerBehind: true,
          notifyWhenPartnerCompletedAll: true,
          notifyWhenSelfCompletedAll: true,
          dailySummaryEnabled: true,
        },
      }),
    }, pranav.token);

    await apiRequest(`/planned-goals/${partnerGoal.id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ completedValue: 0 }),
    }, partner.token);

    await apiRequest(`/planned-goals/${pranavGoal.id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ completedValue: 0 }),
    }, pranav.token);

    const afterQuietRun = await apiRequest<{ myAlerts: Array<{ id: string }>; partnerAlerts: Array<{ id: string }> }>(
      `/notifications?date=${TODAY}`,
      {},
      pranav.token,
    );
    const afterQuietCount = afterQuietRun.myAlerts.length + afterQuietRun.partnerAlerts.length;

    await apiRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        notificationPreferences: {
          quietHoursEnabled: false,
        },
      }),
    }, pranav.token);

    await apiRequest(`/planned-goals/${partnerGoal.id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ completedValue: partnerGoal.targetValue }),
    }, partner.token);

    await apiRequest(`/planned-goals/${pranavGoal.id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ completedValue: pranavGoal.targetValue }),
    }, pranav.token);

    const afterResumeRun = await apiRequest<{ myAlerts: Array<{ id: string }>; partnerAlerts: Array<{ id: string }> }>(
      `/notifications?date=${TODAY}`,
      {},
      pranav.token,
    );
    const afterResumeCount = afterResumeRun.myAlerts.length + afterResumeRun.partnerAlerts.length;

    // Timezone trigger behavior around local reminder time
    const now = new Date();
    const farTime = formatHmInTimezone(now, 'Asia/Kolkata', 90);
    const nearTime = formatHmInTimezone(now, 'Asia/Kolkata', 0);

    await apiRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        profile: { timezone: 'Asia/Kolkata' },
        notificationPreferences: {
          middayReminderEnabled: true,
          eveningReminderEnabled: false,
          middayReminderTime: farTime,
          quietHoursEnabled: false,
        },
      }),
    }, pranav.token);

    const farSweep = await runPreferenceBasedReminderSweep(now);

    await apiRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        profile: { timezone: 'Asia/Kolkata' },
        notificationPreferences: {
          middayReminderEnabled: true,
          eveningReminderEnabled: false,
          middayReminderTime: nearTime,
          quietHoursEnabled: false,
        },
      }),
    }, pranav.token);

    const nearSweep = await runPreferenceBasedReminderSweep(now);

    results.quietHours = {
      suppressedDuringQuietHours: afterQuietCount === beforeQuietCount,
      resumedOutsideQuietHours: afterResumeCount > afterQuietCount,
      counts: {
        beforeQuietCount,
        afterQuietCount,
        afterResumeCount,
      },
      timezoneSweepComparison: {
        farSweepDispatchCount: farSweep.dispatchCount,
        nearSweepDispatchCount: nearSweep.dispatchCount,
        nearGreaterOrEqualFar: nearSweep.dispatchCount >= farSweep.dispatchCount,
      },
    };

    // Case 4: Settings persistence
    const settingsPayload = {
      profile: {
        timezone: 'Asia/Kolkata',
      },
      notificationPreferences: {
        remindSelfPendingGoals: true,
        remindPartnerPendingGoals: true,
        middayReminderEnabled: true,
        eveningReminderEnabled: true,
        middayReminderTime: '14:10',
        eveningReminderTime: '19:40',
        quietHoursEnabled: true,
        quietHoursStart: '22:30',
        quietHoursEnd: '06:30',
        browserNotificationsEnabled: false,
      },
      accountabilityPreferences: {
        notifyWhenPartnerBehind: true,
        notifyWhenPartnerCompletedAll: true,
        notifyWhenSelfCompletedAll: true,
        realtimePartnerUpdatesEnabled: false,
        dailySummaryEnabled: true,
      },
    };

    await apiRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify(settingsPayload),
    }, pranav.token);

    const persisted = await apiRequest<{
      profile: { timezone: string };
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
    }>('/settings', {}, pranav.token);

    results.settingsPersistence = {
      timezonePersisted: persisted.profile.timezone === settingsPayload.profile.timezone,
      notificationPrefsPersisted:
        persisted.notificationPreferences.middayReminderTime === settingsPayload.notificationPreferences.middayReminderTime &&
        persisted.notificationPreferences.eveningReminderTime === settingsPayload.notificationPreferences.eveningReminderTime &&
        persisted.notificationPreferences.quietHoursEnabled === settingsPayload.notificationPreferences.quietHoursEnabled &&
        persisted.notificationPreferences.remindSelfPendingGoals === settingsPayload.notificationPreferences.remindSelfPendingGoals &&
        persisted.notificationPreferences.remindPartnerPendingGoals === settingsPayload.notificationPreferences.remindPartnerPendingGoals,
      accountabilityPersisted:
        persisted.accountabilityPreferences.realtimePartnerUpdatesEnabled === settingsPayload.accountabilityPreferences.realtimePartnerUpdatesEnabled &&
        persisted.accountabilityPreferences.notifyWhenPartnerBehind === settingsPayload.accountabilityPreferences.notifyWhenPartnerBehind,
      persisted,
    };

    // Case 5: Partner alert correctness
    await apiRequest(`/planned-goals/${partnerGoal.id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ completedValue: 0 }),
    }, partner.token);

    const partnerBehind = await apiRequest<{
      partnerAlerts: Array<{ id: string; title: string; message: string; type: string }>;
    }>(`/notifications?date=${TODAY}`, {}, pranav.token);

    await apiRequest(`/planned-goals/${partnerGoal.id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    }, partner.token);

    const partnerCompleted = await apiRequest<{
      partnerAlerts: Array<{ id: string; title: string; message: string; type: string }>;
    }>(`/notifications?date=${TODAY}`, {}, pranav.token);

    const noGoalsDate = '2099-01-01';
    const noGoalsContext = await apiRequest<{
      dynamicContext: {
        partnerSummaries: Array<{ totalGoals: number; pendingGoals: number; remainingGoalTitles: string[] }>;
      };
    }>(`/notifications?date=${noGoalsDate}`, {}, pranav.token);

    results.partnerAlerts = {
      caseA_partnerBehind_latest: partnerBehind.partnerAlerts[0] ?? null,
      caseB_partnerCompleted_latest: partnerCompleted.partnerAlerts[0] ?? null,
      caseC_noPartnerGoalsSummary: noGoalsContext.dynamicContext.partnerSummaries[0] ?? null,
      caseC_noMisleadingBehind:
        (noGoalsContext.dynamicContext.partnerSummaries[0]?.totalGoals ?? 0) === 0 &&
        (noGoalsContext.dynamicContext.partnerSummaries[0]?.pendingGoals ?? 0) === 0,
    };
  } finally {
    // Restore mutable records touched by the verification script
    await prisma.user.update({
      where: { id: pranavId },
      data: { googleId: originalPranav.googleId, timezone: originalPranav.timezone },
    });

    await prisma.userPreference.update({
      where: { userId: pranavId },
      data: {
        workspaceId: originalPranavPrefs.workspaceId,
        remindSelfPendingGoals: originalPranavPrefs.remindSelfPendingGoals,
        remindPartnerPendingGoals: originalPranavPrefs.remindPartnerPendingGoals,
        middayReminderEnabled: originalPranavPrefs.middayReminderEnabled,
        eveningReminderEnabled: originalPranavPrefs.eveningReminderEnabled,
        middayReminderTime: originalPranavPrefs.middayReminderTime,
        eveningReminderTime: originalPranavPrefs.eveningReminderTime,
        quietHoursEnabled: originalPranavPrefs.quietHoursEnabled,
        quietHoursStart: originalPranavPrefs.quietHoursStart,
        quietHoursEnd: originalPranavPrefs.quietHoursEnd,
        browserNotificationsEnabled: originalPranavPrefs.browserNotificationsEnabled,
        notifyWhenPartnerBehind: originalPranavPrefs.notifyWhenPartnerBehind,
        notifyWhenPartnerCompletedAll: originalPranavPrefs.notifyWhenPartnerCompletedAll,
        notifyWhenSelfCompletedAll: originalPranavPrefs.notifyWhenSelfCompletedAll,
        realtimePartnerUpdatesEnabled: originalPranavPrefs.realtimePartnerUpdatesEnabled,
        dailySummaryEnabled: originalPranavPrefs.dailySummaryEnabled,
      },
    });

    await prisma.userPreference.update({
      where: { userId: partnerId },
      data: {
        workspaceId: partnerPrefs.workspaceId,
        remindSelfPendingGoals: partnerPrefs.remindSelfPendingGoals,
        remindPartnerPendingGoals: partnerPrefs.remindPartnerPendingGoals,
        middayReminderEnabled: partnerPrefs.middayReminderEnabled,
        eveningReminderEnabled: partnerPrefs.eveningReminderEnabled,
        middayReminderTime: partnerPrefs.middayReminderTime,
        eveningReminderTime: partnerPrefs.eveningReminderTime,
        quietHoursEnabled: partnerPrefs.quietHoursEnabled,
        quietHoursStart: partnerPrefs.quietHoursStart,
        quietHoursEnd: partnerPrefs.quietHoursEnd,
        browserNotificationsEnabled: partnerPrefs.browserNotificationsEnabled,
        notifyWhenPartnerBehind: partnerPrefs.notifyWhenPartnerBehind,
        notifyWhenPartnerCompletedAll: partnerPrefs.notifyWhenPartnerCompletedAll,
        notifyWhenSelfCompletedAll: partnerPrefs.notifyWhenSelfCompletedAll,
        realtimePartnerUpdatesEnabled: partnerPrefs.realtimePartnerUpdatesEnabled,
        dailySummaryEnabled: partnerPrefs.dailySummaryEnabled,
      },
    });

    if (pranavGoal) {
      await apiRequest(`/planned-goals/${pranavGoal.id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({
          completedValue: originalPranavGoalProgress.completedValue,
          completed: originalPranavGoalProgress.completed,
        }),
      }, pranav.token).catch(() => undefined);
    }

    if (partnerGoal) {
      await apiRequest(`/planned-goals/${partnerGoal.id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({
          completedValue: originalPartnerGoalProgress.completedValue,
          completed: originalPartnerGoalProgress.completed,
        }),
      }, partner.token).catch(() => undefined);
    }

    for (const tempGoal of createdTempGoalIds) {
      await apiRequest(`/planned-goals/${tempGoal.goalId}`, {
        method: 'DELETE',
      }, tempGoal.token).catch(() => undefined);
    }

    await prisma.$disconnect();
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
