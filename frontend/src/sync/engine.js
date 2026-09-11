/**
 * Sync engine — moves local changes to the server and server changes to
 * this device.
 *
 *  1. PUSH  outbox ops (oldest first) → POST /sync/push
 *           applied/stale → op removed, local record marked synced
 *           rejected      → op kept as permanently FAILED (user can discard)
 *           network/server error → op FAILED, retried with exponential backoff
 *  2. PULL  GET /sync/pull?since=cursor → merge into IndexedDB. Records that
 *           still have local changes waiting are never overwritten.
 *
 * Duplicate protection: every op carries a unique opId and the server
 * remembers processed ids. If the app dies mid-sync, ops left in "syncing"
 * are simply sent again on the next start — the server answers "duplicate".
 */
import { ENTITY_NAMES } from '@spendwise/shared';
import { getMeta, setMeta } from '../db/db.js';

const BATCH_SIZE = 100;
const MAX_SERVER_ERROR_ATTEMPTS = 8;

export function backoffMs(attempts) {
  return Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, attempts - 1)); // 2s, 4s, 8s … max 5 min
}

// An HTTP request that got no response at all (offline, DNS failure, timeout).
const isNetworkError = (err) => Boolean(err?.isAxiosError) && !err.response;

export class SyncEngine {
  /**
   * @param {object} opts
   * @param {import('dexie').Dexie} opts.db
   * @param {{get: Function, post: Function, patch: Function}} opts.client Axios-like HTTP client
   * @param {() => boolean} [opts.isOnline]
   * @param {() => boolean} [opts.canSync]  false while the session is expired
   * @param {(user: object) => void} [opts.onProfile]
   */
  constructor({ db, client, isOnline = () => navigator.onLine, canSync = () => true, onProfile = () => {}, now = () => Date.now() }) {
    this.db = db;
    this.client = client;
    this.isOnline = isOnline;
    this.canSync = canSync;
    this.onProfile = onProfile;
    this.now = now;
    this.running = null;
    this.again = false;
    this.timer = null;
    this.listeners = new Set();
    this.state = { phase: 'idle', lastSyncedAt: null, lastError: null };
    this.cleanup = [];
  }

  // ---------------------------------------------------------------- state

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState() {
    return this.state;
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  // ---------------------------------------------------------------- lifecycle

  async start() {
    // Ops interrupted mid-flight (app closed, tab killed) go back to the queue.
    await this.db.outbox.where('status').equals('syncing').modify({ status: 'pending' });
    this.setState({ lastSyncedAt: await getMeta(this.db, 'lastSyncedAt') });

    if (typeof window !== 'undefined') {
      const onOnline = () => {
        this.resetBackoff().then(() => this.sync());
      };
      const onOffline = () => this.setState({ phase: 'offline' });
      const onVisible = () => document.visibilityState === 'visible' && this.request(0);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      document.addEventListener('visibilitychange', onVisible);
      const interval = setInterval(() => document.visibilityState === 'visible' && this.sync(), 60_000);
      this.cleanup.push(() => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        document.removeEventListener('visibilitychange', onVisible);
        clearInterval(interval);
      });
    }
    return this.sync();
  }

  stop() {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    clearTimeout(this.timer);
    this.listeners.clear();
  }

  /** Schedule a sync soon (debounced) — called after every local change. */
  request(delay = 400) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(), delay);
  }

  /** Make transiently-failed ops eligible immediately (e.g. connection came back). */
  async resetBackoff() {
    await this.db.outbox
      .filter((o) => o.status === 'failed' && !o.permanent)
      .modify({ nextAttemptAt: 0 });
  }

  // ---------------------------------------------------------------- sync

  /** Push then pull. Only one sync runs at a time; calls during a run queue one more. */
  sync({ full = false } = {}) {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    if (!this.isOnline()) {
      this.setState({ phase: 'offline' });
      return Promise.resolve();
    }
    if (!this.canSync()) {
      this.setState({ phase: 'paused' });
      return Promise.resolve();
    }

    this.running = (async () => {
      this.setState({ phase: 'syncing' });
      try {
        let pushed;
        do {
          pushed = await this.push();
        } while (pushed === BATCH_SIZE);
        await this.pull({ full: full || (await getMeta(this.db, 'needsFullResync', false)) });
        await this.syncProfile();
        const lastSyncedAt = new Date(this.now()).toISOString();
        await setMeta(this.db, 'lastSyncedAt', lastSyncedAt);
        this.setState({ phase: 'idle', lastSyncedAt, lastError: null });
      } catch (err) {
        const offline = isNetworkError(err) || !this.isOnline();
        this.setState({
          phase: offline ? 'offline' : this.canSync() ? 'error' : 'paused',
          lastError: offline ? null : err?.response?.data?.error?.message || err?.message || 'Sync failed',
        });
      } finally {
        this.running = null;
        if (this.again) {
          this.again = false;
          this.request(0);
        }
      }
    })();
    return this.running;
  }

  /** Push one batch. Returns the number of ops sent. */
  async push() {
    const { db } = this;
    const now = this.now();
    const queue = await db.outbox.orderBy('seq').toArray();

    const batch = [];
    for (const op of queue) {
      if (op.permanent) continue; // waiting for the user to fix/discard
      if (op.status === 'syncing') continue;
      if (op.status === 'failed' && op.nextAttemptAt > now) break; // keep order while backing off
      batch.push(op);
      if (batch.length === BATCH_SIZE) break;
    }
    if (!batch.length) return 0;

    await db.outbox.bulkUpdate(batch.map((op) => ({ key: op.seq, changes: { status: 'syncing' } })));

    let results;
    try {
      const { data } = await this.client.post('/sync/push', {
        ops: batch.map(({ opId, entity, action, recordId, data: payload, clientUpdatedAt }) => ({
          opId,
          entity,
          action,
          recordId,
          ...(payload ? { data: payload } : {}),
          clientUpdatedAt,
        })),
      });
      results = new Map(data.results.map((r) => [r.opId, r]));
    } catch (err) {
      // Whole request failed: every op in the batch will be retried later.
      await this.markRetry(batch, err, { countsTowardLimit: !isNetworkError(err) && err?.response?.status >= 500 });
      throw err;
    }

    const tables = ENTITY_NAMES.map((t) => db.table(t));
    await db.transaction('rw', [...tables, db.outbox], async () => {
      for (const op of batch) {
        const r = results.get(op.opId);
        if (!r || r.status === 'error') {
          await this.markRetry([op], new Error(r?.error || 'No result from server'), { countsTowardLimit: true, inTx: true });
          continue;
        }
        if (r.status === 'rejected') {
          await db.outbox.update(op.seq, { status: 'failed', permanent: true, error: r.error || 'Rejected by server', attempts: op.attempts + 1 });
          if (op.action === 'upsert') await db.table(op.entity).update(op.recordId, { _status: 'failed' });
          continue;
        }
        // applied or stale → done with this op
        await db.outbox.delete(op.seq);
        const stillQueued = await db.outbox.where('recordId').equals(op.recordId).count();
        if (stillQueued) continue; // a newer local change is waiting; keep local version
        const table = db.table(op.entity);
        if (r.record?.deletedAt) await table.delete(op.recordId);
        else if (r.record && op.action === 'upsert') await table.put({ ...r.record, _status: 'synced' });
      }
    });
    return batch.length;
  }

  async markRetry(ops, err, { countsTowardLimit = false, inTx = false } = {}) {
    const run = async () => {
      for (const op of ops) {
        const attempts = op.attempts + 1;
        const permanent = countsTowardLimit && attempts >= MAX_SERVER_ERROR_ATTEMPTS;
        await this.db.outbox.update(op.seq, {
          status: 'failed',
          attempts,
          permanent,
          nextAttemptAt: this.now() + backoffMs(attempts),
          error: isNetworkError(err) ? 'Waiting for connection' : err?.response?.data?.error?.message || err?.message || 'Sync failed',
        });
        if (permanent && op.action === 'upsert') await this.db.table(op.entity).update(op.recordId, { _status: 'failed' });
      }
    };
    return inTx ? run() : this.db.transaction('rw', [this.db.outbox, ...ENTITY_NAMES.map((t) => this.db.table(t))], run);
  }

  /** Download changes since the last pull (or everything when `full`). */
  async pull({ full = false } = {}) {
    const { db } = this;
    const since = full ? null : await getMeta(db, 'lastPulledAt');
    const { data } = await this.client.get('/sync/pull', { params: since ? { since } : {} });
    await this.applyPulled(data.changes, data.full);
    await setMeta(db, 'lastPulledAt', data.serverTime);
    if (data.full) await setMeta(db, 'needsFullResync', false);
  }

  async applyPulled(changes, full) {
    const { db } = this;
    const tables = ENTITY_NAMES.map((t) => db.table(t));
    await db.transaction('rw', [...tables, db.outbox], async () => {
      const queued = new Set((await db.outbox.toArray()).map((o) => o.recordId));
      for (const entity of ENTITY_NAMES) {
        const table = db.table(entity);
        const rows = changes?.[entity] || [];
        if (full) {
          // A full snapshot is the complete truth: drop local rows the server
          // does not have, unless they are local changes still waiting to sync.
          const serverIds = new Set(rows.map((r) => r.id));
          const localIds = await table.toCollection().primaryKeys();
          await table.bulkDelete(localIds.filter((id) => !serverIds.has(id) && !queued.has(id)));
        }
        const puts = [];
        const dels = [];
        for (const row of rows) {
          if (queued.has(row.id)) continue; // local edit wins until it is pushed
          if (row.deletedAt) dels.push(row.id);
          else puts.push({ ...row, _status: 'synced' });
        }
        if (dels.length) await table.bulkDelete(dels);
        if (puts.length) await table.bulkPut(puts);
      }
    });
  }

  /** Send a pending profile change (currency/name) made while offline. */
  async syncProfile() {
    const patch = await getMeta(this.db, 'profilePatch');
    if (!patch) return;
    const { data } = await this.client.patch('/auth/me', patch);
    await setMeta(this.db, 'profilePatch', null);
    this.onProfile(data.user);
  }

  // ---------------------------------------------------------------- user actions

  /** Retry everything now, including ops the server rejected before. */
  async retryAll() {
    await this.db.outbox.filter((o) => o.status === 'failed').modify({ status: 'pending', permanent: false, nextAttemptAt: 0 });
    return this.sync();
  }

  /** Drop a failed local change and restore the server's version of the data. */
  async discard(seq) {
    const op = await this.db.outbox.get(seq);
    if (!op) return;
    await this.db.outbox.delete(seq);
    await setMeta(this.db, 'needsFullResync', true);
    return this.sync({ full: true });
  }
}
