import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/**
 * Registers the service worker. When a new version of the app has been
 * downloaded in the background, offers a one-tap reload instead of switching
 * versions under the user's feet.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates every hour while the app is open.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-slate-900 p-3 pl-4 text-sm text-white shadow-xl lg:bottom-6 dark:bg-white dark:text-slate-900">
      <RefreshCw className="size-4 shrink-0" />
      <span className="flex-1">A new version of SpendWise is ready.</span>
      <button type="button" className="text-slate-400 hover:text-white dark:hover:text-slate-900" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
      <button type="button" className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold text-slate-950" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
    </div>
  );
}
