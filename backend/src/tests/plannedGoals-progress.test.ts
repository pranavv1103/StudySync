import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { app } from '../app.js';

async function loginAsPranav() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'pranav.l1903@gmail.com',
    password: 'pranav123',
    workspaceSlug: 'pranav-sneha-accountability-circle',
  });

  assert.equal(response.status, 200);
  return response.body.token as string;
}

async function loginAsSneha() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'REMOVED',
    password: 'sneha123',
    workspaceSlug: 'pranav-sneha-accountability-circle',
  });

  assert.equal(response.status, 200);
  return response.body.token as string;
}

test('mark done sets completedValue to target and goal status to COMPLETED', async () => {
  const token = await loginAsPranav();

  const createdGoalRes = await request(app)
    .post('/api/planned-goals')
    .set('Authorization', `Bearer ${token}`)
    .send({
      date: new Date('2026-03-31T00:00:00.000Z').toISOString(),
      title: `Test mark done ${Date.now()}`,
      category: 'Testing',
      unit: 'TASKS',
      targetValue: 5,
    });

  assert.equal(createdGoalRes.status, 201);
  const ownIncompleteGoal = createdGoalRes.body;

  const markDoneRes = await request(app)
    .patch(`/api/planned-goals/${ownIncompleteGoal.id}/progress`)
    .set('Authorization', `Bearer ${token}`)
    .send({ completed: true });

  assert.equal(markDoneRes.status, 200);
  assert.equal(markDoneRes.body.progress.completed, true);
  assert.equal(markDoneRes.body.progress.completedValue, 5);
  assert.equal(markDoneRes.body.plannedGoal.status, 'COMPLETED');
});

test('progress update is capped at target value and auto-completes', async () => {
  const token = await loginAsPranav();

  const createdGoalRes = await request(app)
    .post('/api/planned-goals')
    .set('Authorization', `Bearer ${token}`)
    .send({
      date: new Date('2026-03-31T00:00:00.000Z').toISOString(),
      title: `Test cap progress ${Date.now()}`,
      category: 'Testing',
      unit: 'TASKS',
      targetValue: 3,
    });

  assert.equal(createdGoalRes.status, 201);
  const ownGoal = createdGoalRes.body;

  const overIncrementRes = await request(app)
    .patch(`/api/planned-goals/${ownGoal.id}/progress`)
    .set('Authorization', `Bearer ${token}`)
    .send({ completedValue: 100 });

  assert.equal(overIncrementRes.status, 200);
  assert.equal(overIncrementRes.body.progress.completedValue, 3);
  assert.equal(overIncrementRes.body.progress.completed, true);
  assert.equal(overIncrementRes.body.plannedGoal.status, 'COMPLETED');
});

test('unauthorized progress update on partner goal returns 403', async () => {
  const pranavToken = await loginAsPranav();
  const snehaToken = await loginAsSneha();

  const partnerGoalCreateRes = await request(app)
    .post('/api/planned-goals')
    .set('Authorization', `Bearer ${snehaToken}`)
    .send({
      date: new Date('2026-03-31T00:00:00.000Z').toISOString(),
      title: `Sneha private goal ${Date.now()}`,
      category: 'Testing',
      unit: 'TASKS',
      targetValue: 2,
    });

  assert.equal(partnerGoalCreateRes.status, 201);
  const partnerGoal = partnerGoalCreateRes.body;

  const response = await request(app)
    .patch(`/api/planned-goals/${partnerGoal.id}/progress`)
    .set('Authorization', `Bearer ${pranavToken}`)
    .send({ completedValue: 1 });

  assert.equal(response.status, 403);
});
