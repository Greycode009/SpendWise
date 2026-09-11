import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, Home, ListChecks, Plus, Settings, Users, CloudOff, LogIn } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import SyncBadge from '../components/SyncBadge.jsx';
import UpdatePrompt from '../components/UpdatePrompt.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { useSession } from '../hooks/useSession.js';
import { cx } from '../utils/format.js';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/transactions', label: 'Activity', icon: ListChecks },
  { to: '/people', label: 'People', icon: Users },
  { to: '/analytics', label: 'Insights', icon: BarChart3 },
];

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex dark:border-slate-800 dark:bg-slate-950">
      <Link to="/" className="px-2">
        <Logo />
      </Link>
      <Link to="/add" className="btn-primary btn mt-8 w-full py-3 shadow-(--shadow-float)">
        <Plus className="size-5" /> Add entry
      </Link>
      <nav className="mt-6 space-y-1" aria-label="Main">
        {[...NAV, { to: '/settings', label: 'Settings', icon: Settings }].map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-2">
        <SyncBadge />
      </div>
    </aside>
  );
}

function BottomNav() {
  const items = [NAV[0], NAV[1], null, NAV[2], NAV[3]];
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95"
      aria-label="Main"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
        {items.map((item) =>
          item ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold',
                  isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400',
                )
              }
            >
              <item.icon className="size-6" />
              {item.label}
            </NavLink>
          ) : (
            <div key="add" className="flex justify-center">
              <Link
                to="/add"
                aria-label="Add entry"
                className="-mt-7 grid size-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-(--shadow-float) transition active:scale-95 dark:bg-brand-500 dark:text-slate-950"
              >
                <Plus className="size-7" strokeWidth={2.5} />
              </Link>
            </div>
          ),
        )}
      </div>
    </nav>
  );
}

function Banners() {
  const online = useOnline();
  const session = useSession();
  if (session?.expired) {
    return (
      <Link to="/login?reauth=1" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
        <LogIn className="size-4" /> Your session expired. Your data is safe on this device — tap to sign in and resume syncing.
      </Link>
    );
  }
  if (!online) {
    return (
      <div className="flex items-center justify-center gap-2 bg-slate-800 px-4 py-2 text-center text-xs font-medium text-slate-100">
        <CloudOff className="size-4" /> You're offline. Everything you add is saved on this device and will sync later.
      </div>
    );
  }
  return null;
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const hideBottomNav = pathname.startsWith('/add') || /^\/(transactions|loans)\/[^/]+/.test(pathname);
  return (
    <div className="min-h-dvh lg:pl-64">
      <Sidebar />
      <div className="safe-top sticky top-0 z-20">
        <Banners />
      </div>
      <main className={cx('mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 lg:px-10 lg:pt-8', hideBottomNav ? 'pb-10' : 'pb-28 lg:pb-12')}>
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
      <UpdatePrompt />
    </div>
  );
}
