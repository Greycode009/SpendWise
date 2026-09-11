import { Link } from 'react-router-dom';
import { AlertTriangle, Cloud, CloudOff, CloudUpload, LogIn, RefreshCw } from 'lucide-react';
import { useOutboxStats } from '../hooks/useFinance.js';
import { useSyncState } from '../hooks/useData.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { useSession } from '../hooks/useSession.js';
import { cx } from '../utils/format.js';

/** Derive a single display state from connectivity, engine phase and the outbox. */
export function useSyncSummary() {
  const online = useOnline();
  const state = useSyncState();
  const stats = useOutboxStats();
  const session = useSession();
  const pending = stats?.pending ?? 0;
  const failed = stats?.failed ?? 0;

  if (session?.expired) return { key: 'paused', label: 'Sign in to sync', icon: LogIn, tone: 'warn', pending, failed };
  if (!online || state.phase === 'offline')
    return { key: 'offline', label: pending ? `Offline · ${pending} to sync` : 'Offline', icon: CloudOff, tone: 'muted', pending, failed };
  if (failed) return { key: 'failed', label: `${failed} failed`, icon: AlertTriangle, tone: 'danger', pending, failed };
  if (state.phase === 'syncing') return { key: 'syncing', label: 'Syncing…', icon: RefreshCw, tone: 'brand', spin: true, pending, failed };
  if (state.phase === 'error') return { key: 'error', label: 'Sync error', icon: AlertTriangle, tone: 'danger', pending, failed };
  if (pending) return { key: 'pending', label: `${pending} pending`, icon: CloudUpload, tone: 'warn', pending, failed };
  return { key: 'synced', label: 'Synced', icon: Cloud, tone: 'ok', pending, failed };
}

const TONES = {
  muted: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
};

export default function SyncBadge({ className }) {
  const s = useSyncSummary();
  const Icon = s.icon;
  return (
    <Link
      to="/sync"
      className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', TONES[s.tone], className)}
      aria-label={`Sync status: ${s.label}`}
      data-sync-state={s.key}
    >
      <Icon className={cx('size-3.5', s.spin && 'animate-spin')} />
      {s.label}
    </Link>
  );
}
