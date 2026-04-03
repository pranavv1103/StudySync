import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../lib/auth.js';
import { requireAuth } from '../../middleware/auth.js';

const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  workspaceSlug: z.string().default('pranav-sneha-accountability-circle'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  workspaceSlug: z.string().default('pranav-sneha-accountability-circle'),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(1),
  workspaceSlug: z.string().default('pranav-sneha-accountability-circle'),
});

const googleClient = new OAuth2Client();

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002',
  );
}

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const parseResult = signupSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: 'Invalid signup payload.', errors: parseResult.error.flatten() });
    return;
  }

  const { name, email, password, workspaceSlug } = parseResult.data;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
  });

  if (!workspace) {
    res.status(404).json({ message: 'Workspace not found.' });
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(409).json({ message: 'User already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      memberships: {
        create: {
          workspaceId: workspace.id,
          role: 'MEMBER',
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        where: { workspaceId: workspace.id },
        select: {
          workspaceId: true,
          role: true,
        },
      },
    },
  });

  const token = signToken({
    userId: user.id,
    workspaceId: workspace.id,
  });

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: 'UTC',
      avatarUrl: null,
      workspaceId: user.memberships[0]?.workspaceId,
      workspaceRole: user.memberships[0]?.role,
      loginMethod: 'PASSWORD',
    },
    token,
  });
});

authRouter.post('/login', async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: 'Invalid login payload.', errors: parseResult.error.flatten() });
    return;
  }

  const { email, password, workspaceSlug } = parseResult.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!user) {
    res.status(401).json({ message: 'Invalid credentials.' });
    return;
  }

  if (!user.password) {
    res.status(401).json({ message: 'This account uses Google sign-in. Please continue with Google.' });
    return;
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    res.status(401).json({ message: 'Invalid credentials.' });
    return;
  }

  const membership = user.memberships.find(
    (item: { workspace: { slug: string }; workspaceId: string; role: 'OWNER' | 'MEMBER' }) =>
      item.workspace.slug === workspaceSlug,
  );
  if (!membership) {
    res.status(403).json({ message: 'User is not a member of this workspace.' });
    return;
  }

  const token = signToken({
    userId: user.id,
    workspaceId: membership.workspaceId,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      avatarUrl: user.avatarUrl,
      workspaceId: membership.workspaceId,
      workspaceRole: membership.role,
      loginMethod: user.googleId ? 'GOOGLE' : 'PASSWORD',
    },
  });
});

authRouter.post('/google', async (req, res) => {
  if (!env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ message: 'Google sign-in is not configured.' });
    return;
  }

  const parsed = googleLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid Google login payload.', errors: parsed.error.flatten() });
    return;
  }

  const { idToken, workspaceSlug } = parsed.data;

  let payload: {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const tokenPayload = ticket.getPayload();
    if (!tokenPayload) {
      res.status(401).json({ message: 'Invalid Google token.' });
      return;
    }
    payload = tokenPayload as typeof payload;
  } catch {
    res.status(401).json({ message: 'Google token verification failed.' });
    return;
  }

  if (!payload.email || !payload.email_verified) {
    res.status(400).json({ message: 'Google account must have a verified email.' });
    return;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
  });

  if (!workspace) {
    res.status(404).json({ message: 'Workspace not found.' });
    return;
  }

  const loadUserWithMemberships = (where: { id?: string; email?: string; googleId?: string }) =>
    prisma.user.findFirst({
      where,
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });

  let user = await prisma.user.findUnique({
    where: { googleId: payload.sub },
    include: {
      memberships: {
        include: { workspace: true },
      },
    },
  });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: payload.email },
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });

    if (existingByEmail?.googleId && existingByEmail.googleId !== payload.sub) {
      res.status(409).json({
        message:
          'This email is already linked to a different Google account. Please use that account to sign in.',
      });
      return;
    }

    if (existingByEmail) {
      try {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: payload.sub,
            avatarUrl: existingByEmail.avatarUrl ?? payload.picture ?? null,
          },
          include: {
            memberships: {
              include: { workspace: true },
            },
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          user =
            (await loadUserWithMemberships({ googleId: payload.sub })) ??
            (await loadUserWithMemberships({ email: payload.email }));
        } else {
          throw error;
        }
      }
    } else {
      try {
        user = await prisma.user.create({
          data: {
            name: payload.name ?? payload.email.split('@')[0],
            email: payload.email,
            password: null,
            googleId: payload.sub,
            avatarUrl: payload.picture ?? null,
            memberships: {
              create: {
                workspaceId: workspace.id,
                role: 'MEMBER',
              },
            },
          },
          include: {
            memberships: {
              include: { workspace: true },
            },
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          user =
            (await loadUserWithMemberships({ googleId: payload.sub })) ??
            (await loadUserWithMemberships({ email: payload.email }));
        } else {
          throw error;
        }
      }
    }
  }

  if (!user) {
    res.status(500).json({ message: 'Unable to resolve Google user account.' });
    return;
  }

  const membership = user.memberships.find(
    (item: { workspace: { slug: string } }) => item.workspace.slug === workspaceSlug,
  );
  if (!membership) {
    const addedMembership = await prisma.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: 'MEMBER',
      },
      include: {
        workspace: true,
      },
    });

    user = {
      ...user,
      memberships: [...user.memberships, addedMembership],
    };
  }

  const finalMembership = user.memberships.find(
    (item: { workspace: { slug: string } }) => item.workspace.slug === workspaceSlug,
  );
  if (!finalMembership) {
    res.status(500).json({ message: 'Unable to resolve workspace membership.' });
    return;
  }

  const token = signToken({
    userId: user.id,
    workspaceId: finalMembership.workspaceId,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      avatarUrl: user.avatarUrl,
      workspaceId: finalMembership.workspaceId,
      workspaceRole: finalMembership.role,
      loginMethod: 'GOOGLE',
    },
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      email: true,
      timezone: true,
      avatarUrl: true,
      googleId: true,
      memberships: {
        where: { workspaceId: auth.workspaceId },
        select: {
          workspaceId: true,
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  res.json({
    user: {
      ...user,
      loginMethod: user.googleId ? 'GOOGLE' : 'PASSWORD',
    },
  });
});
