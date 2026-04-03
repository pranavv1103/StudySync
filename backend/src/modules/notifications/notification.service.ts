import { prisma } from '../../lib/prisma.js';
import { emitUserEvent } from '../../lib/socket.js';
import { getDailyGoalSummary } from '../plannedGoals/plannedGoals.service.js';

type RemainingTasks = {
  dsa: number;
  jobApps: number;
  systemDesign: number;
};

type ProgressInput = {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  overallPercent: number;
  remaining: RemainingTasks;
  completed: {
    dsa: number;
    jobApps: number;
    systemDesign: number;
  };
};

type DynamicGoalNotificationInput = {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  date: Date;
  now?: Date;
  trigger?: 'MANUAL' | 'MIDDAY' | 'EVENING';
};

type RecipientPreferenceContext = {
  userId: string;
  timezone: string;
  remindSelfPendingGoals: boolean;
  remindPartnerPendingGoals: boolean;
  middayReminderEnabled: boolean;
  eveningReminderEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notifyWhenPartnerBehind: boolean;
  notifyWhenPartnerCompletedAll: boolean;
  notifyWhenSelfCompletedAll: boolean;
  dailySummaryEnabled: boolean;
};

function buildRemainingParts(remaining: RemainingTasks, subject: string): string[] {
  const parts: string[] = [];

  if (remaining.dsa > 0) {
    parts.push(`${subject}solve ${remaining.dsa} more DSA problem${remaining.dsa === 1 ? '' : 's'}`);
  }

  if (remaining.jobApps > 0) {
    parts.push(`${subject}apply to ${remaining.jobApps} more job${remaining.jobApps === 1 ? '' : 's'}`);
  }

  if (remaining.systemDesign > 0) {
    parts.push(
      `${subject}complete ${remaining.systemDesign} more system design topic${
        remaining.systemDesign === 1 ? '' : 's'
      }`,
    );
  }

  return parts;
}

function joinSentence(parts: string[]): string {
  if (parts.length === 0) {
    return '';
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }

  return `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
}

function createSelfAlert(input: ProgressInput) {
  const { overallPercent, remaining } = input;
  const hasStarted = input.completed.dsa + input.completed.jobApps + input.completed.systemDesign > 0;

  if (overallPercent >= 100) {
    return {
      type: 'SELF_COMPLETION_ALERT' as const,
      title: 'All Targets Completed',
      message: 'You completed all your targets for today. Great job staying accountable.',
    };
  }

  if (!hasStarted) {
    return {
      type: 'MISSED_GOAL_ALERT' as const,
      title: 'You Have Not Started Yet',
      message:
        'You have not started today\'s goals yet. Start with one task now to build momentum.',
    };
  }

  const remainingText = joinSentence(buildRemainingParts(remaining, ''));

  if (overallPercent < 50) {
    return {
      type: 'SELF_PROGRESS_ALERT' as const,
      title: 'Urgent: You Are Behind Today',
      message: `You completed ${overallPercent.toFixed(2)}% of today\'s goals. You still need to ${remainingText} before end of day.`,
    };
  }

  return {
    type: 'ON_TRACK_ALERT' as const,
    title: 'You Are On Track',
    message: `You completed ${overallPercent.toFixed(2)}% of today\'s goals. Keep the momentum and ${remainingText}.`,
  };
}

function createPartnerAlert(input: ProgressInput) {
  const { actorName, overallPercent, remaining } = input;
  const hasStarted = input.completed.dsa + input.completed.jobApps + input.completed.systemDesign > 0;

  if (overallPercent >= 100) {
    return {
      type: 'PARTNER_COMPLETION_ALERT' as const,
      title: `${actorName} Completed All Goals`,
      message: `Your accountability buddy ${actorName} completed all daily targets. Appreciate the consistency and keep pushing together.`,
    };
  }

  if (!hasStarted) {
    return {
      type: 'PARTNER_PROGRESS_ALERT' as const,
      title: `${actorName} Has Not Started Yet`,
      message: `${actorName} has not started today's goals yet. Send a quick nudge to help them begin.`,
    };
  }

  const remainingText = joinSentence(buildRemainingParts(remaining, `${actorName} still needs to `));

  if (overallPercent < 50) {
    return {
      type: 'PARTNER_PROGRESS_ALERT' as const,
      title: `${actorName} Needs A Push`,
      message: `${actorName} completed ${overallPercent.toFixed(2)}% of today\'s target. ${remainingText}. Push them to finish before end of day.`,
    };
  }

  return {
    type: 'PARTNER_PROGRESS_ALERT' as const,
    title: `${actorName} Is On Track`,
    message: `${actorName} completed ${overallPercent.toFixed(2)}% of today\'s target. ${remainingText}.`,
  };
}

export async function createProgressNotifications(input: ProgressInput) {
  const selfAlert = createSelfAlert(input);
  const partnerAlert = createPartnerAlert(input);

  const recipients = await prisma.membership.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
    select: {
      userId: true,
    },
  });

  const partnerRecipients = recipients
    .map((recipient: { userId: string }) => recipient.userId)
    .filter((userId: string) => userId !== input.actorUserId);

  const notifications = await prisma.$transaction([
    prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        recipientId: input.actorUserId,
        actorUserId: input.actorUserId,
        audience: 'SELF',
        type: selfAlert.type,
        title: selfAlert.title,
        message: selfAlert.message,
        metadata: {
          overallPercent: input.overallPercent,
          remaining: input.remaining,
        },
      },
    }),
    ...partnerRecipients.map((recipientId: string) =>
      prisma.notification.create({
        data: {
          workspaceId: input.workspaceId,
          recipientId,
          actorUserId: input.actorUserId,
          audience: 'PARTNER',
          type: partnerAlert.type,
          title: partnerAlert.title,
          message: partnerAlert.message,
          metadata: {
            actorName: input.actorName,
            overallPercent: input.overallPercent,
            remaining: input.remaining,
          },
        },
      }),
    ),
  ]);

  for (const notification of notifications) {
    emitUserEvent(notification.recipientId, 'notification:new', notification);
  }

  return notifications;
}

function createDynamicSelfAlert(input: {
  actorName: string;
  completionPercentage: number;
  pendingGoals: number;
  completedGoals: number;
  totalGoals: number;
  remainingGoalTitles: string[];
}) {
  if (input.totalGoals === 0) {
    return {
      type: 'SELF_PROGRESS_ALERT' as const,
      title: 'No Goals Planned',
      message: 'You do not have any goals for this date. Add goals to keep momentum.',
    };
  }

  if (input.pendingGoals === 0) {
    return {
      type: 'SELF_COMPLETION_ALERT' as const,
      title: 'All Daily Goals Completed',
      message: `Amazing work. You completed all ${input.totalGoals} planned goals today.`,
    };
  }

  const titleSuffix = input.pendingGoals === 1 ? 'goal' : 'goals';
  const nextFocus = input.remainingGoalTitles.slice(0, 2).join(', ');

  return {
    type: input.completionPercentage < 50 ? ('MISSED_GOAL_ALERT' as const) : ('ON_TRACK_ALERT' as const),
    title: `${input.pendingGoals} Pending ${titleSuffix}`,
    message:
      input.completionPercentage < 50
        ? `You are at ${input.completionPercentage.toFixed(2)}% completion. Focus next on: ${nextFocus || 'your pending goals'}.`
        : `You are at ${input.completionPercentage.toFixed(2)}% completion. Keep going: ${nextFocus || 'finish pending goals'}.`,
  };
}

function createDynamicPartnerAlert(input: {
  actorName: string;
  completionPercentage: number;
  pendingGoals: number;
  completedGoals: number;
  totalGoals: number;
  remainingGoalTitles: string[];
}) {
  if (input.totalGoals === 0) {
    return {
      type: 'PARTNER_PROGRESS_ALERT' as const,
      title: `${input.actorName} Has No Goals Planned`,
      message: `${input.actorName} has no planned goals for this date. Encourage your accountability buddy to plan together.`,
    };
  }

  if (input.pendingGoals === 0) {
    return {
      type: 'PARTNER_COMPLETION_ALERT' as const,
      title: `${input.actorName} Completed All Goals`,
      message: `${input.actorName} completed all ${input.totalGoals} planned goals. Great accountability buddy energy!`,
    };
  }

  const nextFocus = input.remainingGoalTitles.slice(0, 2).join(', ');
  return {
    type: 'PARTNER_PROGRESS_ALERT' as const,
    title: `${input.actorName}: ${input.pendingGoals} Goals Pending`,
    message: `${input.actorName} is at ${input.completionPercentage.toFixed(2)}%. Remaining: ${nextFocus || 'pending goals'}.`,
  };
}

function parseHmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function shouldTriggerAtLocalTime(targetHm: string, timezone: string, now: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone || 'UTC',
  });

  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  const nowMinutes = hour * 60 + minute;
  const targetMinutes = parseHmToMinutes(targetHm);

  return Math.abs(nowMinutes - targetMinutes) <= 5;
}

function getNowMinutesInTimezone(timezone: string, now = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone || 'UTC',
  });

  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function isWithinQuietHours(pref: RecipientPreferenceContext, now = new Date()): boolean {
  if (!pref.quietHoursEnabled) {
    return false;
  }

  const start = parseHmToMinutes(pref.quietHoursStart);
  const end = parseHmToMinutes(pref.quietHoursEnd);
  const nowMinutes = getNowMinutesInTimezone(pref.timezone, now);

  if (start === end) {
    return true;
  }

  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }

  return nowMinutes >= start || nowMinutes < end;
}

function isTriggerEnabled(pref: RecipientPreferenceContext, trigger: 'MANUAL' | 'MIDDAY' | 'EVENING'): boolean {
  if (trigger === 'MANUAL') {
    return true;
  }

  if (!pref.dailySummaryEnabled) {
    return false;
  }

  if (trigger === 'MIDDAY') {
    return pref.middayReminderEnabled;
  }

  return pref.eveningReminderEnabled;
}

async function shouldCreateDynamicNotification(input: {
  workspaceId: string;
  recipientId: string;
  actorUserId: string;
  type: string;
  dateIso: string;
  pendingGoals: number;
  completionPercentage: number;
}): Promise<boolean> {
  const threshold = new Date(Date.now() - 90 * 60 * 1000);

  const latest = await prisma.notification.findFirst({
    where: {
      workspaceId: input.workspaceId,
      recipientId: input.recipientId,
      actorUserId: input.actorUserId,
      createdAt: {
        gte: threshold,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!latest || !latest.metadata) {
    return true;
  }

  // If the latest alert is for a different state/type, allow this one so
  // transitions like pending -> completed always produce a new signal.
  if (latest.type !== input.type) {
    return true;
  }

  const metadata = latest.metadata as {
    date?: string;
    pendingGoals?: number;
    completionPercentage?: number;
  };

  return !(
    metadata.date === input.dateIso &&
    metadata.pendingGoals === input.pendingGoals &&
    Number(metadata.completionPercentage ?? -1) === Number(input.completionPercentage)
  );
}

export async function createDynamicGoalNotifications(input: DynamicGoalNotificationInput) {
  const summary = await getDailyGoalSummary(input.actorUserId, input.date, input.workspaceId);
  const trigger = input.trigger ?? 'MANUAL';
  const evaluationTime = input.now ?? new Date();

  const selfAlert = createDynamicSelfAlert({
    actorName: input.actorName,
    completionPercentage: summary.completionPercentage,
    pendingGoals: summary.pendingGoals,
    completedGoals: summary.completedGoals,
    totalGoals: summary.totalGoals,
    remainingGoalTitles: summary.remainingGoalTitles,
  });

  const partnerAlert = createDynamicPartnerAlert({
    actorName: input.actorName,
    completionPercentage: summary.completionPercentage,
    pendingGoals: summary.pendingGoals,
    completedGoals: summary.completedGoals,
    totalGoals: summary.totalGoals,
    remainingGoalTitles: summary.remainingGoalTitles,
  });

  const recipients = await prisma.membership.findMany({
    where: {
      workspaceId: input.workspaceId,
    },
    include: {
      user: {
        select: {
          id: true,
          timezone: true,
          preferences: {
            select: {
              remindSelfPendingGoals: true,
              remindPartnerPendingGoals: true,
              middayReminderEnabled: true,
              eveningReminderEnabled: true,
              quietHoursEnabled: true,
              quietHoursStart: true,
              quietHoursEnd: true,
              notifyWhenPartnerBehind: true,
              notifyWhenPartnerCompletedAll: true,
              notifyWhenSelfCompletedAll: true,
              dailySummaryEnabled: true,
            },
          },
        },
      },
    },
  });

  const toPreferenceContext = (recipient: {
    userId: string;
    user: {
      timezone: string;
      preferences: {
        remindSelfPendingGoals: boolean;
        remindPartnerPendingGoals: boolean;
        middayReminderEnabled: boolean;
        eveningReminderEnabled: boolean;
        quietHoursEnabled: boolean;
        quietHoursStart: string;
        quietHoursEnd: string;
        notifyWhenPartnerBehind: boolean;
        notifyWhenPartnerCompletedAll: boolean;
        notifyWhenSelfCompletedAll: boolean;
        dailySummaryEnabled: boolean;
      } | null;
    };
  }): RecipientPreferenceContext => ({
    userId: recipient.userId,
    timezone: recipient.user.timezone || 'UTC',
    remindSelfPendingGoals: recipient.user.preferences?.remindSelfPendingGoals ?? true,
    remindPartnerPendingGoals: recipient.user.preferences?.remindPartnerPendingGoals ?? true,
    middayReminderEnabled: recipient.user.preferences?.middayReminderEnabled ?? true,
    eveningReminderEnabled: recipient.user.preferences?.eveningReminderEnabled ?? true,
    quietHoursEnabled: recipient.user.preferences?.quietHoursEnabled ?? false,
    quietHoursStart: recipient.user.preferences?.quietHoursStart ?? '22:00',
    quietHoursEnd: recipient.user.preferences?.quietHoursEnd ?? '07:00',
    notifyWhenPartnerBehind: recipient.user.preferences?.notifyWhenPartnerBehind ?? true,
    notifyWhenPartnerCompletedAll: recipient.user.preferences?.notifyWhenPartnerCompletedAll ?? true,
    notifyWhenSelfCompletedAll: recipient.user.preferences?.notifyWhenSelfCompletedAll ?? true,
    dailySummaryEnabled: recipient.user.preferences?.dailySummaryEnabled ?? true,
  });

  const dateIso = input.date.toISOString();
  const notifications = [];

  const selfRecipient = recipients.find((recipient) => recipient.userId === input.actorUserId);
  if (selfRecipient) {
    const pref = toPreferenceContext(selfRecipient as any);
    const selfAllowedByPref =
      summary.pendingGoals > 0 ? pref.remindSelfPendingGoals : pref.notifyWhenSelfCompletedAll;

    if (selfAllowedByPref && isTriggerEnabled(pref, trigger) && !isWithinQuietHours(pref, evaluationTime)) {
      const shouldCreate = await shouldCreateDynamicNotification({
        workspaceId: input.workspaceId,
        recipientId: input.actorUserId,
        actorUserId: input.actorUserId,
        type: selfAlert.type,
        dateIso,
        pendingGoals: summary.pendingGoals,
        completionPercentage: summary.completionPercentage,
      });

      if (shouldCreate) {
        const created = await prisma.notification.create({
          data: {
            workspaceId: input.workspaceId,
            recipientId: input.actorUserId,
            actorUserId: input.actorUserId,
            audience: 'SELF',
            type: selfAlert.type,
            title: selfAlert.title,
            message: selfAlert.message,
            metadata: {
              date: dateIso,
              trigger,
              completionPercentage: summary.completionPercentage,
              pendingGoals: summary.pendingGoals,
              completedGoals: summary.completedGoals,
              totalGoals: summary.totalGoals,
              remainingGoalTitles: summary.remainingGoalTitles,
            },
          },
        });
        notifications.push(created);
      }
    }
  }

  const partnerRecipients = recipients.filter((recipient) => recipient.userId !== input.actorUserId);
  for (const partnerRecipient of partnerRecipients) {
    const pref = toPreferenceContext(partnerRecipient as any);
    const partnerAllowedByPref =
      summary.pendingGoals === 0
        ? pref.notifyWhenPartnerCompletedAll
        : summary.completionPercentage < 50
          ? pref.remindPartnerPendingGoals && pref.notifyWhenPartnerBehind
          : pref.remindPartnerPendingGoals;

    if (!partnerAllowedByPref || !isTriggerEnabled(pref, trigger) || isWithinQuietHours(pref, evaluationTime)) {
      continue;
    }

    const shouldCreate = await shouldCreateDynamicNotification({
      workspaceId: input.workspaceId,
      recipientId: partnerRecipient.userId,
      actorUserId: input.actorUserId,
      type: partnerAlert.type,
      dateIso,
      pendingGoals: summary.pendingGoals,
      completionPercentage: summary.completionPercentage,
    });

    if (!shouldCreate) {
      continue;
    }

    const created = await prisma.notification.create({
      data: {
        workspaceId: input.workspaceId,
        recipientId: partnerRecipient.userId,
        actorUserId: input.actorUserId,
        audience: 'PARTNER',
        type: partnerAlert.type,
        title: partnerAlert.title,
        message: partnerAlert.message,
        metadata: {
          date: dateIso,
          trigger,
          actorName: input.actorName,
          completionPercentage: summary.completionPercentage,
          pendingGoals: summary.pendingGoals,
          completedGoals: summary.completedGoals,
          totalGoals: summary.totalGoals,
          remainingGoalTitles: summary.remainingGoalTitles,
        },
      },
    });
    notifications.push(created);
  }

  for (const notification of notifications) {
    emitUserEvent(notification.recipientId, 'notification:new', notification);
  }

  return notifications;
}

export async function runReminderSweep(trigger: 'MIDDAY' | 'EVENING') {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      memberships: {
        select: {
          userId: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  for (const workspace of workspaces) {
    for (const membership of workspace.memberships) {
      await createDynamicGoalNotifications({
        workspaceId: workspace.id,
        actorUserId: membership.userId,
        actorName: membership.user.name,
        date: today,
        trigger,
      });
    }
  }

  return { trigger, completedAt: new Date().toISOString() };
}

export async function runPreferenceBasedReminderSweep(now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      memberships: {
        select: {
          userId: true,
          user: {
            select: {
              name: true,
              timezone: true,
              preferences: {
                select: {
                  middayReminderEnabled: true,
                  eveningReminderEnabled: true,
                  middayReminderTime: true,
                  eveningReminderTime: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let dispatchCount = 0;

  for (const workspace of workspaces) {
    for (const membership of workspace.memberships) {
      const pref = membership.user.preferences;
      const timezone = membership.user.timezone || 'UTC';

      if (
        pref?.middayReminderEnabled &&
        shouldTriggerAtLocalTime(pref.middayReminderTime, timezone, now)
      ) {
        await createDynamicGoalNotifications({
          workspaceId: workspace.id,
          actorUserId: membership.userId,
          actorName: membership.user.name,
          date: today,
          now,
          trigger: 'MIDDAY',
        });
        dispatchCount += 1;
      }

      if (
        pref?.eveningReminderEnabled &&
        shouldTriggerAtLocalTime(pref.eveningReminderTime, timezone, now)
      ) {
        await createDynamicGoalNotifications({
          workspaceId: workspace.id,
          actorUserId: membership.userId,
          actorName: membership.user.name,
          date: today,
          now,
          trigger: 'EVENING',
        });
        dispatchCount += 1;
      }
    }
  }

  return {
    completedAt: now.toISOString(),
    dispatchCount,
  };
}
