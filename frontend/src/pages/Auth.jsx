import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CloudOff, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { CURRENCIES } from '@spendwise/shared';
import Logo from '../components/Logo.jsx';
import { TextField } from '../components/fields.jsx';
import { Spinner } from '../components/ui.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { useSession } from '../hooks/useSession.js';
import { errorMessage } from '../services/api.js';
import { login, register } from '../services/auth.js';

function AuthShell({ title, subtitle, children, footer }) {
  const online = useOnline();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-brand-400/20 blur-3xl" />
        <Logo textClass="text-white [&>span]:text-brand-200" />
        <div className="my-auto max-w-md space-y-6">
          <h2 className="text-4xl leading-tight font-bold">Know where your money goes — even offline.</h2>
          <ul className="space-y-4 text-brand-100">
            <li className="flex gap-3"><CloudOff className="size-5 shrink-0" /> Works without internet and syncs when you're back online.</li>
            <li className="flex gap-3"><Users className="size-5 shrink-0" /> Track who owes you and whom you owe.</li>
            <li className="flex gap-3"><Smartphone className="size-5 shrink-0" /> Install it on your Android phone like a real app.</li>
            <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0" /> Your records are private to your account.</li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          {!online && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <CloudOff className="size-4 shrink-0" /> You're offline. Signing in needs a connection the first time.
            </p>
          )}
          <div className="mt-6">{children}</div>
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</p>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [params] = useSearchParams();
  const current = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState(current?.user?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const reauth = params.get('reauth') && current?.expired;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={reauth ? 'Sign in again' : 'Welcome back'}
      subtitle={reauth ? 'Your session expired. Your unsynced changes are safe and will sync after you sign in.' : 'Sign in to your SpendWise account.'}
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand-700 dark:text-brand-300">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert">{error}</p>}
        <button type="submit" className="btn-primary btn w-full py-3" disabled={loading || !email || !password}>
          {loading && <Spinner className="size-4" />} Sign in
        </button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', currency: 'NPR' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    setLoading(true);
    try {
      await register({ ...form, email: form.email.trim(), name: form.name.trim() });
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 dark:text-brand-300">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <TextField label="Your name" value={form.name} onChange={set('name')} autoComplete="name" required />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        <TextField label="Password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required />
        <div>
          <label className="field-label" htmlFor="currency">
            Currency
          </label>
          <select id="currency" className="input" value={form.currency} onChange={(e) => set('currency')(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert">{error}</p>}
        <button type="submit" className="btn-primary btn w-full py-3" disabled={loading || !form.name || !form.email || !form.password}>
          {loading && <Spinner className="size-4" />} Create account
        </button>
        <p className="text-center text-xs text-slate-400">At least 8 characters. Passwords are stored securely hashed.</p>
      </form>
    </AuthShell>
  );
}
