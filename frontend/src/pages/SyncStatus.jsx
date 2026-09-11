import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { useSyncSummary } from '../components/SyncBadge.jsx';
import { Pill, Section } from '../components/ui.jsx';
import { useData, useSyncState } from '../hooks/useData.jsx';
import { useOutboxStats } from '../hooks/useFinance.js';
import { useOnline } from '../hooks/useOnline.js';
import { useSession } from '../hooks/useSession.js';
import { timeAgo } from '../utils/format.js';

const ENTITY_LABEL = { transactions: 'Entry', people: 'Person', loans: 'Loan', repayments: 'Repayment', categories: 'Category' };

function describe(op) {
  const d = op.data || {};
  const what = ENTITY_LABEL[op.entity] || op.entity;
  if (op.action === 'delete') return `Delete ${what.toLowerCase()}`;
  return `${what}: ${d.description || d.name || d.note || (d.amount ? (d.amount / 100).toLocaleString() : '') || '…'}`;
}

export default function SyncStatus() {
  const { engine } = useData();
  const state = useSyncState();
  const stats = useOutboxStats();
  const summary = useSyncSummary();
  const online = useOnline();
  const session = useSession();
  const [busy, setBusy] = useState(false);

  const ops = stats?.ops || [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Sync status" back="/settings" />

      <div className="card p-5">
        <div className="flex items-center gap-3">
          {online ? <CheckCircle2 className="size-8 text-emerald-500" /> : <CloudOff className="size-8 text-slate-400" />}
          <div className="flex-1">
            <p className="font-semibold">{summary.label}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {online ? 'Online' : 'Offline'} · last synced {timeAgo(state.lastSyncedAt)}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary btn"
            disabled={!online || busy || session?.expired}
            onClick={async () => {
              setBusy(true);
              await engine.retryAll().finally(() => setBusy(false));
            }}
          >
            <RefreshCw className={`size-4 ${busy || state.phase === 'syncing' ? 'animate-spin' : ''}`} /> Sync now
          </button>
        </div>
        {state.lastError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{state.lastError}</p>}
        {session?.expired && (
          <p className="mt-3 text-sm">
            Your session expired.{' '}
            <Link to="/login?reauth=1" className="font-semibold text-brand-700 underline dark:text-brand-300">
              Sign in again
            </Link>{' '}
            to resume syncing. Nothing on this device is lost.
          </p>
        )}
      </div>

      <Section title={`Waiting to sync (${ops.length})`}>
        {ops.length === 0 ? (
          <p className="card p-4 text-sm text-slate-500">Everything on this device has reached the server.</p>
        ) : (
          <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {ops.map((op) => (
              <div key={op.seq} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{describe(op)}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(op.createdAt).toLocaleString()}
                    {op.attempts > 0 && ` · ${op.attempts} attempt${op.attempts > 1 ? 's' : ''}`}
                  </p>
                  {op.error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{op.error}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Pill tone={op.status === 'failed' ? 'failed' : 'pending'}>
                    {op.status === 'failed' ? (op.permanent ? 'Failed' : 'Retrying') : op.status === 'syncing' ? 'Syncing' : 'Pending'}
                  </Pill>
                  {op.permanent && (
                    <button type="button" className="text-xs font-semibold text-rose-600 underline dark:text-rose-400" onClick={() => engine.discard(op.seq)}>
                      Discard change
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="How sync works">
        <div className="card space-y-2 p-4 text-sm text-slate-600 dark:text-slate-300">
          <p>Everything you add is saved on this device first, so SpendWise works without internet.</p>
          <p>When you're online, changes are sent to your account automatically and changes from your other devices are downloaded.</p>
          <p>
            A change marked <strong>Failed</strong> was rejected by the server (for example, a repayment for a loan deleted on another device). Discard it to restore
            the server's version.
          </p>
        </div>
      </Section>
    </div>
  );
}
