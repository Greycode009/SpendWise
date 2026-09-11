/**
 * Local-first writes.
 *
 *   user action → write to IndexedDB + add an op to the outbox (one atomic
 *   Dexie transaction) → UI updates instantly → sync engine pushes the op
 *   when the device is online.
 */
import { ENTITY_TABLES } from './db.js';

/** Fields sent to the server for each entity (everything else is local/derived). */
export const ENTITY_FIELDS = {
  categories: ['name', 'type', 'icon', 'color'],
  people: ['name', 'phone', 'note'],
  transactions: ['type', 'amount', 'categoryId', 'date', 'description', 'paymentMethod', 'note'],
  loans: ['personId', 'direction', 'amount', 'date', 'dueDate', 'note'],
  repayments: ['loanId', 'amount', 'date', 'note'],
};

const newId = () => crypto.randomUUID();

export function toPayload(entity, record) {
  const out = {};
  for (const f of ENTITY_FIELDS[entity]) out[f] = record[f] ?? null;
  return out;
}

/**
 * Add an op to the outbox. Repeated edits of a record that has not been sent
 * yet are merged into the waiting op instead of queueing one op per edit.
 * (An op that was already attempted is never merged: the server may have
 * applied it even if we never saw the response.)
 */
async function enqueue(db, op) {
  if (op.action === 'upsert') {
    const waiting = await db.outbox
      .where('recordId')
      .equals(op.recordId)
      .filter((o) => o.action === 'upsert' && o.status === 'pending' && o.attempts === 0)
      .last();
    if (waiting) {
      await db.outbox.update(waiting.seq, { data: op.data, clientUpdatedAt: op.clientUpdatedAt, opId: newId() });
      return;
    }
  }
  await db.outbox.add({
    opId: newId(),
    entity: op.entity,
    action: op.action,
    recordId: op.recordId,
    data: op.data ?? null,
    clientUpdatedAt: op.clientUpdatedAt,
    status: 'pending', // pending → syncing → (removed when synced) | failed
    attempts: 0,
    permanent: false,
    error: null,
    nextAttemptAt: 0,
    createdAt: Date.now(),
  });
}

/** Create or update a record locally and queue it for sync. Returns the saved record. */
export async function saveRecord(db, entity, input) {
  const now = new Date().toISOString();
  const table = db.table(entity);
  let saved;
  await db.transaction('rw', table, db.outbox, async () => {
    const existing = input.id ? await table.get(input.id) : null;
    // Only real fields are stored — never derived values (outstanding, status…)
    // that a screen may have attached to the object it is editing.
    const fields = {};
    for (const f of ENTITY_FIELDS[entity]) if (f in input) fields[f] = input[f] ?? null;
    saved = {
      ...(existing || {}),
      ...fields,
      id: input.id || newId(),
      createdAt: existing?.createdAt || now,
      clientUpdatedAt: now,
      _status: 'pending',
    };
    await table.put(saved);
    await enqueue(db, { entity, action: 'upsert', recordId: saved.id, data: toPayload(entity, saved), clientUpdatedAt: now });
  });
  return saved;
}

/** Delete locally (with the same cascade the server applies) and queue the delete. */
export async function deleteRecord(db, entity, id) {
  const now = new Date().toISOString();
  await db.transaction('rw', [...ENTITY_TABLES.map((t) => db.table(t)), db.outbox], async () => {
    let loanIds = [];
    if (entity === 'people') loanIds = await db.loans.where('personId').equals(id).primaryKeys();
    if (entity === 'loans') loanIds = [id];
    if (loanIds.length) {
      await db.repayments.where('loanId').anyOf(loanIds).delete();
      if (entity === 'people') await db.loans.bulkDelete(loanIds);
    }
    await db.table(entity).delete(id);
    await enqueue(db, { entity, action: 'delete', recordId: id, clientUpdatedAt: now });
  });
}
