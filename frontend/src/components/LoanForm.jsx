import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { LIMITS, minorToInput, toMinor, todayISO } from '@spendwise/shared';
import { usePeople } from '../hooks/useFinance.js';
import { useData } from '../hooks/useData.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { useToast } from './Toast.jsx';
import { AmountInput, DateField, TextField } from './fields.jsx';
import { Avatar } from './ui.jsx';
import { cx } from '../utils/format.js';

/**
 * Money lent / borrowed. Lets the user pick an existing person or type a new
 * name — the person is created locally in the same step (works offline).
 */
export default function LoanForm({ direction, initial, presetPersonId, minAmount = 0, onDone, submitLabel = 'Save' }) {
  const { save } = useData();
  const toast = useToast();
  const online = useOnline();
  const people = usePeople();

  const [amount, setAmount] = useState(initial ? minorToInput(initial.amount) : '');
  const [personId, setPersonId] = useState(initial?.personId ?? presetPersonId ?? null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const showNewInput = adding || (people && people.length === 0);
  const lent = direction === 'lent';

  const sortedPeople = useMemo(() => people || [], [people]);

  async function submit(e) {
    e.preventDefault();
    const minor = toMinor(amount);
    const next = {};
    if (!minor) next.amount = 'Enter an amount greater than zero';
    else if (minor < minAmount) next.amount = 'Amount cannot be less than what was already repaid';
    if (!personId && !newName.trim()) next.person = 'Choose a person or add a new one';
    if (dueDate && dueDate < date) next.dueDate = 'Due date cannot be before the loan date';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      let pid = personId;
      if (showNewInput && newName.trim()) {
        const person = await save('people', { name: newName.trim() });
        pid = person.id;
      }
      await save('loans', {
        ...(initial || {}),
        personId: pid,
        direction,
        amount: minor,
        date,
        dueDate: dueDate || null,
        note: note.trim() || null,
      });
      toast(online ? 'Saved' : 'Saved on this device — will sync when online', { tone: online ? 'success' : 'offline' });
      onDone?.(pid);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <AmountInput
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setErrors((x) => ({ ...x, amount: null }));
        }}
        autoFocus={!initial}
        tone={direction}
        error={errors.amount}
        label={lent ? 'Amount lent' : 'Amount borrowed'}
      />

      <div>
        <p className="field-label">{lent ? 'Lent to' : 'Borrowed from'}</p>
        {sortedPeople.length > 0 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {sortedPeople.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPersonId(p.id);
                  setAdding(false);
                  setErrors((x) => ({ ...x, person: null }));
                }}
                aria-pressed={personId === p.id && !showNewInput}
                className={cx(
                  'flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-xs font-medium transition',
                  personId === p.id && !showNewInput
                    ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
                    : 'border-transparent bg-white dark:bg-slate-900',
                )}
              >
                <Avatar name={p.name} />
                <span className="w-full truncate text-center">{p.name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setPersonId(null);
              }}
              className={cx(
                'flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-dashed px-1 py-2.5 text-xs font-medium',
                showNewInput ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-500 dark:border-slate-700',
              )}
            >
              <span className="grid size-10 place-items-center">
                <UserPlus className="size-5" />
              </span>
              New
            </button>
          </div>
        )}
        {showNewInput && (
          <input
            className="input mt-2"
            placeholder="Person's name"
            value={newName}
            maxLength={LIMITS.name}
            onChange={(e) => {
              setNewName(e.target.value);
              setErrors((x) => ({ ...x, person: null }));
            }}
            aria-label="New person's name"
          />
        )}
        {errors.person && <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{errors.person}</p>}
      </div>

      <DateField label={lent ? 'Date lent' : 'Date borrowed'} value={date} onChange={setDate} />
      <div>
        <DateField label="Due date (optional)" value={dueDate} onChange={setDueDate} allowEmpty min={date} />
        {errors.dueDate && <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{errors.dueDate}</p>}
      </div>
      <TextField label="Note" value={note} onChange={setNote} placeholder={lent ? 'e.g. for bike repair' : 'e.g. trip expenses'} maxLength={LIMITS.note} />

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent px-4 pt-4 pb-4 sm:static sm:mx-0 sm:bg-none sm:px-0 dark:from-[#0b1120] dark:via-[#0b1120]">
        <button type="submit" className="btn-primary btn w-full py-3" disabled={saving}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
