import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, CloudUpload, AlertTriangle } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from '@spendwise/shared';
import { Avatar, CategoryIcon, Money, Pill, ProgressBar } from './ui.jsx';
import { cx, dayLabel, formatDate, relativeDays } from '../utils/format.js';

export function SyncMark({ status }) {
  if (status === 'pending') return <CloudUpload className="size-3.5 text-amber-500" aria-label="Waiting to sync" />;
  if (status === 'failed') return <AlertTriangle className="size-3.5 text-rose-500" aria-label="Sync failed" />;
  return null;
}

export function TransactionRow({ tx, category, showDate = false }) {
  const isIncome = tx.type === 'income';
  const title = tx.description || category?.name || (isIncome ? 'Income' : 'Expense');
  const meta = [category && tx.description ? category.name : null, tx.paymentMethod ? PAYMENT_METHOD_LABELS[tx.paymentMethod] : null, showDate ? dayLabel(tx.date) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Link
      to={`/transactions/${tx.id}`}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/50"
    >
      <CategoryIcon category={category} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-medium">
          <span className="truncate">{title}</span>
          <SyncMark status={tx._status} />
        </p>
        {meta && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{meta}</p>}
      </div>
      <Money value={isIncome ? tx.amount : -tx.amount} signed className={cx('font-semibold', isIncome ? 'text-income' : 'text-slate-900 dark:text-slate-100')} />
    </Link>
  );
}

const STATUS_LABEL = { open: 'Open', partial: 'Partly repaid', overdue: 'Overdue', settled: 'Settled' };

export function LoanStatusPill({ status }) {
  return <Pill tone={status}>{STATUS_LABEL[status]}</Pill>;
}

export function LoanRow({ loan, person, showPerson = true }) {
  const lent = loan.direction === 'lent';
  const Icon = lent ? ArrowUpRight : ArrowDownLeft;
  return (
    <Link to={`/loans/${loan.id}`} className="block px-4 py-3 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/50">
      <div className="flex items-center gap-3">
        {showPerson && person ? (
          <Avatar name={person.name} />
        ) : (
          <span className={cx('grid size-10 shrink-0 place-items-center rounded-2xl', lent ? 'bg-amber-100 text-lent dark:bg-amber-500/15' : 'bg-violet-100 text-borrowed dark:bg-violet-500/15')}>
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-medium">
            <span className="truncate">
              {showPerson && person ? person.name : lent ? 'You lent' : 'You borrowed'}
              {showPerson && person && <span className="font-normal text-slate-500 dark:text-slate-400"> · {lent ? 'lent' : 'borrowed'}</span>}
            </span>
            <SyncMark status={loan._status} />
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {formatDate(loan.date)}
            {loan.dueDate && loan.outstanding > 0 && ` · due ${relativeDays(loan.dueDate)}`}
            {loan.note && ` · ${loan.note}`}
          </p>
        </div>
        <div className="text-right">
          <Money value={loan.outstanding} className={cx('font-semibold', loan.outstanding === 0 ? 'text-slate-400 line-through decoration-1' : lent ? 'text-lent' : 'text-borrowed')} />
          <div className="mt-0.5">
            <LoanStatusPill status={loan.status} />
          </div>
        </div>
      </div>
      {loan.repaid > 0 && loan.outstanding > 0 && (
        <div className="mt-2.5 flex items-center gap-2 pl-[52px] text-[11px] text-slate-500 dark:text-slate-400">
          <ProgressBar value={loan.progress} tone={lent ? 'lent' : 'borrowed'} />
          <span className="num whitespace-nowrap">
            <Money value={loan.repaid} /> of <Money value={loan.amount} />
          </span>
        </div>
      )}
    </Link>
  );
}

/** Group a date-sorted list under day headers with the day's net total. */
export function groupByDay(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}
