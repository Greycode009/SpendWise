/**
 * PWA installation. Chrome/Edge/Android fire `beforeinstallprompt`, which we
 * keep so an "Install app" button can show the native install dialog later.
 * iOS Safari has no such event — users install via Share → Add to Home Screen.
 */
import { useSyncExternalStore } from 'react';

let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

let installed = isStandalone();

/** Call once at startup (before React renders) so the early event is not missed. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => (installed ? 'installed' : deferred ? 'available' : 'unavailable');

export function useInstallPrompt() {
  const status = useSyncExternalStore(subscribe, snapshot, () => 'unavailable');
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  async function install() {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === 'accepted';
  }

  return { status, install, isIOS };
}
