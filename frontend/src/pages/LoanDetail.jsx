import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, HandCoins, Pencil, Trash2, Undo2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { LoanStatusPill, SyncMark } from '../components/rows.jsx';
import { RepaymentSheet } from '../components/sheets.jsx';
import { Avatar, ConfirmSheet, EmptyState, Money, ProgressBar, Section } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../hooks/useData.jsx';
import { useLoan } from '../hooks/useFinance.js';
import { cx, dayLabel, formatDate, relativeDays } from '../utils/format.js';

export default function LoanDetail() {
  const { id } = useParams();
  const loan = useLoan(id);
  const { remove } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const [repaying, setRepaying] = useState(false);
  const [editingRepayment, setEditingRepayment] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'loan' | repayment object

  if (loan === undefined) return null;
  if (!loan) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title="Not found" back="/people" />
        <EmptyState icon={HandCoins} title="This loan no longer exists" text="It may have been deleted on another device." />
      </div>
    );
  }

  const lent = loan.direction === 'lent';
  const name = loan.person?.name || 'Unknown';

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader
        title={lent ? 'Money lent' : 'Money borrowed'}
        back={loan.person ? `/people/${loan.person.id}` : '/people'}
        actions={
          <div className="flex gap-1">
            <Link to={`/loans/${loan.id}/edit`} className="btn-ghost btn size-10 p-0" aria-label="Edit loan">
              <Pencil className="size-5" />
            </Link>
            <button type="button" className="btn-danger btn size-10 p-0" onClick={() => setConfirm('loan')} aria-label="Delete loan">
              <Trash2 className="size-5" />
            </button>
          </div>
        }
      />

      <div className="card p-5">
        <Link to={loan.person ? `/people/${loan.person.id}` : '/people'} className="flex items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lent ? 'You lent' : 'You borrowed'} on {formatDate(loan.date)}
            </p>
          </div>
          <LoanStatusPill status={loan.status} />
        </Link>

        <div className="mt-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">{loan.outstanding ? (lent ? 'Still to receive' : 'Still to pay') : 'Fully repaid'}</p>
          <Money value={loan.outstanding} className={cx('text-4xl font-bold', lent ? 'text-lent' : 'text-borrowed', !loan.outstanding && 'text-slate-400')} />
          <div className="mt-3 space-y-1.5">
            <ProgressBar value={loan.progress} tone={lent ? 'lent' : 'borrowed'} />
            <p className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Repaid <Money value={loan.repaid} />
              </span>
              <span>
                of <Money value={loan.amount} />
              </span>
            </p>
          </div>
        </div>

        {(loan.dueDate || loan.note) && (
          <dl className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
            {loan.dueDate && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Due</dt>
                <dd className={cx(loan.status === 'overdue' && 'font-semibold text-rose-600 dark:text-rose-400')}>
                  {formatDate(loan.dueDate)} {loan.outstanding > 0 && `(${relativeDays(loan.dueDate)})`}
                </dd>
              </div>
            )}
            {loan.note && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Note</dt>
                <dd className="text-right">{loan.note}</dd>
              </div>
            )}
          </dl>
        )}

        {loan.outstanding > 0 && (
          <button type="button" className="btn-primary btn mt-5 w-full py-3" onClick={() => setRepaying(true)}>
            {lent ? <HandCoins className="size-5" /> : <Undo2 className="size-5" />}
            {lent ? 'Record money received' : 'Record repayment'}
          </button>
        )}
        {loan.outstanding === 0 && (
          <p className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="size-5" /> Settled
          </p>
        )}
      </div>

      <Section title="Repayments">
        {loan.repayments.length ? (
          <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {loan.repayments.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditingRepayment(r)}>
                  <p className="flex items-center gap-1.5 font-medium">
                    {dayLabel(r.date)} <SyncMark status={r._status} />
                  </p>
                  {r.note && <p className="truncate text-xs text-slate-500">{r.note}</p>}
                </button>
                <Money value={r.amount} className="font-semibold text-income" />
                <button type="button" className="btn-ghost btn size-8 p-0 text-slate-400" onClick={() => setConfirm(r)} aria-label="Delete repayment">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="card p-4 text-sm text-slate-500">No repayments yet.</p>
        )}
      </Section>

      <RepaymentSheet open={repaying} onClose={() => setRepaying(false)} loan={loan} />
      <RepaymentSheet open={Boolean(editingRepayment)} onClose={() => setEditingRepayment(null)} loan={loan} repayment={editingRepayment} />
      <ConfirmSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm === 'loan' ? 'Delete this loan?' : 'Delete this repayment?'}
        message={confirm === 'loan' ? 'The loan and all its repayments will be deleted. This cannot be undone.' : 'The outstanding amount will go back up.'}
        onConfirm={async () => {
          if (confirm === 'loan') {
            await remove('loans', loan.id);
            toast('Loan deleted');
            navigate(loan.person ? `/people/${loan.person.id}` : '/people', { replace: true });
          } else {
            await remove('repayments', confirm.id);
            toast('Repayment deleted');
          }
        }}
      />
    </div>
  );
}
