import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();
export const api = () => request(app);
export const uuid = () => crypto.randomUUID();

/** Register a fresh user and return tokens + a ready-made auth header. */
export async function createUser(overrides = {}) {
  const email = `user-${uuid()}@test.dev`;
  const password = 'password123';
  const res = await api()
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password, ...overrides });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    ...res.body,
    email,
    password,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}

export async function firstCategory(user, type = 'expense') {
  const res = await api().get('/api/categories').set(user.auth);
  return res.body.data.find((c) => c.type === type);
}

export const op = (entity, action, recordId, data, clientUpdatedAt = new Date().toISOString()) => ({
  opId: uuid(),
  entity,
  action,
  recordId,
  data,
  clientUpdatedAt,
});
