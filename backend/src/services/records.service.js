/**
 * Generic, ownership-checked create/update/delete for every financial entity.
 *
 * BOTH the REST endpoints and the offline sync endpoint go through these
 * functions, so validation, authorization and conflict rules are identical no
 * matter how a change reaches the server.
 *
 * Conflict rules (deterministic, never silent):
 *  1. A record belongs to exactly one user. Touching another user's id → 404.
 *  2. Deletes are final: once a record is deleted (tombstoned), later upserts
 *     for it are ignored ("stale") instead of resurrecting it.
 *  3. Otherwise last-write-wins by clientUpdatedAt: an older edit arriving
 *     after a newer one is ignored ("stale").
 */
import { isoToDate, repaidByLoan } from '@spendwise/shared';
import {
  categorySchema,
  loanSchema,
  personSchema,
  repaymentSchema,
  transactionSchema,
} from '../validators/schemas.js';
import { AppError, badRequest, formatZodError, notFound } from '../utils/errors.js';

export const ENTITY_CONFIG = {
  categories: { model: 'category', schema: categorySchema, label: 'Category', orderBy: [{ type: 'asc' }, { name: 'asc' }] },
  people: { model: 'person', schema: personSchema, label: 'Person', orderBy: [{ name: 'asc' }] },
  transactions: {
    model: 'transaction',
    schema: transactionSchema,
    label: 'Transaction',
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    refs: [{ field: 'categoryId', entity: 'categories', allowDeleted: true }],
  },
  loans: {
    model: 'loan',
    schema: loanSchema,
    label: 'Loan',
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    refs: [{ field: 'personId', entity: 'people' }],
  },
  repayments: {
    model: 'repayment',
    schema: repaymentSchema,
    label: 'Repayment',
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    refs: [{ field: 'loanId', entity: 'loans' }],
  },
};

export const ENTITY_KEYS = Object.keys(ENTITY_CONFIG);

const invalidReference = (message) => new AppError(422, 'INVALID_REFERENCE', message);

function getConfig(entity) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) throw badRequest(`Unknown entity "${entity}"`);
  return cfg;
}

/** Convert validated API values into database values. */
function toDb(data) {
  const out = { ...data };
  delete out.id;
  if ('amount' in out) out.amount = BigInt(out.amount);
  if ('date' in out) out.date = isoToDate(out.date);
  if ('dueDate' in out) out.dueDate = out.dueDate ? isoToDate(out.dueDate) : null;
  for (const key of Object.keys(out)) if (out[key] === undefined) out[key] = null;
  return out;
}

export function parseRecord(entity, input) {
  const result = getConfig(entity).schema.safeParse(input);
  if (!result.success) {
    const { message, details } = formatZodError(result.error);
    throw badRequest(message, details);
  }
  return result.data;
}

/** Ensure every referenced record exists and belongs to the same user. */
async function checkReferences(db, userId, cfg, data) {
  const found = {};
  for (const ref of cfg.refs ?? []) {
    const id = data[ref.field];
    if (!id) continue;
    const refCfg = ENTITY_CONFIG[ref.entity];
    const row = await db[refCfg.model].findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw invalidReference(`${refCfg.label} referenced by ${ref.field} does not exist`);
    }
    if (row.deletedAt && !ref.allowDeleted) {
      throw invalidReference(`${refCfg.label} referenced by ${ref.field} has been deleted`);
    }
    found[ref.field] = row;
  }
  return found;
}

async function repaidTotal(db, loanId, excludeRepaymentId) {
  const rows = await db.repayment.findMany({
    where: { loanId, deletedAt: null, ...(excludeRepaymentId ? { id: { not: excludeRepaymentId } } : {}) },
    select: { loanId: true, amount: true },
  });
  return repaidByLoan(rows.map((r) => ({ ...r, amount: Number(r.amount) }))).get(loanId) || 0;
}

/** Business rules that go beyond field validation. */
async function checkBusinessRules(db, entity, data, refs, existing) {
  if (entity === 'transactions' && refs.categoryId && refs.categoryId.type !== data.type) {
    throw invalidReference(`Category "${refs.categoryId.name}" is for ${refs.categoryId.type}, not ${data.type}`);
  }
  if (entity === 'loans' && existing) {
    const repaid = await repaidTotal(db, data.id);
    if (data.amount < repaid) {
      throw badRequest(`Loan amount cannot be less than the ${repaid / 100} already repaid`);
    }
  }
  if (entity === 'repayments') {
    const loan = refs.loanId;
    const otherRepaid = await repaidTotal(db, loan.id, data.id);
    const outstanding = Number(loan.amount) - otherRepaid;
    if (data.amount > outstanding) {
      throw badRequest(`Repayment exceeds the outstanding amount of ${outstanding / 100}`);
    }
  }
}

/**
 * Create or update a record.
 * @returns {{status: 'applied'|'stale', record: object, reason?: string}}
 */
export async function upsertRecord(db, userId, entity, input, clientUpdatedAt = new Date()) {
  const cfg = getConfig(entity);
  const data = parseRecord(entity, input);
  const model = db[cfg.model];

  const existing = await model.findUnique({ where: { id: data.id } });
  if (existing && existing.userId !== userId) throw notFound(`${cfg.label} not found`);
  if (existing?.deletedAt) return { status: 'stale', reason: 'deleted', record: existing };
  if (existing && existing.clientUpdatedAt > clientUpdatedAt) {
    return { status: 'stale', reason: 'newer-version-exists', record: existing };
  }

  const refs = await checkReferences(db, userId, cfg, data);
  await checkBusinessRules(db, entity, data, refs, existing);

  const values = { ...toDb(data), clientUpdatedAt };
  const record = existing
    ? await model.update({ where: { id: data.id }, data: values })
    : await model.create({ data: { ...values, id: data.id, userId } });
  return { status: 'applied', record, created: !existing };
}

/** Soft-delete dependants so the deletion syncs to other devices too. */
async function cascadeDelete(db, userId, entity, id, now) {
  if (entity === 'people') {
    const loans = await db.loan.findMany({ where: { userId, personId: id, deletedAt: null }, select: { id: true } });
    const loanIds = loans.map((l) => l.id);
    if (loanIds.length) {
      await db.repayment.updateMany({ where: { userId, loanId: { in: loanIds }, deletedAt: null }, data: { deletedAt: now } });
      await db.loan.updateMany({ where: { userId, id: { in: loanIds } }, data: { deletedAt: now } });
    }
  }
  if (entity === 'loans') {
    await db.repayment.updateMany({ where: { userId, loanId: id, deletedAt: null }, data: { deletedAt: now } });
  }
}

/**
 * Soft-delete a record (and its dependants).
 * @returns {{status: 'applied', record: object|null, missing?: boolean}}
 */
export async function deleteRecord(db, userId, entity, id, clientUpdatedAt = new Date()) {
  const cfg = getConfig(entity);
  const model = db[cfg.model];
  const existing = await model.findUnique({ where: { id } });
  if (!existing) return { status: 'applied', record: null, missing: true };
  if (existing.userId !== userId) throw notFound(`${cfg.label} not found`);
  if (existing.deletedAt) return { status: 'applied', record: existing };

  const now = new Date();
  const record = await model.update({ where: { id }, data: { deletedAt: now, clientUpdatedAt } });
  await cascadeDelete(db, userId, entity, id, now);
  return { status: 'applied', record };
}

// ------------------------------------------------------------ reads

export async function listRecords(db, userId, entity, where = {}, { take, skip } = {}) {
  const cfg = getConfig(entity);
  return db[cfg.model].findMany({
    where: { userId, deletedAt: null, ...where },
    orderBy: cfg.orderBy,
    take,
    skip,
  });
}

export async function getRecord(db, userId, entity, id) {
  const cfg = getConfig(entity);
  const row = await db[cfg.model].findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw notFound(`${cfg.label} not found`);
  return row;
}
