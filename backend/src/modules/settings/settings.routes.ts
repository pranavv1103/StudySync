import { Router } from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

const updateSettingsSchema = z.object({
  profile: z
    .object({
      name: z.string().min(2).max(80).optional(),
      timezone: z.string().min(1).max(128).optional(),
      avatarUrl: z.string().url().nullable().optional(),
    })
    .optional(),
  notificationPreferences: z
    .object({
      remindSelfPendingGoals: z.boolean().optional(),
      remindPartnerPendingGoals: z.boolean().optional(),
      middayReminderEnabled: z.boolean().optional(),
      eveningReminderEnabled: z.boolean().optional(),
      middayReminderTime: hhmmSchema.optional(),
      eveningReminderTime: hhmmSchema.optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: hhmmSchema.optional(),
      quietHoursEnd: hhmmSchema.optional(),
      browserNotificationsEnabled: z.boolean().optional(),
    })
    .optional(),
  accountabilityPreferences: z
    .object({
      notifyWhenPartnerBehind: z.boolean().optional(),
      notifyWhenPartnerCompletedAll: z.boolean().optional(),
      notifyWhenSelfCompletedAll: z.boolean().optional(),
      realtimePartnerUpdatesEnabled: z.boolean().optional(),
      dailySummaryEnabled: z.boolean().optional(),
      dailyEmailEnabled: z.boolean().optional(),
      dailyEmailTime: hhmmSchema.optional(),
    })
    .optional(),
});

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const uploadsRoot = env.UPLOADS_DIR
  ? path.resolve(process.cwd(), env.UPLOADS_DIR)
  : path.resolve(process.cwd(), 'uploads');
const avatarUploadDir = path.resolve(uploadsRoot, 'avatars');
if (!existsSync(avatarUploadDir)) {
  mkdirSync(avatarUploadDir, { recursive: true });
}

function getPublicBaseUrl(req: { protocol: string; get: (name: string) => string | undefined }): string {
  if (env.PUBLIC_BASE_URL) {
    return env.PUBLIC_BASE_URL;
  }

  return `${req.protocol}://${req.get('host')}`;
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, avatarUploadDir);
    },
    filename: (req, file, callback) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      const userId = req.auth?.userId ?? 'user';
      callback(null, `${userId}-${Date.now()}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(new Error('Only JPG, PNG, and WEBP files are supported.'));
      return;
    }
    callback(null, true);
  },
});

async function getOrCreatePreferences(userId: string, workspaceId: string) {
  return prisma.userPreference.upsert({
    where: { userId },
    update: { workspaceId },
    create: { userId, workspaceId },
  });
}

settingsRouter.get('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const [user, workspace, preferences, relation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        avatarUrl: true,
        googleId: true,
      },
    }),
    prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { id: true, name: true, slug: true, type: true },
    }),
    getOrCreatePreferences(auth.userId, auth.workspaceId),
    prisma.partnerRelation.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        isActive: true,
        OR: [{ userAId: auth.userId }, { userBId: auth.userId }],
      },
      include: {
        userA: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        userB: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  if (!user || !workspace) {
    res.status(404).json({ message: 'Settings context not found.' });
    return;
  }

  const partner = relation
    ? relation.userA.id === auth.userId
      ? relation.userB
      : relation.userA
    : null;

  res.json({
    profile: {
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      avatarUrl: user.avatarUrl,
    },
    authentication: {
      loginMethod: user.googleId ? 'GOOGLE' : 'PASSWORD',
      googleLinked: Boolean(user.googleId),
    },
    notificationPreferences: {
      remindSelfPendingGoals: preferences.remindSelfPendingGoals,
      remindPartnerPendingGoals: preferences.remindPartnerPendingGoals,
      middayReminderEnabled: preferences.middayReminderEnabled,
      eveningReminderEnabled: preferences.eveningReminderEnabled,
      middayReminderTime: preferences.middayReminderTime,
      eveningReminderTime: preferences.eveningReminderTime,
      quietHoursEnabled: preferences.quietHoursEnabled,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      browserNotificationsEnabled: preferences.browserNotificationsEnabled,
    },
    accountabilityPreferences: {
      notifyWhenPartnerBehind: preferences.notifyWhenPartnerBehind,
      notifyWhenPartnerCompletedAll: preferences.notifyWhenPartnerCompletedAll,
      notifyWhenSelfCompletedAll: preferences.notifyWhenSelfCompletedAll,
      realtimePartnerUpdatesEnabled: preferences.realtimePartnerUpdatesEnabled,
      dailySummaryEnabled: preferences.dailySummaryEnabled,
      dailyEmailEnabled: preferences.dailyEmailEnabled,
      dailyEmailTime: preferences.dailyEmailTime,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      type: workspace.type,
      partner: partner
        ? {
            id: partner.id,
            name: partner.name,
            email: partner.email,
          }
        : null,
      teamModePlanned: workspace.type !== 'PARTNER',
    },
  });
});

settingsRouter.post('/avatar', (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'Avatar upload failed: file must be <= 3MB.' });
      return;
    }

    const message = error instanceof Error ? error.message : 'Avatar upload failed.';
    res.status(400).json({ message });
  });
}, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'Avatar file is required.' });
    return;
  }

  const relativePath = `/uploads/avatars/${req.file.filename}`;
  const avatarUrl = new URL(relativePath, getPublicBaseUrl(req)).toString();

  await prisma.user.update({
    where: { id: auth.userId },
    data: { avatarUrl },
  });

  res.status(201).json({
    message: 'Avatar uploaded successfully.',
    avatarUrl,
  });
});

settingsRouter.patch('/', async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid settings payload.', errors: parsed.error.flatten() });
    return;
  }

  const { profile, notificationPreferences, accountabilityPreferences } = parsed.data;

  if (profile) {
    await prisma.user.update({
      where: { id: auth.userId },
      data: {
        ...(profile.name !== undefined ? { name: profile.name } : {}),
        ...(profile.timezone !== undefined ? { timezone: profile.timezone } : {}),
        ...(profile.avatarUrl !== undefined ? { avatarUrl: profile.avatarUrl } : {}),
      },
    });
  }

  await prisma.userPreference.upsert({
    where: { userId: auth.userId },
    update: {
      workspaceId: auth.workspaceId,
      ...(notificationPreferences ?? {}),
      ...(accountabilityPreferences ?? {}),
    },
    create: {
      userId: auth.userId,
      workspaceId: auth.workspaceId,
      ...(notificationPreferences ?? {}),
      ...(accountabilityPreferences ?? {}),
    },
  });

  res.json({ message: 'Settings updated successfully.' });
});
