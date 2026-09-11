import { beforeAll, describe, expect, it } from 'vitest';
import { api, createUser, firstCategory, uuid } from './helpers.js';

describe('transactions', () => {
  let user;
  let food;
  let salary;
  beforeAll(async () => {
    user = await createUser();
    food = await firstCategory(user, 'expense');
    salary = await firstCategory(user, 'income');
  });

  it('supports create, read, update and delete', async () => {
    const created = await api()
      .post('/api/transactions')
      .set(user.auth)
      .send({ type: 'expense', amount: 25050, categoryId: food.id, date: '2026-09-10', description: 'Lunch', paymentMethod: 'cash' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ amount: 25050, date: '2026-09-10', description: 'Lunch' });
    const id = created.body.data.id;

    const got = await api().get(`/api/transactions/${id}`).set(user.auth);
    expect(got.body.data.id).toBe(id);

    const patched = await api().patch(`/api/transactions/${id}`).set(user.auth).send({ amount: 30000, note: 'with dessert' });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ amount: 30000, note: 'with dessert', description: 'Lunch' });

    expect((await api().delete(`/api/transactions/${id}`).set(user.auth)).status).toBe(204);
    expect((await api().get(`/api/transactions/${id}`).set(user.auth)).status).toBe(404);
    expect((await api().delete(`/api/transactions/${id}`).set(user.auth)).status).toBe(204); // idempotent
  });

  it('accepts a client-generated id (offline-created records keep their identity)', async () => {
    const id = uuid();
    const res = await api().post('/api/transactions').set(user.auth).send({ id, type: 'income', amount: 100, date: '2026-09-01' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(id);
    expect((await api().post('/api/transactions').set(user.auth).send({ id, type: 'income', amount: 100, date: '2026-09-01' })).status).toBe(409);
  });

  it.each([
    [{ amount: -5 }, 'amount'],
    [{ amount: 12.5 }, 'amount'],
    [{ amount: '100' }, 'amount'],
    [{ date: '2026-13-01' }, 'date'],
    [{ type: 'transfer' }, 'type'],
    [{ paymentMethod: 'bitcoin' }, 'paymentMethod'],
    [{ description: 'x'.repeat(500) }, 'description'],
  ])('rejects invalid input %j', async (patch, field) => {
    const res = await api()
      .post('/api/transactions')
      .set(user.auth)
      .send({ type: 'expense', amount: 100, date: '2026-09-01', ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe(field);
  });

  it('rejects a category of the wrong type', async () => {
    const res = await api().post('/api/transactions').set(user.auth).send({ type: 'expense', amount: 100, date: '2026-09-01', categoryId: salary.id });
    expect(res.status).toBe(422);
  });

  it('filters by type, date range and search text', async () => {
    const u = await createUser();
    const add = (body) => api().post('/api/transactions').set(u.auth).send(body);
    await add({ type: 'expense', amount: 100, date: '2026-08-15', description: 'Old coffee' });
    await add({ type: 'expense', amount: 200, date: '2026-09-02', description: 'Momo' });
    await add({ type: 'income', amount: 900, date: '2026-09-03', description: 'Salary' });

    const exp = await api().get('/api/transactions?type=expense').set(u.auth);
    expect(exp.body.data).toHaveLength(2);
    const sep = await api().get('/api/transactions?from=2026-09-01&to=2026-09-30').set(u.auth);
    expect(sep.body.data.map((t) => t.description)).toEqual(['Salary', 'Momo']);
    const q = await api().get('/api/transactions?q=COFFEE').set(u.auth);
    expect(q.body.data).toHaveLength(1);
    expect((await api().get('/api/transactions?from=yesterday').set(u.auth)).status).toBe(400);
  });
});

describe('people, loans and repayments', () => {
  let user;
  let person;
  beforeAll(async () => {
    user = await createUser();
    person = (await api().post('/api/people').set(user.auth).send({ name: 'Aarav', phone: '9800000000' })).body.data;
  });

  it('tracks outstanding balance and status through repayments', async () => {
    const loan = (
      await api().post('/api/loans').set(user.auth).send({ personId: person.id, direction: 'lent', amount: 500000, date: '2026-09-01', dueDate: '2099-01-01' })
    ).body.data;

    let res = await api().get(`/api/loans/${loan.id}`).set(user.auth);
    expect(res.body.data).toMatchObject({ outstanding: 500000, status: 'open' });

    expect((await api().post(`/api/loans/${loan.id}/repayments`).set(user.auth).send({ amount: 200000, date: '2026-09-05' })).status).toBe(201);
    res = await api().get(`/api/loans/${loan.id}`).set(user.auth);
    expect(res.body.data).toMatchObject({ repaid: 200000, outstanding: 300000, status: 'partial' });
    expect(res.body.data.repayments).toHaveLength(1);

    // cannot repay more than what is outstanding
    const over = await api().post(`/api/loans/${loan.id}/repayments`).set(user.auth).send({ amount: 300001, date: '2026-09-06' });
    expect(over.status).toBe(400);

    // cannot shrink the loan below what was already repaid
    expect((await api().patch(`/api/loans/${loan.id}`).set(user.auth).send({ amount: 100000 })).status).toBe(400);

    await api().post(`/api/loans/${loan.id}/repayments`).set(user.auth).send({ amount: 300000, date: '2026-09-07' });
    res = await api().get(`/api/loans/${loan.id}`).set(user.auth);
    expect(res.body.data).toMatchObject({ outstanding: 0, status: 'settled' });
  });

  it('rejects a due date before the loan date', async () => {
    const res = await api().post('/api/loans').set(user.auth).send({ personId: person.id, direction: 'borrowed', amount: 100, date: '2026-09-10', dueDate: '2026-09-01' });
    expect(res.status).toBe(400);
  });

  it('deleting a person also deletes their loans and repayments', async () => {
    const p = (await api().post('/api/people').set(user.auth).send({ name: 'Temp' })).body.data;
    const loan = (await api().post('/api/loans').set(user.auth).send({ personId: p.id, direction: 'borrowed', amount: 1000, date: '2026-09-01' })).body.data;
    const rep = (await api().post(`/api/loans/${loan.id}/repayments`).set(user.auth).send({ amount: 500, date: '2026-09-02' })).body.data;

    expect((await api().delete(`/api/people/${p.id}`).set(user.auth)).status).toBe(204);
    expect((await api().get(`/api/loans/${loan.id}`).set(user.auth)).status).toBe(404);
    expect((await api().get(`/api/repayments/${rep.id}`).set(user.auth)).status).toBe(404);
    // and new loans cannot be attached to the deleted person
    expect((await api().post('/api/loans').set(user.auth).send({ personId: p.id, direction: 'lent', amount: 1, date: '2026-09-01' })).status).toBe(422);
  });
});

describe('user isolation', () => {
  it("never lets one account read or change another account's records", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const cat = await firstCategory(alice);
    const tx = (await api().post('/api/transactions').set(alice.auth).send({ type: 'expense', amount: 999, date: '2026-09-01', categoryId: cat.id })).body.data;
    const person = (await api().post('/api/people').set(alice.auth).send({ name: 'Secret friend' })).body.data;

    expect((await api().get(`/api/transactions/${tx.id}`).set(bob.auth)).status).toBe(404);
    expect((await api().patch(`/api/transactions/${tx.id}`).set(bob.auth).send({ amount: 1 })).status).toBe(404);
    expect((await api().delete(`/api/transactions/${tx.id}`).set(bob.auth)).status).toBe(404);
    expect((await api().get('/api/transactions').set(bob.auth)).body.data).toHaveLength(0);
    expect((await api().get('/api/people').set(bob.auth)).body.data).toHaveLength(0);

    // Bob cannot point his own records at Alice's category or person
    expect((await api().post('/api/transactions').set(bob.auth).send({ type: 'expense', amount: 5, date: '2026-09-01', categoryId: cat.id })).status).toBe(422);
    expect((await api().post('/api/loans').set(bob.auth).send({ personId: person.id, direction: 'lent', amount: 5, date: '2026-09-01' })).status).toBe(422);

    // Bob cannot hijack Alice's record id
    expect((await api().post('/api/transactions').set(bob.auth).send({ id: tx.id, type: 'expense', amount: 5, date: '2026-09-01' })).status).toBe(409);

    const still = await api().get(`/api/transactions/${tx.id}`).set(alice.auth);
    expect(still.body.data.amount).toBe(999);
  });

  it('treats malformed ids as not found', async () => {
    const u = await createUser();
    expect((await api().get('/api/transactions/not-a-uuid').set(u.auth)).status).toBe(404);
  });
});

describe('dashboard', () => {
  it('summarises balance, month totals and loans', async () => {
    const u = await createUser();
    const add = (path, body) => api().post(path).set(u.auth).send(body);
    await add('/api/transactions', { type: 'income', amount: 100000, date: '2026-09-01' });
    await add('/api/transactions', { type: 'expense', amount: 30000, date: '2026-09-02' });
    await add('/api/transactions', { type: 'expense', amount: 5000, date: '2026-08-02' });
    const p = (await add('/api/people', { name: 'Sita' })).body.data;
    const loan = (await add('/api/loans', { personId: p.id, direction: 'lent', amount: 20000, date: '2026-09-03' })).body.data;
    await add(`/api/loans/${loan.id}/repayments`, { amount: 5000, date: '2026-09-04' });

    const res = await api().get('/api/dashboard/summary?month=2026-09').set(u.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      balance: 100000 - 35000 - 20000 + 5000,
      netWorth: 65000,
      periodIncome: 100000,
      periodExpense: 30000,
      owedToMe: 15000,
      iOwe: 0,
    });
    expect(res.body.data.recent).toHaveLength(3);

    const analytics = await api().get('/api/dashboard/analytics?month=2026-09&months=3').set(u.auth);
    expect(analytics.body.data.monthly.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(analytics.body.data.expenseByCategory[0]).toMatchObject({ total: 30000, name: 'Uncategorized' });
  });
});
