import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Pencil, Phone, Trash2, UserX } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { LoanRow } from '../components/rows.jsx';
import { PersonSheet } from '../components/sheets.jsx';
import { Avatar, ConfirmSheet, EmptyState, Money, Section } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../hooks/useData.jsx';
import { useLoans, usePerson } from '../hooks/useFinance.js';
import { cx } from '../utils/format.js';

export default function PersonDetail() {
  const { id } = useParams();
  const person = usePerson(id);
  const loans = useLoans();
  const { remove } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const { open, settled, owedToMe, iOwe } = useMemo(() => {
    const mine = (loans || []).filter((l) => l.personId === id);
    return {
      open: mine.filter((l) => l.outstanding > 0),
      settled: mine.filter((l) => l.outstanding === 0),
      owedToMe: mine.filter((l) => l.direction === 'lent').reduce((s, l) => s + l.outstanding, 0),
      iOwe: mine.filter((l) => l.direction === 'borrowed').reduce((s, l) => s + l.outstanding, 0),
    };
  }, [loans, id]);

  if (person === undefined) return null;
  if (!person) {
    return (
      <div>
        <PageHeader title="Not found" back="/people" />
        <EmptyState icon={UserX} title="This person no longer exists" text="They may have been deleted on another device." />
      </div>
    );
  }

  const net = owedToMe - iOwe;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={person.name}
        back="/people"
        actions={
          <div className="flex gap-1">
            <button type="button" className="btn-ghost btn size-10 p-0" onClick={() => setEditing(true)} aria-label="Edit person">
              <Pencil className="size-5" />
            </button>
            <button type="button" className="btn-danger btn size-10 p-0" onClick={() => setConfirm(true)} aria-label="Delete person">
              <Trash2 className="size-5" />
            </button>
          </div>
        }
      />

      <div className="card flex items-center gap-4 p-5">
        <Avatar name={person.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">{net > 0 ? `${person.name.split(' ')[0]} owes you` : net < 0 ? `You owe ${person.name.split(' ')[0]}` : 'All settled'}</p>
          <Money value={Math.abs(net)} className={cx('text-3xl font-bold', net > 0 ? 'text-lent' : net < 0 ? 'text-borrowed' : 'text-slate-400')} />
          {person.phone && (
            <a href={`tel:${person.phone}`} className="mt-1 flex items-center gap-1.5 text-sm text-brand-700 dark:text-brand-300">
              <Phone className="size-3.5" /> {person.phone}
            </a>
          )}
          {person.note && <p className="mt-1 text-sm text-slate-500">{person.note}</p>}
        </div>
      </div>

      {owedToMe > 0 && iOwe > 0 && (
        <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
          They owe you <Money value={owedToMe} /> and you owe them <Money value={iOwe} />.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/add?type=lent&person=${person.id}`} className="btn-secondary btn py-3">
          <ArrowUpRight className="size-4 text-lent" /> Lend
        </Link>
        <Link to={`/add?type=borrowed&person=${person.id}`} className="btn-secondary btn py-3">
          <ArrowDownLeft className="size-4 text-borrowed" /> Borrow
        </Link>
      </div>

      <Section title="Open">
        {open.length ? (
          <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {open.map((l) => (
              <LoanRow key={l.id} loan={l} showPerson={false} />
            ))}
          </div>
        ) : (
          <p className="card p-4 text-sm text-slate-500">No open loans with {person.name.split(' ')[0]}.</p>
        )}
      </Section>

      {settled.length > 0 && (
        <Section title="Settled">
          <div className="card divide-y divide-slate-100 overflow-hidden opacity-80 dark:divide-slate-800">
            {settled.map((l) => (
              <LoanRow key={l.id} loan={l} showPerson={false} />
            ))}
          </div>
        </Section>
      )}

      <PersonSheet open={editing} onClose={() => setEditing(false)} person={person} />
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${person.name}?`}
        message={
          open.length + settled.length
            ? `This also deletes ${open.length + settled.length} loan record(s) and their repayments with ${person.name}. This cannot be undone.`
            : 'This cannot be undone.'
        }
        onConfirm={async () => {
          await remove('people', person.id);
          toast('Person deleted');
          navigate('/people', { replace: true });
        }}
      />
    </div>
  );
}
