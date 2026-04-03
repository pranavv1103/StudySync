import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { app } from '../app.js';

test('GET /api/health responds with ok', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('POST /api/auth/login returns token for seeded Pranav', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: 'pranav.l1903@gmail.com',
    password: 'pranav123',
    workspaceSlug: 'pranav-sneha-accountability-circle',
  });

  assert.equal(response.status, 200);
  assert.ok(typeof response.body.token === 'string');
  assert.equal(response.body.user.name, 'Pranav');
});
