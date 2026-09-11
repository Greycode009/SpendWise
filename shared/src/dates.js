/**
 * Date helpers. Financial dates are stored as calendar dates ("YYYY-MM-DD")
 * without a time zone, so an expense made on the 3rd is always on the 3rd
 * regardless of where the server or the phone thinks "now" is.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today's calendar date in the device's local time zone. */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** "2026-09-11" → "2026-09" */
export function monthKey(iso) {
  return iso.slice(0, 7);
}

export function currentMonthKey(now = new Date()) {
  return monthKey(todayISO(now));
}

/** Shift a "YYYY-MM" key by n months. */
export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Last n month keys ending at endKey (inclusive), oldest first. */
export function lastMonths(n, endKey = currentMonthKey()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonth(endKey, -i));
  return out;
}

/** Convert a JS Date (e.g. a Postgres DATE read back as UTC midnight) to "YYYY-MM-DD". */
export function dateToISO(date) {
  if (!date) return null;
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

/** Convert "YYYY-MM-DD" to a Date at UTC midnight for storage in a DATE column. */
export function isoToDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00.000Z`);
}
