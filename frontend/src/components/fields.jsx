/** Form fields tuned for fast, thumb-friendly entry. */
import { useId } from 'react';
import { addDays, todayISO, formatMoney } from '@spendwise/shared';
import { useCurrency } from '../hooks/useSession.js';
import { cx } from '../utils/format.js';

/** Big amount input. Accepts "1,250.50"; parent converts with toMinor(). */
export function AmountInput({ value, onChange, autoFocus, tone = 'expense', error, label = 'Amount' }) {
  const currency = useCurrency();
  const id = useId();
  const symbol = formatMoney(0, currency).replace(/[\d.,\s]/g, '') || currency;
  const color = { expense: 'text-expense', income: 'text-income', lent: 'text-lent', borrowed: 'text-borrowed' }[tone];
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className={cx('flex items-baseline justify-center gap-2 rounded-3xl bg-slate-50 px-4 py-5 dark:bg-slate-950', error && 'ring-2 ring-rose-400')}>
        <span className={cx('text-2xl font-semibold', color)}>{symbol}</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          className={cx('num field-sizing-content min-w-[1ch] max-w-[11ch] bg-transparent text-5xl font-bold tracking-tight outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700', color)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-center text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** Date input with one-tap Today / Yesterday chips. */
export function DateField({ label = 'Date', value, onChange, allowEmpty = false, min }) {
  const id = useId();
  const today = todayISO();
  const yesterday = addDays(today, -1);
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {!allowEmpty && (
          <>
            <button type="button" className={cx('chip', value === today && 'chip-active')} onClick={() => onChange(today)}>
              Today
            </button>
            <button type="button" className={cx('chip', value === yesterday && 'chip-active')} onClick={() => onChange(yesterday)}>
              Yesterday
            </button>
          </>
        )}
        <input id={id} type="date" className="input w-auto flex-1 py-1.5" value={value || ''} min={min} onChange={(e) => onChange(e.target.value)} />
        {allowEmpty && value && (
          <button type="button" className="btn-ghost btn px-2 py-1.5 text-xs" onClick={() => onChange('')}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, maxLength, multiline = false, type = 'text', autoComplete, required, error }) {
  const id = useId();
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <Tag
        id={id}
        type={multiline ? undefined : type}
        rows={multiline ? 2 : undefined}
        className={cx('input', multiline && 'resize-none', error && 'border-rose-400')}
        value={value ?? ''}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

export function ChipGroup({ label, options, value, onChange, allowNone = true }) {
  return (
    <div>
      {label && <p className="field-label">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={cx('chip', value === o.value && 'chip-active')}
            onClick={() => onChange(allowNone && value === o.value ? null : o.value)}
            aria-pressed={value === o.value}
          >
            {o.icon && <span aria-hidden="true">{o.icon}</span>}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
