/**
 * Session store: who is logged in on this device and their tokens.
 *
 * Kept in localStorage so the app can open (and work) with no connection.
 * `expired` means the refresh token was rejected: local data stays intact and
 * unsynced changes are kept until the user logs in again.
 */
const KEY = 'spendwise.session';
const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

let current = typeof localStorage === 'undefined' ? null : read();

function emit() {
  for (const fn of listeners) fn();
}

export const session = {
  get: () => current,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Replace the whole session (after login/register). */
  set(next) {
    current = next ? { ...next, expired: false } : null;
    try {
      if (current) localStorage.setItem(KEY, JSON.stringify(current));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage full or unavailable — session lives in memory only */
    }
    emit();
  },
  /** Merge fields into the current session (token refresh, profile change). */
  update(patch) {
    if (!current) return;
    session.set({ ...current, ...patch, user: { ...current.user, ...(patch.user || {}) } });
  },
  markExpired() {
    if (!current || current.expired) return;
    current = { ...current, expired: true, accessToken: null, refreshToken: null };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* ignore */
    }
    emit();
  },
  clear: () => session.set(null),
};

// Keep several open tabs of the web app in agreement.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      current = read();
      emit();
    }
  });
}
