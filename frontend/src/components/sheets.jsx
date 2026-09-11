/** Small modal forms: person, repayment, category. */
import { useEffect, useState } from 'react';
import { LIMITS, TRANSACTION_TYPES, formatMoney, minorToInput, toMinor, todayISO } from '@spendwise/shared';
import { useData } from '../hooks/useData.jsx';
import { useCurrency } from '../hooks/useSession.js';
import { useToast } from './Toast.jsx';
import { DateField, TextField } from './fields.jsx';
import { Segmented, Sheet } from './ui.jsx';
import { cx } from '../utils/format.js';

export function PersonSheet({ open, onClose, person, onSaved }) {
  const { save } = useData();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(person?.name ?? '');
      setPhone(person?.phone ?? '');
      setNote(person?.note ?? '');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person?.id]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    const saved = await save('people', { ...(person || {}), name: name.trim(), phone: phone.trim() || null, note: note.trim() || null });
    toast(person ? 'Person updated' : 'Person added');
    onSaved?.(saved);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={person ? 'Edit person' : 'Add person'}>
      <form className="space-y-4" onSubmit={submit}>
        <TextField label="Name" value={name} onChange={setName} maxLength={LIMITS.name} error={error} autoComplete="off" />
        <TextField label="Phone (optional)" type="tel" value={phone} onChange={setPhone} maxLength={LIMITS.phone} />
        <TextField label="Note (optional)" value={note} onChange={setNote} maxLength={LIMITS.note} />
        <button type="submit" className="btn-primary btn w-full py-3">
          {person ? 'Save changes' : 'Add person'}
        </button>
      </form>
    </Sheet>
  );
}

export function RepaymentSheet({ open, onClose, loan, repayment }) {
  const { save } = useData();
  const toast = useToast();
  const currency = useCurrency();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  // The most this repayment can be: what is outstanding (+ its own amount when editing).
  const max = loan ? loan.outstanding + (repayment?.amount || 0) : 0;

  useEffect(() => {
    if (open && loan) {
      setAmount(minorToInput(repayment ? repayment.amount : loan.outstanding));
      setDate(repayment?.date ?? todayISO());
      setNote(repayment?.note ?? '');
      setError(null);
    }
    // Only reset when the sheet opens (not when a background sync refreshes the loan).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan?.id, repayment?.id]);

  if (!loan) return null;
  const lent = loan.direction === 'lent';

  async function submit(e) {
    e.preventDefault();
    const minor = toMinor(amount);
    if (!minor) return setError('Enter an amount greater than zero');
    if (minor > max) return setError(`That's more than the ${formatMoney(max, currency)} outstanding`);
    await save('repayments', { ...(repayment || {}), loanId: loan.id, amount: minor, date, note: note.trim() || null });
    toast(minor === max ? 'Loan settled 🎉' : 'Repayment recorded');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={repayment ? 'Edit repayment' : lent ? 'Record money received' : 'Record money paid back'}>
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="field-label" htmlFor="repay-amount">
            Amount
          </label>
          <div className="flex gap-2">
            <input
              id="repay-amount"
              className={cx('input num text-lg font-semibold', error && 'border-rose-400')}
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d.,]/g, ''));
                setError(null);
              }}
            />
            <button type="button" className="btn-secondary btn shrink-0" onClick={() => setAmount(minorToInput(max))}>
              Full
            </button>
          </div>
          <p className={cx('mt-1 text-sm', error ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400')}>
            {error || `Outstanding: ${formatMoney(max, currency)}`}
          </p>
        </div>
        <DateField value={date} onChange={setDate} />
        <TextField label="Note (optional)" value={note} onChange={setNote} maxLength={LIMITS.note} />
        <button type="submit" className="btn-primary btn w-full py-3">
          Save repayment
        </button>
      </form>
    </Sheet>
  );
}

const COLORS = ['#f97316', '#eab308', '#84cc16', '#10b981', '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#ef4444', '#64748b'];
const EMOJIS = ['🍜', '☕', '🛒', '🚌', '⛽', '🏠', '💡', '📱', '💊', '📚', '🎬', '🎮', '👕', '✈️', '🎁', '🐶', '💼', '💻', '🏪', '💰', '📈', '🧾', '🔧', '💇'];

export function CategorySheet({ open, onClose, category }) {
  const { save } = useData();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [icon, setIcon] = useState('🏷️');
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setType(category?.type ?? 'expense');
      setIcon(category?.icon ?? '🏷️');
      setColor(category?.color ?? COLORS[0]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?.id]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    await save('categories', { ...(category || {}), name: name.trim(), type, icon: icon || null, color });
    toast(category ? 'Category updated' : 'Category added');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={category ? 'Edit category' : 'New category'}>
      <form className="space-y-4" onSubmit={submit}>
        {!category && (
          <Segmented
            value={type}
            onChange={setType}
            options={TRANSACTION_TYPES.map((t) => ({ value: t, label: t === 'income' ? 'Income' : 'Expense' }))}
          />
        )}
        <TextField label="Name" value={name} onChange={setName} maxLength={LIMITS.name} error={error} />
        <div>
          <p className="field-label">Icon</p>
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={cx('grid aspect-square place-items-center rounded-xl text-xl', icon === e ? 'bg-brand-100 ring-2 ring-brand-500 dark:bg-brand-500/20' : 'bg-slate-100 dark:bg-slate-800')}
                aria-label={`Icon ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="field-label">Colour</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cx('size-8 rounded-full transition', color === c && 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-900')}
                style={{ backgroundColor: c }}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary btn w-full py-3">
          {category ? 'Save changes' : 'Add category'}
        </button>
      </form>
    </Sheet>
  );
}
