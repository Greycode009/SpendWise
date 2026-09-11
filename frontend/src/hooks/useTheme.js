import { useSyncExternalStore } from 'react';

const KEY = 'spendwise.theme';
const listeners = new Set();
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function read() {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system';
  }
}

let theme = typeof window !== 'undefined' ? read() : 'system';

function apply() {
  const dark = theme === 'dark' || (theme === 'system' && media?.matches);
  document.documentElement.classList.toggle('dark', Boolean(dark));
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0b1120' : '#0f766e'));
}

if (typeof window !== 'undefined') {
  apply();
  media?.addEventListener('change', apply);
}

export function setTheme(next) {
  theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  apply();
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Theme preference for this device: 'system' | 'light' | 'dark'. */
export function useTheme() {
  return [useSyncExternalStore(subscribe, () => theme, () => 'system'), setTheme];
}
