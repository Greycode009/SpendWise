/**
 * Offline-first behaviour of the local store + sync engine, tested against an
 * in-memory IndexedDB (fake-indexeddb) and a fake server.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createUserDb, getMeta } from '../src/db/db.js';
import { deleteRecord, saveRecord } from '../src/db/repo.js';
import { SyncEngine, backoffMs } from '../src/sync/engine.js';

const networkError = () => Object.assign(new Error('Network Error'), { isAxiosError: true });

/** A tiny fake of the SpendWise sync API that remembers op ids like the real one. */
function fakeServer() {
  const store = { transactions: new Map(), people: new Map(), loans: new Map(), repayments: new Map(), categories: new Map() };
  const seen = new Map();
  const server = {
    store,
    online: true,
    pushCalls: 0,
    rejectIf: () => null,
    loseNextResponse: false,
    async post(url, body) {
      if (!server.online) throw networkError();
      server.pushCalls += 1;
      const results = body.ops.map((op) => {
        if (seen.has(op.opId)) return { ...seen.get(op.opId), duplicate: true };
        const reason = server.rejectIf(op);
        let result;
        if (reason) result = { opId: op.opId, status: 'rejected', error: reason };
        else if (op.action === 'delete') {
          const row = store[op.entity].get(op.recordId);
          if (row) row.deletedAt = new Date().toISOString();
          result = { opId: op.opId, status: 'applied', record: row };
        } else {
          const row = { ...op.data, id: op.recordId, updatedAt: new Date().toISOString(), deletedAt: null };
          store[op.entity].set(op.recordId, row);
          result = { opId: op.opId, status: 'applied', record: row };
        }
        seen.set(op.opId, result);
        return result;
      });
      if (server.loseNextResponse) {
        server.loseNextResponse = false;
        throw networkError(); // the server applied the ops but the phone never heard back
      }
      return { data: { results } };
    },
    async get() {
      if (!server.online) throw networkError();
      const changes = {};
      for (const [k, m] of Object.entries(store)) changes[k] = [...m.values()];
      return { data: { serverTime: new Date().toISOString(), full: false, changes } };
    },
    async patch() {
      return { data: { user: {} } };
    },
  };
  return server;
}

let db;
let server;
let engine;
let online;

beforeEach(async () => {
  db = createUserDb(`test-${crypto.randomUUID()}`);
  server = fakeServer();
  online = true;
  engine = new SyncEngine({ db, client: server, isOnline: () => online });
});

const tx = (extra = {}) => ({ type: 'expense', amount: 25000, date: '2026-09-11', description: 'Lunch', ...extra });

describe('local-first writes', () => {
  it('saves to IndexedDB immediately and queues a sync op', async () => {
    const saved = await saveRecord(db, 'transactions', tx());
    expect(await db.transactions.get(saved.id)).toMatchObject({ amount: 25000, _status: 'pending' });
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ entity: 'transactions', action: 'upsert', recordId: saved.id, status: 'pending' });
  });

  it('merges repeated offline edits of an unsent record into one op', async () => {
    const saved = await saveRecord(db, 'transactions', tx());
    await saveRecord(db, 'transactions', { ...saved, amount: 30000 });
    await saveRecord(db, 'transactions', { ...saved, amount: 35000 });
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].data.amount).toBe(35000);
  });

  it('never stores derived fields such as outstanding/status', async () => {
    const saved = await saveRecord(db, 'loans', { personId: crypto.randomUUID(), direction: 'lent', amount: 100, date: '2026-09-01', outstanding: 5, status: 'open', repayments: [] });
    const row = await db.loans.get(saved.id);
    expect(row.outstanding).toBeUndefined();
    expect(row.repayments).toBeUndefined();
  });

  it('cascades deletes locally (person → loans → repayments)', async () => {
    const person = await saveRecord(db, 'people', { name: 'Aarav' });
    const loan = await saveRecord(db, 'loans', { personId: person.id, direction: 'lent', amount: 1000, date: '2026-09-01' });
    await saveRecord(db, 'repayments', { loanId: loan.id, amount: 100, date: '2026-09-02' });
    await deleteRecord(db, 'people', person.id);
    expect(await db.loans.count()).toBe(0);
    expect(await db.repayments.count()).toBe(0);
    const last = await db.outbox.orderBy('seq').last();
    expect(last).toMatchObject({ entity: 'people', action: 'delete', recordId: person.id });
  });
});

describe('sync engine', () => {
  it('stays offline without touching the network, then syncs on reconnect', async () => {
    online = false;
    const saved = await saveRecord(db, 'transactions', tx());
    await engine.sync();
    expect(engine.getState().phase).toBe('offline');
    expect(server.pushCalls).toBe(0);

    online = true;
    await engine.sync();
    expect(server.store.transactions.get(saved.id)).toMatchObject({ amount: 25000 });
    expect(await db.outbox.count()).toBe(0);
    expect((await db.transactions.get(saved.id))._status).toBe('synced');
    expect(engine.getState().phase).toBe('idle');
    expect(await getMeta(db, 'lastPulledAt')).toBeTruthy();
  });

  it('keeps ops queued with backoff when the network fails mid-sync', async () => {
    await saveRecord(db, 'transactions', tx());
    server.online = false; // device thinks it is online, but requests fail
    await engine.sync();
    const [op] = await db.outbox.toArray();
    expect(op).toMatchObject({ status: 'failed', attempts: 1, permanent: false });
    expect(op.nextAttemptAt).toBeGreaterThan(Date.now());

    server.online = true;
    await engine.resetBackoff();
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
  });

  it('does not duplicate records when a response is lost and ops are re-sent', async () => {
    const saved = await saveRecord(db, 'transactions', tx());
    server.loseNextResponse = true;
    await engine.sync();
    expect(await db.outbox.count()).toBe(1); // phone still thinks it is unsent

    await engine.resetBackoff();
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    expect(server.store.transactions.size).toBe(1);
    expect(server.store.transactions.get(saved.id).amount).toBe(25000);
  });

  it('re-queues ops interrupted mid-sync when the app restarts', async () => {
    await saveRecord(db, 'transactions', tx());
    await db.outbox.toCollection().modify({ status: 'syncing' }); // app was killed during a push
    await engine.start();
    expect(await db.outbox.count()).toBe(0);
    expect(server.store.transactions.size).toBe(1);
    engine.stop();
  });

  it('marks rejected ops as permanently failed without blocking later ops', async () => {
    server.rejectIf = (op) => (op.data?.amount === 1 ? 'amount: too small' : null);
    const bad = await saveRecord(db, 'transactions', tx({ amount: 1 }));
    const good = await saveRecord(db, 'transactions', tx({ amount: 2 }));
    await engine.sync();
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ recordId: bad.id, status: 'failed', permanent: true, error: 'amount: too small' });
    expect((await db.transactions.get(bad.id))._status).toBe('failed');
    expect(server.store.transactions.has(good.id)).toBe(true);
  });

  it('discarding a failed change restores the server state', async () => {
    server.rejectIf = () => 'nope';
    const bad = await saveRecord(db, 'transactions', tx());
    await engine.sync();
    const [op] = await db.outbox.toArray();
    server.rejectIf = () => null;
    server.get = async () => ({ data: { serverTime: new Date().toISOString(), full: true, changes: {} } });
    await engine.discard(op.seq);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.transactions.get(bad.id)).toBeUndefined();
  });

  it('pulls remote changes but never overwrites a local edit that is still queued', async () => {
    const mine = await saveRecord(db, 'transactions', tx({ description: 'local edit' }));
    const remoteId = crypto.randomUUID();
    server.store.transactions.set(remoteId, { ...tx({ description: 'from other phone' }), id: remoteId, deletedAt: null });
    server.store.transactions.set(mine.id, { ...tx({ description: 'older server copy' }), id: mine.id, deletedAt: null });
    server.online = true;
    // Pull only (simulate push failing first so the local op stays queued)
    await engine.pull();
    expect((await db.transactions.get(remoteId)).description).toBe('from other phone');
    expect((await db.transactions.get(mine.id)).description).toBe('local edit');
  });

  it('applies remote deletions', async () => {
    const saved = await saveRecord(db, 'transactions', tx());
    await engine.sync();
    server.store.transactions.get(saved.id).deletedAt = new Date().toISOString();
    await engine.sync();
    expect(await db.transactions.get(saved.id)).toBeUndefined();
  });

  it('backs off exponentially up to 5 minutes', () => {
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(300000);
  });
});
