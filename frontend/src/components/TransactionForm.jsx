import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, StickyNote } from 'lucide-react';
import { LIMITS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, minorToInput, toMinor, todayISO } from '@spendwise/shared';
import { useCategories } from '../hooks/useFinance.js';
import { useData } from '../hooks/useData.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { useToast } from './Toast.jsx';
import { AmountInput, ChipGroup, DateField, TextField } from './fields.jsx';
import { cx } from '../utils/format.js';

const METHOD_ICONS = { cash: '💵', card: '💳', bank: '🏦', wallet: '📱', other: '🔁' };

/** Income / expense form, used for both adding and editing. */
export default function TransactionForm({ type, initial, onDone, submitLabel = 'Save' }) {
  const { save } = useData();
  const toast = useToast();
  const online = useOnline();
  const categories = useCategories();
  const formRef = useRef(null);

  const [amount, setAmount] = useState(initial ? minorToInput(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? null);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? '');
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? (type === 'expense' ? 'cash' : null));
  const [note, setNote] = useState(initial?.note ?? '');
  const [showNote, setShowNote] = useState(Boolean(initial?.note));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const options = (categories || []).filter((c) => c.type === type);

  // Switching between Expense and Income on the Add screen: drop a category of the other type.
  useEffect(() => {
    if (categoryId && categories && !categories.some((c) => c.id === categoryId && c.type === type)) setCategoryId(null);
  }, [type, categories, categoryId]);

  async function submit(another = false) {
    const minor = toMinor(amount);
    if (!minor) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (!date) return;
    setSaving(true);
    try {
      await save('transactions', {
        ...(initial || {}),
        type,
        amount: minor,
        categoryId,
        date,
        description: description.trim() || null,
        paymentMethod,
        note: note.trim() || null,
      });
      toast(online ? 'Saved' : 'Saved on this device — will sync when online', { tone: online ? 'success' : 'offline' });
      if (another) {
        setAmount('');
        setDescription('');
        setNote('');
        setError(null);
        formRef.current?.querySelector('input')?.focus();
      } else {
        onDone?.();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      ref={formRef}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <AmountInput
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setError(null);
        }}
        autoFocus={!initial}
        tone={type}
        error={error}
      />

      <div>
        <p className="field-label">Category</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              aria-pressed={categoryId === c.id}
              className={cx(
                'flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-center text-[11px] leading-tight font-medium transition',
                categoryId === c.id
                  ? 'border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'border-transparent bg-white text-slate-600 hover:border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700',
              )}
            >
              <span className="text-2xl" aria-hidden="true">
                {c.icon || '🏷️'}
              </span>
              <span className="line-clamp-2">{c.name}</span>
            </button>
          ))}
          <Link
            to="/settings/categories"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 px-1 py-2.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            <Plus className="size-5" />
            New
          </Link>
        </div>
      </div>

      <TextField
        label={type === 'income' ? 'Source / description' : 'Description'}
        value={description}
        onChange={setDescription}
        placeholder={type === 'income' ? 'e.g. September salary' : 'e.g. Lunch with team'}
        maxLength={LIMITS.description}
      />

      <DateField value={date} onChange={setDate} />

      {type === 'expense' && (
        <ChipGroup
          label="Paid with"
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m], icon: METHOD_ICONS[m] }))}
        />
      )}

      {showNote ? (
        <TextField label="Note" value={note} onChange={setNote} multiline maxLength={LIMITS.note} placeholder="Anything to remember?" />
      ) : (
        <button type="button" className="btn-ghost btn -ml-2 px-2" onClick={() => setShowNote(true)}>
          <StickyNote className="size-4" /> Add a note
        </button>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-2 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent px-4 pt-4 pb-4 sm:static sm:mx-0 sm:bg-none sm:px-0 dark:from-[#0b1120] dark:via-[#0b1120]">
        {!initial && (
          <button type="button" className="btn-secondary btn flex-1 py-3" disabled={saving} onClick={() => submit(true)}>
            Save & new
          </button>
        )}
        <button type="submit" className="btn-primary btn flex-1 py-3" disabled={saving}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
