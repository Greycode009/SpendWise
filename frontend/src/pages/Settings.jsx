import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Coins, Download, LogOut, Monitor, Moon, RefreshCw, Smartphone, Sun, Tags, UserRound } from 'lucide-react';
import { CURRENCIES } from '@spendwise/shared';
import PageHeader from '../components/PageHeader.jsx';
import { ConfirmSheet, Section, Segmented, Sheet } from '../components/ui.jsx';
import { useSyncSummary } from '../components/SyncBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { TextField } from '../components/fields.jsx';
import { useData } from '../hooks/useData.jsx';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { useSession } from '../hooks/useSession.js';
import { useTheme } from '../hooks/useTheme.js';
import { getMeta, setMeta } from '../db/db.js';
import { logout } from '../services/auth.js';
import { session as sessionStore } from '../services/session.js';

function Row({ icon: Icon, label, value, to, onClick, children }) {
  const Tag = to ? Link : onClick ? 'button' : 'div';
  return (
    <Tag to={to} onClick={onClick} type={onClick ? 'button' : undefined} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <Icon className="size-5 text-slate-500" />
      <span className="flex-1 font-medium">{label}</span>
      {children}
      {value && <span className="text-sm text-slate-500 dark:text-slate-400">{value}</span>}
      {(to || onClick) && <ChevronRight className="size-4 text-slate-300" />}
    </Tag>
  );
}

export default function Settings() {
  const user = useSession()?.user;
  const { db, engine } = useData();
  const [theme, setTheme] = useTheme();
  const { status: installStatus, install, isIOS } = useInstallPrompt();
  const sync = useSyncSummary();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [iosHelp, setIosHelp] = useState(false);

  /** Profile changes apply instantly and sync like everything else. */
  async function updateProfile(patch) {
    sessionStore.update({ user: patch });
    const pending = (await getMeta(db, 'profilePatch')) || {};
    await setMeta(db, 'profilePatch', { ...pending, ...patch });
    engine.request(0);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" />

      <Section title="Account">
        <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          <Row icon={UserRound} label="Name" value={user?.name} onClick={() => { setName(user?.name || ''); setEditName(true); }} />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="w-5" />
            <span className="flex-1 text-sm text-slate-500">Email</span>
            <span className="truncate text-sm">{user?.email}</span>
          </div>
          <label className="flex items-center gap-3 px-4 py-3.5">
            <Coins className="size-5 text-slate-500" />
            <span className="flex-1 font-medium">Currency</span>
            <select
              className="input w-auto py-1.5 text-sm"
              value={user?.currency || 'NPR'}
              onChange={(e) => updateProfile({ currency: e.target.value }).then(() => toast('Currency updated'))}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Appearance">
        <div className="card p-4">
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-4" />Auto</span> },
              { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun className="size-4" />Light</span> },
              { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon className="size-4" />Dark</span> },
            ]}
          />
        </div>
      </Section>

      <Section title="Data">
        <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          <Row icon={Tags} label="Categories" to="/settings/categories" />
          <Row icon={RefreshCw} label="Sync status" to="/sync" value={sync.label} />
        </div>
      </Section>

      <Section title="App">
        <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {installStatus === 'installed' ? (
            <Row icon={Smartphone} label="Installed as an app" value="✓" />
          ) : installStatus === 'available' ? (
            <Row icon={Download} label="Install SpendWise" onClick={() => install().then((ok) => ok && toast('Installed!'))} />
          ) : isIOS ? (
            <Row icon={Download} label="Add to Home Screen" onClick={() => setIosHelp(true)} />
          ) : (
            <Row icon={Smartphone} label="Install" value="Use your browser menu → Install app" />
          )}
          <Row icon={LogOut} label="Log out" onClick={() => setConfirmLogout(true)} />
        </div>
        <p className="px-1 text-center text-xs text-slate-400">SpendWise v1.0 · your data is stored on this device and synced to your account</p>
      </Section>

      <Sheet open={editName} onClose={() => setEditName(false)} title="Your name">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await updateProfile({ name: name.trim() });
            setEditName(false);
            toast('Name updated');
          }}
        >
          <TextField label="Name" value={name} onChange={setName} maxLength={60} />
          <button type="submit" className="btn-primary btn w-full py-3">
            Save
          </button>
        </form>
      </Sheet>

      <Sheet open={iosHelp} onClose={() => setIosHelp(false)} title="Install on iPhone / iPad">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Open SpendWise in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Choose “Add to Home Screen”.</li>
        </ol>
      </Sheet>

      <ConfirmSheet
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Log out?"
        confirmLabel="Log out"
        message={
          sync.pending + sync.failed > 0
            ? `You have ${sync.pending + sync.failed} change(s) that have not reached the server yet. Logging out deletes them from this device. Connect to the internet and let SpendWise sync first if you want to keep them.`
            : 'Your data is safely synced. It will be removed from this device and downloaded again when you log back in.'
        }
        onConfirm={async () => {
          engine.stop();
          await logout();
          navigate('/login', { replace: true });
        }}
      />
    </div>
  );
}
