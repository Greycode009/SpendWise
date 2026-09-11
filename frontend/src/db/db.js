/**
 * IndexedDB (via Dexie) — the app's primary data store.
 *
 * Every screen reads from here, never directly from the network, which is
 * what makes the app work offline. Each account gets its own database so two
 * people sharing a device never see each other's records.
 */
import Dexie from 'dexie';

export const ENTITY_TABLES = ['categories', 'people', 'transactions', 'loans', 'repayments'];

export function createUserDb(userId, { indexedDB, IDBKeyRange } = {}) {
  const db = new Dexie(`spendwise-${userId}`, indexedDB ? { indexedDB, IDBKeyRange } : undefined);
  db.version(1).stores({
    // Local records mirror the server rows plus `_status`: pending | synced | failed
    categories: 'id, type, name',
    people: 'id, name',
    transactions: 'id, date, type, categoryId',
    loans: 'id, personId, date',
    repayments: 'id, loanId, date',
    // Sync queue ("outbox"): one row per local change waiting for the server.
    outbox: '++seq, &opId, recordId, entity, status',
    // Key/value: lastPulledAt cursor, lastSyncedAt, pending profile changes…
    meta: 'key',
  });
  return db;
}

export async function getMeta(db, key, fallback = null) {
  const row = await db.meta.get(key);
  return row ? row.value : fallback;
}

export function setMeta(db, key, value) {
  return db.meta.put({ key, value });
}

export async function deleteUserDb(userId) {
  await Dexie.delete(`spendwise-${userId}`);
}
