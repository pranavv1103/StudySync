import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createDynamicGoalNotifications } from '../modules/notifications/notification.service.js';

async function loginAsPranav() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'pranav.l1903@gmail.com',
    password: 'pranav123',
    workspaceSlug: 'pranav-sneha-accountability-circle',
  });

  assert.equal(response.status, 200);
  return response.body.token as string;
}

test('settings patch persists toggles and timezone via settings read', async () => {
  const token = await loginAsPranav();

  const user = await prisma.user.findUnique({
    where: { email: 'pranav.l1903@gmail.com' },
    select: { id: true, timezone: true },
  });
  assert.ok(user);

  const originalPref = await prisma.userPreference.findUnique({
    where: { userId: user.id },
  });

  const payload = {
    profile: {
      timezone: 'UTC',
    },
    notificationPreferences: {
      remindSelfPendingGoals: false,
      remindPartnerPendingGoals: false,
      middayReminderEnabled: false,
      eveningReminderEnabled: true,
      middayReminderTime: '12:30',
      eveningReminderTime: '20:30',
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '07:30',
      browserNotificationsEnabled: false,
    },
    accountabilityPreferences: {
      notifyWhenPartnerBehind: false,
      notifyWhenPartnerCompletedAll: true,
      notifyWhenSelfCompletedAll: true,
      realtimePartnerUpdatesEnabled: false,
      dailySummaryEnabled: true,
    },
  };

  try {
    const patchResponse = await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    assert.equal(patchResponse.status, 200);

    const getResponse = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.profile.timezone, 'UTC');
    assert.equal(getResponse.body.notificationPreferences.remindSelfPendingGoals, false);
    assert.equal(getResponse.body.notificationPreferences.remindPartnerPendingGoals, false);
    assert.equal(getResponse.body.notificationPreferences.quietHoursEnabled, true);
    assert.equal(getResponse.body.notificationPreferences.quietHoursStart, '21:00');
    assert.equal(getResponse.body.notificationPreferences.quietHoursEnd, '07:30');
    assert.equal(getResponse.body.accountabilityPreferences.realtimePartnerUpdatesEnabled, false);
  } finally {
    await prisma.user.update({
      where: { id: user.id },
      data: { timezone: user.timezone },
    });

    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {
        workspaceId: originalPref?.workspaceId,
        remindSelfPendingGoals: originalPref?.remindSelfPendingGoals,
        remindPartnerPendingGoals: originalPref?.remindPartnerPendingGoals,
        middayReminderEnabled: originalPref?.middayReminderEnabled,
        eveningReminderEnabled: originalPref?.eveningReminderEnabled,
        middayReminderTime: originalPref?.middayReminderTime,
        eveningReminderTime: originalPref?.eveningReminderTime,
        quietHoursEnabled: originalPref?.quietHoursEnabled,
        quietHoursStart: originalPref?.quietHoursStart,
        quietHoursEnd: originalPref?.quietHoursEnd,
        browserNotificationsEnabled: originalPref?.browserNotificationsEnabled,
        notifyWhenPartnerBehind: originalPref?.notifyWhenPartnerBehind,
        notifyWhenPartnerCompletedAll: originalPref?.notifyWhenPartnerCompletedAll,
        notifyWhenSelfCompletedAll: originalPref?.notifyWhenSelfCompletedAll,
        realtimePartnerUpdatesEnabled: originalPref?.realtimePartnerUpdatesEnabled,
        dailySummaryEnabled: originalPref?.dailySummaryEnabled,
      },
      create: {
        userId: user.id,
        workspaceId: originalPref?.workspaceId ?? '',
      },
    });
  }
});

test('quiet hours and partner reminder preferences suppress/resume alerts', async () => {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ['pranav.l1903@gmail.com', 'REMOVED'],
      },
    },
    select: { id: true, name: true, email: true, timezone: true },
  });

  const pranav = users.find((user: { email: string }) => user.email === 'pranav.l1903@gmail.com');
  const partner = users.find((user: { email: string }) => user.email === 'REMOVED');
  assert.ok(pranav);
  assert.ok(partner);

  const workspace = await prisma.workspace.findUnique({
    where: { slug: 'pranav-sneha-accountability-circle' },
    select: { id: true },
  });
  assert.ok(workspace);

  const [pranavPref, partnerPref] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: pranav.id } }),
    prisma.userPreference.findUnique({ where: { userId: partner.id } }),
  ]);

  const targetDate = new Date();
  targetDate.setUTCHours(0, 0, 0, 0);

  try {
    await prisma.user.update({ where: { id: pranav.id }, data: { timezone: 'UTC' } });
    await prisma.user.update({ where: { id: partner.id }, data: { timezone: 'UTC' } });

    await prisma.userPreference.upsert({
      where: { userId: pranav.id },
      update: {
        workspaceId: workspace.id,
        remindSelfPendingGoals: true,
        remindPartnerPendingGoals: true,
        quietHoursEnabled: true,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
        notifyWhenPartnerBehind: true,
        notifyWhenPartnerCompletedAll: true,
        notifyWhenSelfCompletedAll: true,
        dailySummaryEnabled: true,
      },
      create: {
        userId: pranav.id,
        workspaceId: workspace.id,
      },
    });

    await prisma.userPreference.upsert({
      where: { userId: partner.id },
      update: {
        workspaceId: workspace.id,
        remindPartnerPendingGoals: false,
        notifyWhenPartnerBehind: false,
        notifyWhenPartnerCompletedAll: false,
        dailySummaryEnabled: true,
      },
      create: {
        userId: partner.id,
        workspaceId: workspace.id,
      },
    });

    const selfBefore = await prisma.notification.count({ where: { recipientId: pranav.id } });
    const partnerBefore = await prisma.notification.count({ where: { recipientId: partner.id } });

    await createDynamicGoalNotifications({
      workspaceId: workspace.id,
      actorUserId: pranav.id,
      actorName: pranav.name,
      date: targetDate,
      now: new Date('2026-03-31T12:00:00.000Z'),
      trigger: 'MANUAL',
    });

    const selfAfterSuppressed = await prisma.notification.count({ where: { recipientId: pranav.id } });
    const partnerAfterSuppressed = await prisma.notification.count({ where: { recipientId: partner.id } });

    assert.equal(selfAfterSuppressed, selfBefore);
    assert.equal(partnerAfterSuppressed, partnerBefore);

    await prisma.userPreference.update({
      where: { userId: pranav.id },
      data: { quietHoursEnabled: false },
    });

    await prisma.userPreference.update({
      where: { userId: partner.id },
      data: {
        remindPartnerPendingGoals: true,
        notifyWhenPartnerBehind: true,
        notifyWhenPartnerCompletedAll: true,
      },
    });

    await createDynamicGoalNotifications({
      workspaceId: workspace.id,
      actorUserId: pranav.id,
      actorName: pranav.name,
      date: targetDate,
      now: new Date('2026-03-31T14:30:00.000Z'),
      trigger: 'MANUAL',
    });

    const selfAfterResumed = await prisma.notification.count({ where: { recipientId: pranav.id } });
    const partnerAfterResumed = await prisma.notification.count({ where: { recipientId: partner.id } });

    assert.ok(selfAfterResumed > selfAfterSuppressed);
    assert.ok(partnerAfterResumed > partnerAfterSuppressed);
  } finally {
    await prisma.user.update({ where: { id: pranav.id }, data: { timezone: pranav.timezone } });
    await prisma.user.update({ where: { id: partner.id }, data: { timezone: partner.timezone } });

    await prisma.userPreference.upsert({
      where: { userId: pranav.id },
      update: {
        workspaceId: pranavPref?.workspaceId,
        remindSelfPendingGoals: pranavPref?.remindSelfPendingGoals,
        remindPartnerPendingGoals: pranavPref?.remindPartnerPendingGoals,
        middayReminderEnabled: pranavPref?.middayReminderEnabled,
        eveningReminderEnabled: pranavPref?.eveningReminderEnabled,
        middayReminderTime: pranavPref?.middayReminderTime,
        eveningReminderTime: pranavPref?.eveningReminderTime,
        quietHoursEnabled: pranavPref?.quietHoursEnabled,
        quietHoursStart: pranavPref?.quietHoursStart,
        quietHoursEnd: pranavPref?.quietHoursEnd,
        browserNotificationsEnabled: pranavPref?.browserNotificationsEnabled,
        notifyWhenPartnerBehind: pranavPref?.notifyWhenPartnerBehind,
        notifyWhenPartnerCompletedAll: pranavPref?.notifyWhenPartnerCompletedAll,
        notifyWhenSelfCompletedAll: pranavPref?.notifyWhenSelfCompletedAll,
        realtimePartnerUpdatesEnabled: pranavPref?.realtimePartnerUpdatesEnabled,
        dailySummaryEnabled: pranavPref?.dailySummaryEnabled,
      },
      create: {
        userId: pranav.id,
        workspaceId: workspace.id,
      },
    });

    await prisma.userPreference.upsert({
      where: { userId: partner.id },
      update: {
        workspaceId: partnerPref?.workspaceId,
        remindSelfPendingGoals: partnerPref?.remindSelfPendingGoals,
        remindPartnerPendingGoals: partnerPref?.remindPartnerPendingGoals,
        middayReminderEnabled: partnerPref?.middayReminderEnabled,
        eveningReminderEnabled: partnerPref?.eveningReminderEnabled,
        middayReminderTime: partnerPref?.middayReminderTime,
        eveningReminderTime: partnerPref?.eveningReminderTime,
        quietHoursEnabled: partnerPref?.quietHoursEnabled,
        quietHoursStart: partnerPref?.quietHoursStart,
        quietHoursEnd: partnerPref?.quietHoursEnd,
        browserNotificationsEnabled: partnerPref?.browserNotificationsEnabled,
        notifyWhenPartnerBehind: partnerPref?.notifyWhenPartnerBehind,
        notifyWhenPartnerCompletedAll: partnerPref?.notifyWhenPartnerCompletedAll,
        notifyWhenSelfCompletedAll: partnerPref?.notifyWhenSelfCompletedAll,
        realtimePartnerUpdatesEnabled: partnerPref?.realtimePartnerUpdatesEnabled,
        dailySummaryEnabled: partnerPref?.dailySummaryEnabled,
      },
      create: {
        userId: partner.id,
        workspaceId: workspace.id,
      },
    });
  }
});

test('notifications read-all marks only selected audience as read', async () => {
  const token = await loginAsPranav();

  const user = await prisma.user.findUnique({
    where: { email: 'pranav.l1903@gmail.com' },
    select: { id: true },
  });
  assert.ok(user);

  const membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
      workspace: { slug: 'pranav-sneha-accountability-circle' },
    },
    select: { workspaceId: true },
  });
  assert.ok(membership);

  const created = await prisma.$transaction([
    prisma.notification.create({
      data: {
        workspaceId: membership.workspaceId,
        recipientId: user.id,
        actorUserId: user.id,
        audience: 'SELF',
        type: 'SELF_PROGRESS_ALERT',
        title: 'Self alert',
        message: 'Self alert message',
      },
    }),
    prisma.notification.create({
      data: {
        workspaceId: membership.workspaceId,
        recipientId: user.id,
        actorUserId: user.id,
        audience: 'PARTNER',
        type: 'PARTNER_PROGRESS_ALERT',
        title: 'Buddy alert',
        message: 'Buddy alert message',
      },
    }),
  ]);

  try {
    const unreadPartnerBefore = await prisma.notification.count({
      where: {
        recipientId: user.id,
        workspaceId: membership.workspaceId,
        audience: 'PARTNER',
        isRead: false,
      },
    });

    const response = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .send({ audience: 'PARTNER' });

    assert.equal(response.status, 200);
    assert.equal(response.body.count, unreadPartnerBefore);

    const [selfAlert, buddyAlert] = await prisma.notification.findMany({
      where: {
        id: {
          in: created.map((item) => item.id),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    assert.equal(selfAlert.isRead, false);
    assert.equal(buddyAlert.isRead, true);
  } finally {
    await prisma.notification.deleteMany({
      where: {
        id: {
          in: created.map((item) => item.id),
        },
      },
    });
  }
});
