/**
 * REST controllers for the financial entities. Thin HTTP layer: all rules
 * live in records.service.js (shared with the sync endpoint).
 */
import crypto from 'node:crypto';
import { enrichLoans } from '@spendwise/shared';
import { prisma } from '../lib/prisma.js';
import { deleteRecord, ENTITY_CONFIG, getRecord, listRecords, upsertRecord } from '../services/records.service.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { isUuid } from '../utils/ids.js';
import { serialize } from '../utils/serialize.js';

async function createRecord(userId, entity, body) {
  const id = body?.id ?? crypto.randomUUID();
  if (!isUuid(id)) throw badRequest('id: must be a valid UUID');
  return prisma.$transaction(async (tx) => {
    const exists = await tx[ENTITY_CONFIG[entity].model].findUnique({ where: { id }, select: { id: true } });
    if (exists) throw conflict('A record with this id already exists');
    const result = await upsertRecord(tx, userId, entity, { ...body, id }, new Date());
    return result.record;
  });
}

async function updateRecord(userId, entity, id, body) {
  return prisma.$transaction(async (tx) => {
    const existing = await getRecord(tx, userId, entity, id);
    const merged = { ...serialize(existing), ...body, id };
    const result = await upsertRecord(tx, userId, entity, merged, new Date());
    if (result.status !== 'applied') throw conflict('A newer version of this record exists', 'STALE');
    return result.record;
  });
}

async function removeRecord(userId, entity, id) {
  const result = await prisma.$transaction((tx) => deleteRecord(tx, userId, entity, id, new Date()));
  if (result.missing || !result.record) throw notFound();
}

/** Standard list/get/create/update/delete handlers for an entity. */
export function crud(entity, { listWhere } = {}) {
  return {
    list: async (req, res) => {
      const where = listWhere ? listWhere(req) : {};
      const rows = await listRecords(prisma, req.userId, entity, where);
      res.json({ data: rows.map(serialize) });
    },
    get: async (req, res) => {
      res.json({ data: serialize(await getRecord(prisma, req.userId, entity, req.params.id)) });
    },
    create: async (req, res) => {
      res.status(201).json({ data: serialize(await createRecord(req.userId, entity, req.body)) });
    },
    update: async (req, res) => {
      res.json({ data: serialize(await updateRecord(req.userId, entity, req.params.id, req.body)) });
    },
    remove: async (req, res) => {
      await removeRecord(req.userId, entity, req.params.id);
      res.status(204).end();
    },
  };
}

// ----------------------------------------------------------- transactions

export const transactions = {
  ...crud('transactions'),
  list: async (req, res) => {
    const { type, from, to, categoryId, q, limit, offset } = req.valid.query;
    const where = {};
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (from || to) where.date = { ...(from && { gte: new Date(`${from}T00:00:00Z`) }), ...(to && { lte: new Date(`${to}T00:00:00Z`) }) };
    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await listRecords(prisma, req.userId, 'transactions', where, { take: limit, skip: offset });
    res.json({ data: rows.map(serialize) });
  },
};

// ----------------------------------------------------------- loans

async function loadRepayments(userId, loanIds) {
  const rows = await prisma.repayment.findMany({
    where: { userId, deletedAt: null, loanId: { in: loanIds } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(serialize);
}

export const loans = {
  ...crud('loans'),
  list: async (req, res) => {
    const { personId } = req.query;
    if (personId !== undefined && !isUuid(personId)) throw badRequest('personId: must be a valid UUID');
    const where = personId ? { personId } : {};
    const rows = (await listRecords(prisma, req.userId, 'loans', where)).map(serialize);
    const repayments = await loadRepayments(req.userId, rows.map((l) => l.id));
    res.json({ data: enrichLoans(rows, repayments) });
  },
  get: async (req, res) => {
    const loan = serialize(await getRecord(prisma, req.userId, 'loans', req.params.id));
    const repayments = await loadRepayments(req.userId, [loan.id]);
    res.json({ data: { ...enrichLoans([loan], repayments)[0], repayments } });
  },
};

export const repayments = {
  ...crud('repayments'),
  listForLoan: async (req, res) => {
    await getRecord(prisma, req.userId, 'loans', req.params.id);
    res.json({ data: await loadRepayments(req.userId, [req.params.id]) });
  },
  createForLoan: async (req, res) => {
    const record = await createRecord(req.userId, 'repayments', { ...req.body, loanId: req.params.id });
    res.status(201).json({ data: serialize(record) });
  },
};

export const categories = crud('categories');
export const people = crud('people');
