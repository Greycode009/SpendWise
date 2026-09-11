import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, UserPlus, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { PersonSheet } from '../components/sheets.jsx';
import { Avatar, EmptyState, Money, Segmented } from '../components/ui.jsx';
import { usePeople, usePersonBalances } from '../hooks/useFinance.js';
import { cx } from '../utils/format.js';

export default function People() {
  const people = usePeople();
  const balances = usePersonBalances();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('active');

  const rows = useMemo(() => {
    if (!people || !balances) return [];
    return people
      .map((p) => ({ ...p, balance: balances.get(p.id) }))
      .filter((p) => filter === 'all' || p.balance?.activeLoans > 0)
      .sort((a, b) => Math.abs(b.balance?.net || 0) - Math.abs(a.balance?.net || 0) || a.name.localeCompare(b.name));
  }, [people, balances, filter]);

  const totals = useMemo(() => {
    let owedToMe = 0;
    let iOwe = 0;
    for (const b of balances?.values() || []) {
      owedToMe += b.owedToMe;
      iOwe += b.iOwe;
    }
    return { owedToMe, iOwe };
  }, [balances]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="People"
        subtitle="Money lent and borrowed"
        actions={
          <button type="button" className="btn-secondary btn size-10 p-0" onClick={() => setAdding(true)} aria-label="Add person">
            <UserPlus className="size-5" />
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Others owe you</p>
          <Money value={totals.owedToMe} className="mt-1 block text-xl font-bold text-lent" />
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">You owe others</p>
          <Money value={totals.iOwe} className="mt-1 block text-xl font-bold text-borrowed" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/add?type=lent" className="btn-secondary btn py-3">
          <span className="text-lent">↗</span> I lent money
        </Link>
        <Link to="/add?type=borrowed" className="btn-secondary btn py-3">
          <span className="text-borrowed">↙</span> I borrowed
        </Link>
      </div>

      <Segmented
        size="sm"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: 'With open balance' },
          { value: 'all', label: 'Everyone' },
        ]}
      />

      {people && rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filter === 'active' && people.length ? 'All settled up' : 'No people yet'}
          text={filter === 'active' && people.length ? 'Nobody owes you and you owe nobody. Nice!' : 'Add friends or family to keep track of money you lend or borrow.'}
          action={
            <button type="button" className="btn-primary btn" onClick={() => setAdding(true)}>
              <UserPlus className="size-4" /> Add person
            </button>
          }
        />
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {rows.map((p) => {
            const net = p.balance?.net || 0;
            return (
              <Link key={p.id} to={`/people/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {p.balance?.activeLoans ? `${p.balance.activeLoans} open ${p.balance.activeLoans === 1 ? 'loan' : 'loans'}` : 'Settled up'}
                  </p>
                </div>
                <div className="text-right">
                  {net !== 0 ? (
                    <>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{net > 0 ? 'owes you' : 'you owe'}</p>
                      <Money value={Math.abs(net)} className={cx('font-semibold', net > 0 ? 'text-lent' : 'text-borrowed')} />
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
                <ChevronRight className="size-4 text-slate-300" />
              </Link>
            );
          })}
        </div>
      )}

      <PersonSheet open={adding} onClose={() => setAdding(false)} onSaved={(p) => navigate(`/people/${p.id}`)} />
    </div>
  );
}
