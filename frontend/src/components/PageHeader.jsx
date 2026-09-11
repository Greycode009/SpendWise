import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SyncBadge from './SyncBadge.jsx';
import { cx } from '../utils/format.js';
import { goBack } from '../utils/nav.js';

/**
 * Page title row. On phones it also shows the sync badge (the desktop sidebar
 * shows it instead). `back` renders a back arrow.
 */
export default function PageHeader({ title, subtitle, back, actions, className }) {
  const navigate = useNavigate();
  return (
    <header className={cx('mb-5 flex items-center gap-3', className)}>
      {back && (
        <button
          type="button"
          onClick={() => goBack(navigate, typeof back === 'string' ? back : '/')}
          className="btn-ghost btn -ml-2 size-10 shrink-0 p-0"
          aria-label="Go back"
        >
          <ArrowLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-balance sm:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions}
      {/* Detail screens (with a back arrow) skip the badge to leave room for the title and actions. */}
      {!back && <SyncBadge className="shrink-0 lg:hidden" />}
    </header>
  );
}
