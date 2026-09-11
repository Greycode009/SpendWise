/**
 * Offline sync protocol.
 *
 * PUSH  POST /api/sync/push  { ops: [{ opId, entity, action, recordId, data, clientUpdatedAt }] }
 *   Ops are applied in order, each in its own database transaction.
 *   Every processed opId is remembered, so re-sending an op (because the
 *   phone lost the response) returns the original result without applying
 *   it twice — duplicate-sync protection.
 *
 *   Per-op result status:
 *     applied   the change is stored
 *     stale     ignored by the conflict rules; `record` holds the server copy
 *     rejected  permanently invalid (validation / ownership / business rule)
 *     error     unexpected server problem — safe to retry later
 *
 * PULL  GET /api/sync/pull?since=<serverTime from previous pull>
 *   Returns every record changed after `since` (including tombstones) and a
 *   new serverTime cursor. Without `since` it returns a full snapshot.
 */
import { ENTITY_NAMES } from '@spendwise/shared';
import { prisma } from '../lib/prisma.js';
import { syncOpSchema } from '../validators/schemas.js';
import { AppError, formatZodError } from '../utils/errors.js';
import { serialize } from '../utils/serialize.js';
import { deleteRecord, ENTITY_CONFIG, upsertRecord } from './records.service.js';

// Re-send a small window of recent changes on every pull. Writes that were
// still committing when the previous pull ran are therefore never missed.
// Re-applying a record the client already has is harmless.
export const PULL_OVERLAP_MS = 30_000;

// A client clock set in the future must not make its edits win forever.
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

function clampClientTime(iso) {
  const t = new Date(iso);
  const max = Date.now() + MAX_CLOCK_SKEW_MS;
  return t.getTime() > max ? new Date(max) : t;
}

async function applyOp(userId, op) {
  const clientUpdatedAt = clampClientTime(op.clientUpdatedAt);

  return prisma.$transaction(async (tx) => {
    const prior = await tx.syncOperation.findUnique({
      where: { userId_opId: { userId, opId: op.opId } },
    });
    if (prior) {
      const cfg = ENTITY_CONFIG[prior.entity];
      const current = cfg ? await tx[cfg.model].findUnique({ where: { id: prior.recordId } }) : null;
      return {
        opId: op.opId,
        status: prior.result,
        error: prior.error ?? undefined,
        duplicate: true,
        record: current && current.userId === userId ? serialize(current) : undefined,
      };
    }

    let outcome;
    try {
      outcome =
        op.action === 'upsert'
          ? await upsertRecord(tx, userId, op.entity, { ...(op.data || {}), id: op.recordId }, clientUpdatedAt)
          : await deleteRecord(tx, userId, op.entity, op.recordId, clientUpdatedAt);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      outcome = { status: 'rejected', error: err.message, code: err.code };
    }

    await tx.syncOperation.create({
      data: {
        userId,
        opId: op.opId,
        entity: op.entity,
        recordId: op.recordId,
        action: op.action,
        result: outcome.status,
        error: outcome.error ?? null,
      },
    });

    return {
      opId: op.opId,
      status: outcome.status,
      error: outcome.error,
      code: outcome.code,
      reason: outcome.reason,
      record: outcome.record ? serialize(outcome.record) : undefined,
    };
  });
}

export async function pushOps(userId, rawOps) {
  const results = [];
  for (const raw of rawOps) {
    const parsed = syncOpSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        opId: typeof raw?.opId === 'string' ? raw.opId : null,
        status: 'rejected',
        error: formatZodError(parsed.error).message,
      });
      continue;
    }
    try {
      results.push(await applyOp(userId, parsed.data));
    } catch (err) {
      // Unexpected failure for this op only: report it as retryable and keep
      // going, so one bad op cannot block the rest of the queue.
      console.error('[sync] op failed', parsed.data.opId, err);
      results.push({ opId: parsed.data.opId, status: 'error', error: 'Temporary server error, will retry' });
    }
  }
  return { serverTime: new Date().toISOString(), results };
}

export async function pullChanges(userId, since) {
  const serverTime = new Date();
  const where = since
    ? { userId, updatedAt: { gt: new Date(new Date(since).getTime() - PULL_OVERLAP_MS) } }
    : { userId, deletedAt: null };

  const changes = {};
  for (const entity of ENTITY_NAMES) {
    const rows = await prisma[ENTITY_CONFIG[entity].model].findMany({ where, orderBy: { updatedAt: 'asc' } });
    changes[entity] = rows.map(serialize);
  }
  return { serverTime: serverTime.toISOString(), full: !since, changes };
}

/** Forget processed op ids older than `days` (they only matter for retries). */
export async function pruneSyncLog(days = 60) {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { count } = await prisma.syncOperation.deleteMany({ where: { processedAt: { lt: cutoff } } });
  return count;
}
