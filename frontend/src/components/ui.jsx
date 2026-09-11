/** Small shared UI building blocks. */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatMoney, shiftMonth } from '@spendwise/shared';
import { useCurrency } from '../hooks/useSession.js';
import { avatarColor, cx, initials, monthLabel } from '../utils/format.js';

// ------------------------------------------------------------ money

export function Money({ value, signed = false, className, compact = false }) {
  const currency = useCurrency();
  const n = Number(value || 0);
  const text = formatMoney(Math.abs(n), currency, { compact });
  const sign = signed ? (n > 0 ? '+' : n < 0 ? '−' : '') : n < 0 ? '−' : '';
  return <span className={cx('num whitespace-nowrap', className)}>{sign + text}</span>;
}

// ------------------------------------------------------------ identity

export function CategoryIcon({ category, size = 'md' }) {
  const color = category?.color || '#94a3b8';
  const dims = size === 'lg' ? 'size-12 text-2xl' : size === 'sm' ? 'size-8 text-base' : 'size-10 text-xl';
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-2xl', dims)}
      style={{ backgroundColor: `${color}22` }}
      aria-hidden="true"
    >
      {category?.icon || '🏷️'}
    </span>
  );
}

export function Avatar({ name, size = 'md' }) {
  const dims = size === 'lg' ? 'size-14 text-lg' : size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm';
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-semibold text-white', dims)}
      style={{ backgroundColor: avatarColor(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// ------------------------------------------------------------ layout pieces

export function Section({ title, action, children, className }) {
  return (
    <section className={cx('min-w-0 space-y-3', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {Icon && (
        <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <Icon className="size-6" />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <span
      className={cx('inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Segmented({ options, value, onChange, className, size = 'md' }) {
  return (
    <div role="tablist" className={cx('grid gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-lg font-semibold transition',
              size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-2 py-2 text-sm',
              active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
              active && o.activeClass,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MonthSwitcher({ month, onChange, max }) {
  const next = shiftMonth(month, 1);
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn-ghost btn size-9 p-0" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        <ChevronLeft className="size-5" />
      </button>
      <span className="min-w-32 text-center text-sm font-semibold">{monthLabel(month)}</span>
      <button
        type="button"
        className="btn-ghost btn size-9 p-0"
        onClick={() => onChange(next)}
        disabled={max && next > max}
        aria-label="Next month"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}

const PILL_STYLES = {
  open: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  overdue: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  settled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  pending: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
};

export function Pill({ tone = 'pending', children }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', PILL_STYLES[tone])}>{children}</span>;
}

export function ProgressBar({ value, tone = 'brand' }) {
  const color = tone === 'lent' ? 'bg-lent' : tone === 'borrowed' ? 'bg-borrowed' : tone === 'expense' ? 'bg-expense' : 'bg-brand-500';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

// ------------------------------------------------------------ modal sheet

/**
 * Bottom sheet on phones, centred dialog on larger screens.
 * Closes on Escape and backdrop click; focus moves into the sheet.
 */
export function Sheet({ open, onClose, title, children, footer }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => panel.current?.querySelector('input, select, textarea, button:not([data-close])')?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet safe-bottom relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" data-close className="btn-ghost btn size-9 p-0" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmSheet({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={cx('btn', danger ? 'bg-rose-600 text-white hover:bg-rose-700' : 'btn-primary')}
          onClick={async () => {
            await onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
