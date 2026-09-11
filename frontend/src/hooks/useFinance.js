/**
 * Live data hooks. `useLiveQuery` re-runs whenever the underlying IndexedDB
 * tables change (local edit OR a sync), so every screen stays current.
 * Each returns `undefined` while loading.
 */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { enrichLoans, personBalances } from '@spendwise/shared';
import { useData } from './useData.jsx';

const byDateDesc = (a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''));

export function useCategories() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const rows = await db.categories.toArray();
    return rows.filter((c) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
  }, [db]);
}

/** Map id → category, including deleted ones so old transactions still show a name. */
export function useCategoryMap() {
  const { db } = useData();
  const rows = useLiveQuery(() => db.categories.toArray(), [db]);
  return useMemo(() => new Map((rows || []).map((c) => [c.id, c])), [rows]);
}

export function useTransactions() {
  const { db } = useData();
  return useLiveQuery(async () => (await db.transactions.toArray()).sort(byDateDesc), [db]);
}

export function useTransaction(id) {
  const { db } = useData();
  return useLiveQuery(() => (id ? db.transactions.get(id) : undefined), [db, id]);
}

export function usePeople() {
  const { db } = useData();
  return useLiveQuery(async () => (await db.people.toArray()).sort((a, b) => a.name.localeCompare(b.name)), [db]);
}

export function usePerson(id) {
  const { db } = useData();
  return useLiveQuery(async () => (await db.people.get(id)) ?? null, [db, id]);
}

export function useRepayments() {
  const { db } = useData();
  return useLiveQuery(async () => (await db.repayments.toArray()).sort(byDateDesc), [db]);
}

/** Loans with repaid / outstanding / status computed from repayments. */
export function useLoans() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const [loans, repayments] = await Promise.all([db.loans.toArray(), db.repayments.toArray()]);
    return enrichLoans(loans, repayments).sort(byDateDesc);
  }, [db]);
}

export function useLoan(id) {
  const { db } = useData();
  return useLiveQuery(async () => {
    const loan = await db.loans.get(id);
    if (!loan) return null;
    const repayments = (await db.repayments.where('loanId').equals(id).toArray()).sort(byDateDesc);
    const person = await db.people.get(loan.personId);
    return { ...enrichLoans([loan], repayments)[0], repayments, person };
  }, [db, id]);
}

/** Everything the dashboard/analytics need, in one live query. */
export function useFinancials() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const [transactions, loans, repayments, people] = await Promise.all([
      db.transactions.toArray(),
      db.loans.toArray(),
      db.repayments.toArray(),
      db.people.toArray(),
    ]);
    return { transactions, loans, repayments, people };
  }, [db]);
}

export function usePersonBalances() {
  const data = useFinancials();
  return useMemo(() => (data ? personBalances(data.people, data.loans, data.repayments) : undefined), [data]);
}

/** Outbox counts for sync indicators. */
export function useOutboxStats() {
  const { db } = useData();
  return useLiveQuery(async () => {
    const ops = await db.outbox.toArray();
    return {
      pending: ops.filter((o) => !(o.status === 'failed' && o.permanent)).length,
      failed: ops.filter((o) => o.status === 'failed' && o.permanent).length,
      retrying: ops.filter((o) => o.status === 'failed' && !o.permanent).length,
      ops,
    };
  }, [db]);
}
