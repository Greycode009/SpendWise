import { cx } from '../utils/format.js';

/** SpendWise mark: a rising bar chart inside a rounded wallet shape. */
export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={cx('shrink-0', className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0f766e" />
      <rect x="14" y="34" width="8" height="16" rx="3" fill="#99f6e4" />
      <rect x="28" y="24" width="8" height="26" rx="3" fill="#5eead4" />
      <rect x="42" y="14" width="8" height="36" rx="3" fill="#ffffff" />
    </svg>
  );
}

export default function Logo({ className, textClass }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="size-9" />
      <span className={cx('text-xl font-extrabold tracking-tight', textClass)}>
        Spend<span className="text-brand-600 dark:text-brand-400">Wise</span>
      </span>
    </span>
  );
}
