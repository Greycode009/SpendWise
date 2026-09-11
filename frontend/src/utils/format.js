import { addDays, todayISO } from '@spendwise/shared';

const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** "2026-09-11" → "11 Sep 2026" */
export function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  return parse(iso).toLocaleDateString(undefined, opts);
}

/** Friendly day label for list headers: Today, Yesterday, Mon 8 Sep, 8 Sep 2025 */
export function dayLabel(iso, today = todayISO()) {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return parse(iso).toLocaleDateString(undefined, {
    weekday: sameYear ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

/** "2026-09" → "September 2026" */
export function monthLabel(key, style = 'long') {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: style, year: 'numeric' });
}

/** "in 3 days" / "5 days ago" relative to today (calendar days). */
export function relativeDays(iso, today = todayISO()) {
  const diff = Math.round((parse(iso) - parse(today)) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

export function timeAgo(isoTimestamp) {
  if (!isoTimestamp) return 'never';
  const sec = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86_400) return `${Math.round(sec / 3600)} h ago`;
  return new Date(isoTimestamp).toLocaleDateString();
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** Stable pleasant colour for a person's avatar. */
export function avatarColor(seed = '') {
  const palette = ['#0f766e', '#7c3aed', '#c2410c', '#0369a1', '#be185d', '#4d7c0f', '#b45309', '#4338ca'];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export const cx = (...classes) => classes.filter(Boolean).join(' ');
