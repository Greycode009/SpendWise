import { beforeAll, describe, expect, it } from 'vitest';
import { api, createUser, firstCategory, op, uuid } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

const push = (user, ops) => api().post('/api/sync/push').set(user.auth).send({ ops });
const pull = (user, since) => api().get(`/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`).set(user.auth);

describe('sync push', () => {
  let user;
  let food;
  beforeAll(async () => {
    user = await createUser();
    food = await firstCategory(user);
  });

  it('applies offline-created records in order (parent before child)', async () => {
    const personId = uuid();
    const loanId = uuid();
    const ops = [
      op('people', 'upsert', personId, { name: 'Offline friend' }),
      op('loans', 'upsert', loanId, { personId, direction: 'lent', amount: 5000, date: '2026-09-01' }),
      op('repayments', 'upsert', uuid(), { loanId, amount: 1000, date: '2026-09-02' }),
      op('transactions', 'upsert', uuid(), { type: 'expense', amount: 250, date: '2026-09-02', categoryId: food.id }),
    ];
    const res = await push(user, ops);
    expect(res.status).toBe(200);
    expect(res.body.results.map((r) => r.status)).toEqual(['applied', 'applied', 'applied', 'applied']);
    expect(res.body.results[1].record).toMatchObject({ id: loanId, amount: 5000 });
  });

  it('is idempotent: re-sending the same ops never applies them twice', async () => {
    const id = uuid();
    const ops = [op('transactions', 'upsert', id, { type: 'expense', amount: 700, date: '2026-09-03' })];
    const first = await push(user, ops);
    const second = await push(user, ops);
    expect(first.body.results[0]).toMatchObject({ status: 'applied' });
    expect(second.body.results[0]).toMatchObject({ status: 'applied', duplicate: true });

    // A repayment re-sent after a lost response must not double-count.
    const personId = uuid();
    const loanId = uuid();
    await push(user, [
      op('people', 'upsert', personId, { name: 'P' }),
      op('loans', 'upsert', loanId, { personId, direction: 'lent', amount: 1000, date: '2026-09-01' }),
    ]);
    const repay = [op('repayments', 'upsert', uuid(), { loanId, amount: 600, date: '2026-09-02' })];
    await push(user, repay);
    await push(user, repay);
    const loan = await api().get(`/api/loans/${loanId}`).set(user.auth);
    expect(loan.body.data.repaid).toBe(600);
    expect(await prisma.transaction.count({ where: { id } })).toBe(1);
  });

  it('uses last-write-wins: an older edit arriving late is ignored', async () => {
    const id = uuid();
    await push(user, [op('transactions', 'upsert', id, { type: 'expense', amount: 100, date: '2026-09-01' }, '2026-09-10T10:00:00.000Z')]);
    await push(user, [op('transactions', 'upsert', id, { type: 'expense', amount: 300, date: '2026-09-01' }, '2026-09-10T12:00:00.000Z')]);
    const late = await push(user, [op('transactions', 'upsert', id, { type: 'expense', amount: 200, date: '2026-09-01' }, '2026-09-10T11:00:00.000Z')]);
    expect(late.body.results[0]).toMatchObject({ status: 'stale', reason: 'newer-version-exists' });
    expect(late.body.results[0].record.amount).toBe(300);
  });

  it('treats deletes as final (no resurrection by a late edit)', async () => {
    const id = uuid();
    await push(user, [op('transactions', 'upsert', id, { type: 'expense', amount: 100, date: '2026-09-01' })]);
    await push(user, [op('transactions', 'delete', id)]);
    const res = await push(user, [op('transactions', 'upsert', id, { type: 'expense', amount: 999, date: '2026-09-01' })]);
    expect(res.body.results[0]).toMatchObject({ status: 'stale', reason: 'deleted' });
    expect((await api().get(`/api/transactions/${id}`).set(user.auth)).status).toBe(404);
  });

  it('rejects invalid ops without blocking the rest of the batch', async () => {
    const goodId = uuid();
    const res = await push(user, [
      op('transactions', 'upsert', uuid(), { type: 'expense', amount: -1, date: '2026-09-01' }),
      { opId: 'bad', entity: 'nope' },
      op('transactions', 'upsert', goodId, { type: 'expense', amount: 1, date: '2026-09-01' }),
    ]);
    expect(res.body.results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'applied']);
    expect(res.body.results[0].error).toMatch(/amount/);
  });

  it('remembers rejections, so a retry gets the same answer', async () => {
    const bad = [op('loans', 'upsert', uuid(), { personId: uuid(), direction: 'lent', amount: 1, date: '2026-09-01' })];
    const a = await push(user, bad);
    const b = await push(user, bad);
    expect(a.body.results[0].status).toBe('rejected');
    expect(b.body.results[0]).toMatchObject({ status: 'rejected', duplicate: true });
  });

  it('never lets another account overwrite or delete records it does not own', async () => {
    const mallory = await createUser();
    const id = uuid();
    await push(user, [op('transactions', 'upsert', id, { type: 'expense', amount: 4242, date: '2026-09-01' })]);

    const hijack = await push(mallory, [
      op('transactions', 'upsert', id, { type: 'expense', amount: 1, date: '2026-09-01' }, '2099-01-01T00:00:00.000Z'),
      op('transactions', 'delete', id),
    ]);
    expect(hijack.body.results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(hijack.body.results[0].record).toBeUndefined();
    const mine = await api().get(`/api/transactions/${id}`).set(user.auth);
    expect(mine.body.data.amount).toBe(4242);
  });

  it('limits batch size', async () => {
    const ops = Array.from({ length: 201 }, () => op('people', 'upsert', uuid(), { name: 'x' }));
    expect((await push(user, ops)).status).toBe(400);
  });
});

describe('sync pull', () => {
  it('returns a full snapshot, then only changes (including deletions) since the cursor', async () => {
    const user = await createUser();
    const full = await pull(user);
    expect(full.status).toBe(200);
    expect(full.body.full).toBe(true);
    expect(full.body.changes.categories.length).toBeGreaterThan(0);
    expect(full.body.changes.transactions).toEqual([]);

    const cursor = full.body.serverTime;
    const id = uuid();
    await push(user, [op('transactions', 'upsert', id, { type: 'income', amount: 5, date: '2026-09-01' })]);
    await push(user, [op('transactions', 'delete', id)]);

    const delta = await pull(user, cursor);
    expect(delta.body.full).toBe(false);
    const tx = delta.body.changes.transactions.find((t) => t.id === id);
    expect(tx.deletedAt).toBeTruthy();
  });

  it("does not leak another account's changes", async () => {
    const a = await createUser();
    const b = await createUser();
    await push(a, [op('people', 'upsert', uuid(), { name: 'Only for A' })]);
    const res = await pull(b, new Date(Date.now() - 3600_000).toISOString());
    expect(res.body.changes.people).toEqual([]);
  });
});
