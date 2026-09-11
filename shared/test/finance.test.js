import { describe, expect, it } from 'vitest';
import {
  toMinor,
  minorToInput,
  formatMoney,
  computeSummary,
  enrichLoans,
  loanStatus,
  personBalances,
  categoryBreakdown,
  monthlyTotals,
  dailyExpenses,
  isISODate,
  shiftMonth,
  lastMonths,
} from '../src/index.js';

describe('money', () => {
  it('parses user input into integer minor units', () => {
    expect(toMinor('250')).toBe(25000);
    expect(toMinor('1,250.5')).toBe(125050);
    expect(toMinor('0.07')).toBe(7);
    expect(toMinor('.5')).toBe(50);
    expect(toMinor(99.99)).toBe(9999);
    expect(toMinor('  12 ')).toBe(1200);
  });

  it('rejects invalid amounts', () => {
    expect(toMinor('')).toBeNull();
    expect(toMinor('abc')).toBeNull();
    expect(toMinor('-5')).toBeNull();
    expect(toMinor('1.234')).toBeNull();
    expect(toMinor('1e5')).toBeNull();
    expect(toMinor(null)).toBeNull();
  });

  it('avoids floating point drift', () => {
    expect(toMinor('0.1') + toMinor('0.2')).toBe(toMinor('0.3'));
  });

  it('round-trips to input strings', () => {
    expect(minorToInput(125050)).toBe('1250.50');
    expect(minorToInput(25000)).toBe('250');
    expect(minorToInput(7)).toBe('0.07');
  });

  it('formats currency', () => {
    expect(formatMoney(125050, 'USD')).toBe('$1,250.50');
    expect(formatMoney(25000, 'USD')).toBe('$250');
    expect(formatMoney(10000000, 'NPR')).toMatch(/1,00,000$/); // lakh grouping
    expect(formatMoney(131050, 'NPR', { compact: true })).toMatch(/1\.3K$/); // never "1.3T" 
  });
});

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-2-1')).toBe(false);
  });
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(lastMonths(3, '2026-02')).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

const loans = [
  { id: 'l1', personId: 'p1', direction: 'lent', amount: 100000, date: '2026-08-01', dueDate: '2026-08-15' },
  { id: 'l2', personId: 'p1', direction: 'borrowed', amount: 30000, date: '2026-09-01' },
  { id: 'l3', personId: 'p2', direction: 'lent', amount: 50000, date: '2026-09-02' },
  { id: 'l4', personId: 'p2', direction: 'lent', amount: 99999, date: '2026-09-02', deletedAt: '2026-09-03T00:00:00Z' },
];
const repayments = [
  { id: 'r1', loanId: 'l1', amount: 40000, date: '2026-08-10' },
  { id: 'r2', loanId: 'l3', amount: 50000, date: '2026-09-05' },
  { id: 'r3', loanId: 'l2', amount: 10000, date: '2026-09-06' },
  { id: 'r4', loanId: 'l1', amount: 5000, date: '2026-09-06', deletedAt: '2026-09-07T00:00:00Z' },
];

describe('loans', () => {
  it('computes outstanding and status', () => {
    const enriched = enrichLoans(loans, repayments, '2026-09-11');
    const byId = Object.fromEntries(enriched.map((l) => [l.id, l]));
    expect(enriched).toHaveLength(3); // deleted loan ignored
    expect(byId.l1).toMatchObject({ repaid: 40000, outstanding: 60000, status: 'overdue' });
    expect(byId.l2).toMatchObject({ repaid: 10000, outstanding: 20000, status: 'partial' });
    expect(byId.l3).toMatchObject({ outstanding: 0, status: 'settled', progress: 1 });
  });

  it('marks untouched loans as open', () => {
    expect(loanStatus({ amount: 100, dueDate: '2030-01-01' }, 0, '2026-09-11')).toBe('open');
  });

  it('computes per-person balances', () => {
    const b = personBalances([{ id: 'p1' }, { id: 'p2' }], loans, repayments);
    expect(b.get('p1')).toMatchObject({ owedToMe: 60000, iOwe: 20000, net: 40000, activeLoans: 2 });
    expect(b.get('p2')).toMatchObject({ owedToMe: 0, iOwe: 0, net: 0, activeLoans: 0, totalLoans: 1 });
  });
});

describe('summary', () => {
  const transactions = [
    { id: 't1', type: 'income', amount: 5000000, date: '2026-09-01', categoryId: 'salary' },
    { id: 't2', type: 'expense', amount: 120000, date: '2026-09-03', categoryId: 'food' },
    { id: 't3', type: 'expense', amount: 80000, date: '2026-09-04', categoryId: 'transport' },
    { id: 't4', type: 'expense', amount: 30000, date: '2026-08-20', categoryId: 'food' },
    { id: 't5', type: 'expense', amount: 999999, date: '2026-09-04', deletedAt: '2026-09-05T00:00:00Z' },
  ];

  it('computes balance, net worth and month totals', () => {
    const s = computeSummary({ transactions, loans, repayments, month: '2026-09' });
    // income − expense = 5,000,000 − 230,000 = 4,770,000
    // − lent (150,000) + borrowed (30,000) + received (90,000) − paid (10,000)
    expect(s.balance).toBe(4770000 - 150000 + 30000 + 90000 - 10000);
    expect(s.owedToMe).toBe(60000);
    expect(s.iOwe).toBe(20000);
    expect(s.netWorth).toBe(4770000);
    expect(s.periodIncome).toBe(5000000);
    expect(s.periodExpense).toBe(200000);
    expect(s.savingsRate).toBeCloseTo(0.96);
  });

  it('breaks down spending by category', () => {
    const rows = categoryBreakdown(transactions, { month: '2026-09' });
    expect(rows.map((r) => r.categoryId)).toEqual(['food', 'transport']);
    expect(rows[0].share).toBeCloseTo(0.6);
  });

  it('builds monthly totals', () => {
    const rows = monthlyTotals(transactions, { months: 2, endMonth: '2026-09' });
    expect(rows).toEqual([
      { month: '2026-08', income: 0, expense: 30000, net: -30000 },
      { month: '2026-09', income: 5000000, expense: 200000, net: 4800000 },
    ]);
  });

  it('builds daily expenses for every day of the month', () => {
    const rows = dailyExpenses(transactions, '2026-09');
    expect(rows).toHaveLength(30);
    expect(rows[3]).toEqual({ date: '2026-09-04', expense: 80000 });
  });
});
