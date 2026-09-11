/**
 * Pure financial calculations used by BOTH the React app (on IndexedDB data,
 * so the dashboard works offline) and the API (/dashboard endpoints).
 *
 * All amounts are integer minor units. Inputs are plain arrays of records;
 * soft-deleted records (deletedAt set) are ignored everywhere.
 */
import { sumMinor } from './money.js';
import { lastMonths, monthKey, todayISO } from './dates.js';

const alive = (r) => r && !r.deletedAt;

// ---------------------------------------------------------------- loans

/** Map loanId → total repaid (minor units). */
export function repaidByLoan(repayments = []) {
  const map = new Map();
  for (const r of repayments) {
    if (!alive(r)) continue;
    map.set(r.loanId, (map.get(r.loanId) || 0) + Math.round(Number(r.amount)));
  }
  return map;
}

/**
 * Loan status:
 *  - settled  → outstanding is zero
 *  - overdue  → has a due date in the past and money is still outstanding
 *  - partial  → some money was repaid
 *  - open     → nothing repaid yet
 */
export function loanStatus(loan, repaid, today = todayISO()) {
  const outstanding = Math.max(0, Math.round(Number(loan.amount)) - repaid);
  if (outstanding === 0) return 'settled';
  if (loan.dueDate && loan.dueDate < today) return 'overdue';
  if (repaid > 0) return 'partial';
  return 'open';
}

/** Decorate loans with repaid / outstanding / status. */
export function enrichLoans(loans = [], repayments = [], today = todayISO()) {
  const repaid = repaidByLoan(repayments);
  return loans.filter(alive).map((loan) => {
    const paid = repaid.get(loan.id) || 0;
    const amount = Math.round(Number(loan.amount));
    return {
      ...loan,
      repaid: paid,
      outstanding: Math.max(0, amount - paid),
      status: loanStatus(loan, paid, today),
      progress: amount > 0 ? Math.min(1, paid / amount) : 1,
    };
  });
}

/** Outstanding totals: how much others owe me, and how much I owe. */
export function loanTotals(loans = [], repayments = []) {
  let owedToMe = 0;
  let iOwe = 0;
  for (const l of enrichLoans(loans, repayments)) {
    if (l.direction === 'lent') owedToMe += l.outstanding;
    else iOwe += l.outstanding;
  }
  return { owedToMe, iOwe };
}

/** Per-person balances. net > 0 → they owe me; net < 0 → I owe them. */
export function personBalances(people = [], loans = [], repayments = []) {
  const result = new Map();
  for (const p of people.filter(alive)) {
    result.set(p.id, { owedToMe: 0, iOwe: 0, net: 0, activeLoans: 0, totalLoans: 0 });
  }
  for (const l of enrichLoans(loans, repayments)) {
    const b = result.get(l.personId);
    if (!b) continue;
    b.totalLoans += 1;
    if (l.outstanding > 0) b.activeLoans += 1;
    if (l.direction === 'lent') b.owedToMe += l.outstanding;
    else b.iOwe += l.outstanding;
    b.net = b.owedToMe - b.iOwe;
  }
  return result;
}

// ----------------------------------------------------------- summaries

/**
 * Dashboard summary.
 *
 * balance   = cash you actually have:
 *             income − expenses − money lent + money borrowed
 *             + repayments received − repayments paid
 * netWorth  = balance + owedToMe − iOwe  (equals income − expenses)
 *
 * periodIncome / periodExpense are for the given month ("YYYY-MM").
 */
export function computeSummary({ transactions = [], loans = [], repayments = [], month } = {}) {
  const txs = transactions.filter(alive);
  const liveLoans = loans.filter(alive);
  const loanById = new Map(liveLoans.map((l) => [l.id, l]));

  const totalIncome = sumMinor(txs.filter((t) => t.type === 'income').map((t) => t.amount));
  const totalExpense = sumMinor(txs.filter((t) => t.type === 'expense').map((t) => t.amount));

  const lent = sumMinor(liveLoans.filter((l) => l.direction === 'lent').map((l) => l.amount));
  const borrowed = sumMinor(liveLoans.filter((l) => l.direction === 'borrowed').map((l) => l.amount));

  let repaymentsReceived = 0;
  let repaymentsPaid = 0;
  for (const r of repayments.filter(alive)) {
    const loan = loanById.get(r.loanId);
    if (!loan) continue;
    if (loan.direction === 'lent') repaymentsReceived += Math.round(Number(r.amount));
    else repaymentsPaid += Math.round(Number(r.amount));
  }

  const { owedToMe, iOwe } = loanTotals(liveLoans, repayments);
  const balance = totalIncome - totalExpense - lent + borrowed + repaymentsReceived - repaymentsPaid;

  const m = month || monthKey(todayISO());
  const inMonth = txs.filter((t) => monthKey(t.date) === m);
  const periodIncome = sumMinor(inMonth.filter((t) => t.type === 'income').map((t) => t.amount));
  const periodExpense = sumMinor(inMonth.filter((t) => t.type === 'expense').map((t) => t.amount));

  return {
    month: m,
    balance,
    netWorth: balance + owedToMe - iOwe,
    totalIncome,
    totalExpense,
    periodIncome,
    periodExpense,
    periodNet: periodIncome - periodExpense,
    savingsRate: periodIncome > 0 ? (periodIncome - periodExpense) / periodIncome : null,
    owedToMe,
    iOwe,
  };
}

/**
 * Totals per category for one type ("expense" by default) and optional month.
 * Returns [{ categoryId, total, share }] sorted by total, largest first.
 */
export function categoryBreakdown(transactions = [], { type = 'expense', month } = {}) {
  const totals = new Map();
  let grand = 0;
  for (const t of transactions) {
    if (!alive(t) || t.type !== type) continue;
    if (month && monthKey(t.date) !== month) continue;
    const key = t.categoryId || null;
    const amt = Math.round(Number(t.amount));
    totals.set(key, (totals.get(key) || 0) + amt);
    grand += amt;
  }
  return [...totals.entries()]
    .map(([categoryId, total]) => ({ categoryId, total, share: grand > 0 ? total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Income vs expense for the last n months ending at endMonth. Oldest first. */
export function monthlyTotals(transactions = [], { months = 6, endMonth } = {}) {
  const keys = lastMonths(months, endMonth);
  const rows = new Map(keys.map((k) => [k, { month: k, income: 0, expense: 0, net: 0 }]));
  for (const t of transactions) {
    if (!alive(t)) continue;
    const row = rows.get(monthKey(t.date));
    if (!row) continue;
    const amt = Math.round(Number(t.amount));
    if (t.type === 'income') row.income += amt;
    else if (t.type === 'expense') row.expense += amt;
  }
  for (const row of rows.values()) row.net = row.income - row.expense;
  return keys.map((k) => rows.get(k));
}

/** Daily expense totals for a month, for trend charts. [{ date, expense }] */
export function dailyExpenses(transactions = [], month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  const map = new Map();
  for (const t of transactions) {
    if (!alive(t) || t.type !== 'expense' || monthKey(t.date) !== month) continue;
    map.set(t.date, (map.get(t.date) || 0) + Math.round(Number(t.amount)));
  }
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    out.push({ date, expense: map.get(date) || 0 });
  }
  return out;
}
