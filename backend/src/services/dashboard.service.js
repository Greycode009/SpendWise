import { categoryBreakdown, computeSummary, monthlyTotals } from '@spendwise/shared';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../utils/serialize.js';

async function loadFinancials(userId) {
  const where = { userId, deletedAt: null };
  const [transactions, loans, repayments, categories] = await Promise.all([
    prisma.transaction.findMany({ where }),
    prisma.loan.findMany({ where }),
    prisma.repayment.findMany({ where }),
    prisma.category.findMany({ where: { userId } }),
  ]);
  return {
    transactions: transactions.map(serialize),
    loans: loans.map(serialize),
    repayments: repayments.map(serialize),
    categories: categories.map(serialize),
  };
}

export async function getSummary(userId, month) {
  const { transactions, loans, repayments } = await loadFinancials(userId);
  const summary = computeSummary({ transactions, loans, repayments, month });
  const recent = [...transactions]
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
    .slice(0, 10);
  return { ...summary, recent };
}

export async function getAnalytics(userId, { month, months }) {
  const { transactions, categories } = await loadFinancials(userId);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const withNames = (rows) =>
    rows.map((r) => ({
      ...r,
      name: byId.get(r.categoryId)?.name ?? 'Uncategorized',
      icon: byId.get(r.categoryId)?.icon ?? null,
      color: byId.get(r.categoryId)?.color ?? '#94a3b8',
    }));
  return {
    month: month ?? null,
    monthly: monthlyTotals(transactions, { months, endMonth: month }),
    expenseByCategory: withNames(categoryBreakdown(transactions, { type: 'expense', month })),
    incomeByCategory: withNames(categoryBreakdown(transactions, { type: 'income', month })),
  };
}
