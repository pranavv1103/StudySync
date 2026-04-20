import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { app } from '../app.js';

const verifyIdTokenOriginal = OAuth2Client.prototype.verifyIdToken;

type GooglePayload = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

function mockGooglePayload(payload: GooglePayload) {
  OAuth2Client.prototype.verifyIdToken = async () =>
    ({
      getPayload: () => payload,
    }) as any;
}

test.after(() => {
  OAuth2Client.prototype.verifyIdToken = verifyIdTokenOriginal;
});

test('Google sign-in links existing password user without creating duplicates', async () => {
  env.GOOGLE_CLIENT_ID = 'test-google-client-id';

  const email = 'user1@example.com';
  const original = await prisma.user.findUnique({ where: { email }, select: { id: true, googleId: true } });
  assert.ok(original);

  try {
  const beforeCount = await prisma.user.count({ where: { email } });

  mockGooglePayload({
    sub: `g-${Date.now()}`,
    email,
    name: 'Pranav',
    email_verified: true,
  });

  const response = await request(app).post('/api/auth/google').send({
    idToken: 'fake-id-token',
    workspaceSlug: 'my-accountability-circle',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, email);
  assert.equal(response.body.user.loginMethod, 'GOOGLE');

  const afterCount = await prisma.user.count({ where: { email } });
  assert.equal(afterCount, beforeCount);

  const linked = await prisma.user.findUnique({ where: { email } });
  assert.ok(linked?.googleId);

  const passwordLogin = await request(app).post('/api/auth/login').send({
    email,
    password: 'changeme1',
    workspaceSlug: 'my-accountability-circle',
  });
  assert.equal(passwordLogin.status, 200);
  } finally {
    await prisma.user.update({
      where: { id: original.id },
      data: { googleId: original.googleId },
    });
  }
});

test('Google sign-in rejects linking when email already linked to different Google account', async () => {
  env.GOOGLE_CLIENT_ID = 'test-google-client-id';

  const email = 'user1@example.com';
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, googleId: true } });
  assert.ok(user);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { googleId: 'existing-google-sub' },
    });

  mockGooglePayload({
    sub: 'different-google-sub',
    email,
    name: 'Pranav',
    email_verified: true,
  });

    const response = await request(app).post('/api/auth/google').send({
      idToken: 'fake-id-token',
      workspaceSlug: 'my-accountability-circle',
    });

    assert.equal(response.status, 409);
    assert.match(response.body.message, /already linked to a different Google account/i);
  } finally {
    await prisma.user.update({
      where: { id: user.id },
      data: { googleId: user.googleId },
    });
  }
});
