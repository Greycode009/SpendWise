import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, BarChart3 } from 'lucide-react';
import { categoryBreakdown, computeSummary, currentMonthKey, dailyExpenses, monthlyTotals, shiftMonth } from '@spendwise/shared';
import PageHeader from '../components/PageHeader.jsx';
import { CategoryDonut, DailyBars, MonthlyBars } from '../components/charts.jsx';
import { CategoryIcon, EmptyState, Money, MonthSwitcher, Section } from '../components/ui.jsx';
import { useCategoryMap, useFinancials } from '../hooks/useFinance.js';
import { cx, monthLabel } from '../utils/format.js';

function Kpi({ label, children, hint }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 text-xl font-bold">{children}</div>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export default function Analytics() {
  const data = useFinancials();
  const categories = useCategoryMap();
  const [month, setMonth] = useState(currentMonthKey());

  const view = useMemo(() => {
    if (!data) return null;
    const summary = computeSummary({ ...data, month });
    const prev = computeSummary({ ...data, month: shiftMonth(month, -1) });
    const decorate = (rows) =>
      rows.map((r) => ({
        ...r,
        category: categories.get(r.categoryId),
        name: categories.get(r.categoryId)?.name ?? 'Uncategorized',
        color: categories.get(r.categoryId)?.color ?? '#94a3b8',
      }));
    return {
      summary,
      prevExpense: prev.periodExpense,
      expenses: decorate(categoryBreakdown(data.transactions, { type: 'expense', month })),
      incomes: decorate(categoryBreakdown(data.transactions, { type: 'income', month })),
      monthly: monthlyTotals(data.transactions, { months: 6, endMonth: month }),
      daily: dailyExpenses(data.transactions, month),
      hasAny: data.transactions.length > 0,
    };
  }, [data, categories, month]);

  if (!view) return null;
  const { summary } = view;
  const change = view.prevExpense > 0 ? (summary.periodExpense - view.prevExpense) / view.prevExpense : null;
  const top = view.expenses[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" subtitle="Where your money goes" />
      <div className="flex justify-center sm:justify-start">
        <MonthSwitcher month={month} onChange={setMonth} max={currentMonthKey()} />
      </div>

      {!view.hasAny ? (
        <EmptyState icon={BarChart3} title="No data yet" text="Add a few expenses and income entries to see charts here." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Income">
              <Money value={summary.periodIncome} className="text-income" />
            </Kpi>
            <Kpi
              label="Spent"
              hint={
                change !== null && (
                  <span className={cx('inline-flex items-center gap-1', change > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {change > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {Math.abs(Math.round(change * 100))}% vs {monthLabel(shiftMonth(month, -1), 'short').split(' ')[0]}
                  </span>
                )
              }
            >
              <Money value={summary.periodExpense} className="text-expense" />
            </Kpi>
            <Kpi label="Saved">
              <Money value={summary.periodNet} signed />
            </Kpi>
            <Kpi label="Savings rate" hint="Share of income not spent">
              <span className={cx(summary.savingsRate !== null && summary.savingsRate < 0 && 'text-rose-600')}>
                {summary.savingsRate === null ? '—' : `${Math.round(summary.savingsRate * 100)}%`}
              </span>
            </Kpi>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Spending by category">
              <div className="card p-4">
                {view.expenses.length === 0 ? (
                  <p className="text-sm text-slate-500">No spending in {monthLabel(month)}.</p>
                ) : (
                  <>
                    <div className="flex justify-center py-2">
                      <CategoryDonut rows={view.expenses} size={210}>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase">Spent</p>
                          <Money value={summary.periodExpense} className="text-base font-bold" />
                          <p className="mx-auto max-w-24 truncate text-[11px] text-slate-500">Top: {top?.name}</p>
                        </div>
                      </CategoryDonut>
                    </div>
                    <ul className="mt-3 space-y-3">
                      {view.expenses.map((r) => (
                        <li key={r.categoryId ?? 'none'} className="flex items-center gap-3">
                          <CategoryIcon category={r.category} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="truncate font-medium">{r.name}</span>
                              <Money value={r.total} className="font-semibold" />
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className="h-full rounded-full" style={{ width: `${Math.max(2, r.share * 100)}%`, backgroundColor: r.color }} />
                              </div>
                              <span className="w-9 text-right text-[11px] text-slate-500">{Math.round(r.share * 100)}%</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </Section>

            <div className="space-y-6">
              <Section title="Income vs expenses · 6 months">
                <div className="card p-3 pt-4 text-slate-700 dark:text-slate-300">
                  <MonthlyBars rows={view.monthly} />
                  <div className="mt-1 flex justify-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-income" /> Income
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-expense" /> Expenses
                    </span>
                  </div>
                </div>
              </Section>

              <Section title={`Daily spending · ${monthLabel(month, 'short')}`}>
                <div className="card p-3 pt-4 text-slate-700 dark:text-slate-300">
                  <DailyBars rows={view.daily} />
                </div>
              </Section>

              {view.incomes.length > 0 && (
                <Section title="Income sources">
                  <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                    {view.incomes.map((r) => (
                      <div key={r.categoryId ?? 'none'} className="flex items-center gap-3 px-4 py-3">
                        <CategoryIcon category={r.category} size="sm" />
                        <span className="flex-1 text-sm font-medium">{r.name}</span>
                        <Money value={r.total} className="font-semibold text-income" />
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
