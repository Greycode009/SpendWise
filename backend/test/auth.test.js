import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '@spendwise/shared';
import { api, createUser } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('auth', () => {
  it('registers a user, hashes the password and seeds default categories', async () => {
    const user = await createUser({ currency: 'USD' });
    expect(user.accessToken).toBeTruthy();
    expect(user.refreshToken).toBeTruthy();
    expect(user.user).toMatchObject({ name: 'Test User', email: user.email, currency: 'USD' });
    expect(user.user.passwordHash).toBeUndefined();

    const row = await prisma.user.findUnique({ where: { email: user.email } });
    expect(row.passwordHash).not.toBe(user.password);
    expect(row.passwordHash.startsWith('$2')).toBe(true);

    const cats = await api().get('/api/categories').set(user.auth);
    expect(cats.status).toBe(200);
    expect(cats.body.data).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it('rejects duplicate emails (case-insensitive)', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Again', email: user.email.toUpperCase(), password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates registration input', async () => {
    const res = await api().post('/api/auth/register').send({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(1);
  });

  it('logs in with correct credentials only', async () => {
    const user = await createUser();
    const ok = await api().post('/api/auth/login').send({ email: user.email, password: user.password });
    expect(ok.status).toBe(200);
    expect(ok.body.user.id).toBe(user.user.id);

    const bad = await api().post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
    const unknown = await api().post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'whatever1' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message); // no account enumeration
  });

  it('protects routes and reports expired tokens distinctly', async () => {
    expect((await api().get('/api/transactions')).status).toBe(401);
    expect((await api().get('/api/transactions').set('Authorization', 'Bearer garbage')).body.error.code).toBe('INVALID_TOKEN');

    const user = await createUser();
    const expired = jwt.sign({ sub: user.user.id }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');

    const forged = jwt.sign({ sub: user.user.id }, 'some-other-secret');
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  it('rotates refresh tokens: an old refresh token cannot be reused', async () => {
    const user = await createUser();
    const first = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(user.refreshToken);

    const reuse = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('SESSION_EXPIRED');

    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${first.body.accessToken}`);
    expect(me.body.user.email).toBe(user.email);
  });

  it('revokes the refresh token on logout', async () => {
    const user = await createUser();
    expect((await api().post('/api/auth/logout').send({ refreshToken: user.refreshToken })).status).toBe(204);
    expect((await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken })).status).toBe(401);
  });

  it('updates the profile', async () => {
    const user = await createUser();
    const res = await api().patch('/api/auth/me').set(user.auth).send({ name: 'Dipesh', currency: 'INR' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Dipesh', currency: 'INR' });
    expect((await api().patch('/api/auth/me').set(user.auth).send({ currency: 'XXX' })).status).toBe(400);
  });
});
