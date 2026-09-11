import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus, Search, X } from 'lucide-react';
import { currentMonthKey, monthKey, sumMinor } from '@spendwise/shared';
import PageHeader from '../components/PageHeader.jsx';
import { TransactionRow, groupByDay } from '../components/rows.jsx';
import { EmptyState, Money, MonthSwitcher, Segmented } from '../components/ui.jsx';
import { useCategoryMap, useTransactions } from '../hooks/useFinance.js';
import { dayLabel } from '../utils/format.js';

export default function Transactions() {
  const transactions = useTransactions();
  const categories = useCategoryMap();
  const [month, setMonth] = useState(currentMonthKey());
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');

  const { groups, income, expense, searching } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (transactions || []).filter((t) => {
      if (type !== 'all' && t.type !== type) return false;
      if (q) {
        const cat = categories.get(t.categoryId)?.name || '';
        return [t.description, t.note, cat].some((s) => s && s.toLowerCase().includes(q));
      }
      return monthKey(t.date) === month;
    });
    return {
      groups: groupByDay(list),
      income: sumMinor(list.filter((t) => t.type === 'income').map((t) => t.amount)),
      expense: sumMinor(list.filter((t) => t.type === 'expense').map((t) => t.amount)),
      searching: Boolean(q),
    };
  }, [transactions, categories, month, type, query]);

  return (
    <div className="space-y-4">
      <PageHeader title="Activity" subtitle="Income and expenses" />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          className="input pl-10"
          placeholder="Search description, note or category"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search transactions"
        />
        {query && (
          <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-slate-400" onClick={() => setQuery('')} aria-label="Clear search">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          size="sm"
          className="w-full sm:w-72"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Expenses' },
            { value: 'income', label: 'Income' },
          ]}
        />
        {!searching && <MonthSwitcher month={month} onChange={setMonth} max={currentMonthKey()} />}
      </div>

      <div className="card grid grid-cols-3 divide-x divide-slate-100 py-3 text-center dark:divide-slate-800">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase">In</p>
          <Money value={income} className="text-sm font-bold text-income" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Out</p>
          <Money value={expense} className="text-sm font-bold text-expense" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Net</p>
          <Money value={income - expense} signed className="text-sm font-bold" />
        </div>
      </div>

      {transactions && groups.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={searching ? 'No matches' : 'Nothing here yet'}
          text={searching ? 'Try a different word.' : 'Entries you add for this month will show up here.'}
          action={
            !searching && (
              <Link to="/add" className="btn-primary btn">
                <Plus className="size-4" /> Add entry
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const net = sumMinor(g.items.map((t) => (t.type === 'income' ? t.amount : -t.amount)));
            return (
              <section key={g.date}>
                <div className="mb-1.5 flex items-center justify-between px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>{dayLabel(g.date)}</span>
                  <Money value={net} signed />
                </div>
                <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
                  {g.items.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} category={categories.get(tx.categoryId)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
