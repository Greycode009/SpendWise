import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Minus, Plus, Settings, Wallet, CalendarClock } from 'lucide-react';
import { addDays, categoryBreakdown, computeSummary, currentMonthKey, enrichLoans, todayISO } from '@spendwise/shared';
import PageHeader from '../components/PageHeader.jsx';
import Donut from '../components/Donut.jsx';
import { LoanRow, TransactionRow } from '../components/rows.jsx';
import { EmptyState, Money, Section } from '../components/ui.jsx';
import { useCategoryMap, useFinancials } from '../hooks/useFinance.js';
import { useSession } from '../hooks/useSession.js';
import { cx, monthLabel } from '../utils/format.js';

const QUICK = [
  { type: 'expense', label: 'Expense', icon: Minus, cls: 'text-expense bg-rose-50 dark:bg-rose-500/10' },
  { type: 'income', label: 'Income', icon: Plus, cls: 'text-income bg-emerald-50 dark:bg-emerald-500/10' },
  { type: 'lent', label: 'Lent', icon: ArrowUpRight, cls: 'text-lent bg-amber-50 dark:bg-amber-500/10' },
  { type: 'borrowed', label: 'Borrowed', icon: ArrowDownLeft, cls: 'text-borrowed bg-violet-50 dark:bg-violet-500/10' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const user = useSession()?.user;
  const data = useFinancials();
  const categories = useCategoryMap();
  const month = currentMonthKey();

  const view = useMemo(() => {
    if (!data) return null;
    const summary = computeSummary({ ...data, month });
    const breakdown = categoryBreakdown(data.transactions, { month }).map((r) => ({
      ...r,
      name: categories.get(r.categoryId)?.name ?? 'Uncategorized',
      color: categories.get(r.categoryId)?.color ?? '#94a3b8',
      category: categories.get(r.categoryId),
    }));
    const recent = [...data.transactions]
      .sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')))
      .slice(0, 6);
    const today = todayISO();
    const soon = addDays(today, 7);
    const dueSoon = enrichLoans(data.loans, data.repayments)
      .filter((l) => l.outstanding > 0 && l.dueDate && l.dueDate <= soon)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
    const people = new Map(data.people.map((p) => [p.id, p]));
    return { summary, breakdown, recent, dueSoon, people, empty: !data.transactions.length && !data.loans.length };
  }, [data, categories, month]);

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <Link to="/settings" className="btn-ghost btn size-10 p-0 lg:hidden" aria-label="Settings">
            <Settings className="size-5" />
          </Link>
        }
      />

      {!view ? (
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Balance */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-(--shadow-float) lg:col-span-2">
              <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10 blur-2xl" />
              <p className="flex items-center gap-2 text-sm font-medium text-brand-100">
                <Wallet className="size-4" /> Balance
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight" data-testid="balance">
                <Money value={view.summary.balance} />
              </p>
              <p className="mt-1 text-xs text-brand-100/90">
                Net worth incl. money owed: <Money value={view.summary.netWorth} className="font-semibold text-white" />
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <p className="text-[11px] font-medium tracking-wide text-brand-100 uppercase">Income · {monthLabel(month, 'short')}</p>
                  <p className="mt-0.5 text-lg font-semibold">
                    <Money value={view.summary.periodIncome} />
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <p className="text-[11px] font-medium tracking-wide text-brand-100 uppercase">Spent · {monthLabel(month, 'short')}</p>
                  <p className="mt-0.5 text-lg font-semibold">
                    <Money value={view.summary.periodExpense} />
                  </p>
                </div>
              </div>
            </div>

            {/* Loans */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <Link to="/people" className="card flex flex-col justify-between p-4 transition hover:ring-1 hover:ring-amber-300">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <ArrowUpRight className="size-4 text-lent" /> Owed to you
                </p>
                <p className="mt-2 text-xl font-bold text-lent">
                  <Money value={view.summary.owedToMe} />
                </p>
              </Link>
              <Link to="/people" className="card flex flex-col justify-between p-4 transition hover:ring-1 hover:ring-violet-300">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <ArrowDownLeft className="size-4 text-borrowed" /> You owe
                </p>
                <p className="mt-2 text-xl font-bold text-borrowed">
                  <Money value={view.summary.iOwe} />
                </p>
              </Link>
            </div>
          </div>

          {/* Quick add */}
          <div className="grid grid-cols-4 gap-2">
            {QUICK.map(({ type, label, icon: Icon, cls }) => (
              <Link key={type} to={`/add?type=${type}`} className="card flex flex-col items-center gap-1.5 py-3 text-xs font-semibold transition active:scale-95">
                <span className={cx('grid size-10 place-items-center rounded-2xl', cls)}>
                  <Icon className="size-5" strokeWidth={2.5} />
                </span>
                {label}
              </Link>
            ))}
          </div>

          {view.empty ? (
            <EmptyState
              icon={Wallet}
              title="Let's add your first entry"
              text="Track what you spend and earn, and money you lend or borrow. It works even without internet."
              action={
                <Link to="/add" className="btn-primary btn">
                  <Plus className="size-4" /> Add entry
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Section
                title={`Spending in ${monthLabel(month, 'long').split(' ')[0]}`}
                action={
                  <Link to="/analytics" className="flex items-center text-xs font-semibold text-brand-700 dark:text-brand-300">
                    Insights <ChevronRight className="size-4" />
                  </Link>
                }
              >
                <div className="card flex items-center gap-5 p-4">
                  <Donut rows={view.breakdown} size={128}>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Spent</p>
                      <p className="text-sm font-bold">
                        <Money value={view.summary.periodExpense} compact />
                      </p>
                    </div>
                  </Donut>
                  <ul className="min-w-0 flex-1 space-y-2.5">
                    {view.breakdown.length === 0 && <li className="text-sm text-slate-500">No spending yet this month.</li>}
                    {view.breakdown.slice(0, 4).map((r) => (
                      <li key={r.categoryId ?? 'none'} className="flex items-center gap-2 text-sm">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                        <span className="text-xs text-slate-500">{Math.round(r.share * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              <Section
                title="Recent activity"
                action={
                  <Link to="/transactions" className="flex items-center text-xs font-semibold text-brand-700 dark:text-brand-300">
                    See all <ChevronRight className="size-4" />
                  </Link>
                }
              >
                <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                  {view.recent.length === 0 && <p className="p-4 text-sm text-slate-500">No income or expenses yet.</p>}
                  {view.recent.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} category={categories.get(tx.categoryId)} showDate />
                  ))}
                </div>
              </Section>

              {view.dueSoon.length > 0 && (
                <Section title="Due soon" className="lg:col-span-2">
                  <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                    {view.dueSoon.map((loan) => (
                      <LoanRow key={loan.id} loan={loan} person={view.people.get(loan.personId)} />
                    ))}
                  </div>
                  <p className="flex items-center gap-1.5 px-1 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarClock className="size-3.5" /> Loans that are overdue or due within 7 days.
                  </p>
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
