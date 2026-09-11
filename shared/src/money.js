/**
 * Money helpers.
 *
 * SpendWise stores every amount as an INTEGER number of minor units
 * (paisa, cents…) so that financial math never suffers from floating-point
 * rounding (0.1 + 0.2 !== 0.3). 1250.50 is stored as 125050.
 */

export const MAX_AMOUNT_MINOR = 1_000_000_000_000_00; // 1 trillion major units — sanity cap

export const CURRENCIES = [
  { code: 'NPR', label: 'Nepalese Rupee', locale: 'en-IN' },
  { code: 'INR', label: 'Indian Rupee', locale: 'en-IN' },
  { code: 'USD', label: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', label: 'Euro', locale: 'en-IE' },
  { code: 'GBP', label: 'British Pound', locale: 'en-GB' },
  { code: 'AUD', label: 'Australian Dollar', locale: 'en-AU' },
  { code: 'CAD', label: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AED', label: 'UAE Dirham', locale: 'en-AE' },
  { code: 'JPY', label: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'BDT', label: 'Bangladeshi Taka', locale: 'en-IN' },
  { code: 'PKR', label: 'Pakistani Rupee', locale: 'en-IN' },
  { code: 'LKR', label: 'Sri Lankan Rupee', locale: 'en-IN' },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

/**
 * Parse user input ("1,250.5", "250", 99.99) into minor units.
 * Returns null when the input is not a valid positive-or-zero amount.
 */
export function toMinor(input) {
  if (input === null || input === undefined) return null;
  let str = typeof input === 'number' ? String(input) : String(input).trim();
  str = str.replace(/[,\s_]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(str) && !/^\.\d{1,2}$/.test(str)) return null;
  const [whole = '0', frac = ''] = str.split('.');
  const minor = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}

/** Convert minor units back to a plain number of major units (for charts/inputs). */
export function fromMinor(minor) {
  return Math.round(Number(minor || 0)) / 100;
}

/** Value suitable for pre-filling an <input>: "1250.5" → "1250.50", whole numbers without decimals. */
export function minorToInput(minor) {
  if (minor === null || minor === undefined || minor === '') return '';
  const n = Math.round(Number(minor));
  const whole = Math.trunc(n / 100);
  const frac = Math.abs(n % 100);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
}

const formatterCache = new Map();

/**
 * @param {'whole'|'cents'|'compact'} style
 *  - whole:   no decimals (Rs 1,250)
 *  - cents:   always two decimals when there is a fraction (Rs 1,250.50)
 *  - compact: short form for chart axes (Rs 1.3K, Rs 2.5M)
 */
function getFormatter(currency, style) {
  const key = `${currency}|${style}`;
  if (!formatterCache.has(key)) {
    const meta = CURRENCIES.find((c) => c.code === currency);
    // Lakh grouping (1,00,000) for South-Asian currencies; compact notation
    // always uses international K/M/B so "1.3T" is never mistaken for trillion.
    const locale = style === 'compact' ? 'en-US' : (meta?.locale ?? 'en-US');
    let fmt;
    try {
      fmt = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        notation: style === 'compact' ? 'compact' : 'standard',
        minimumFractionDigits: style === 'cents' ? 2 : 0,
        maximumFractionDigits: style === 'cents' ? 2 : style === 'compact' ? 1 : 0,
      });
    } catch {
      fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
    }
    formatterCache.set(key, fmt);
  }
  return formatterCache.get(key);
}

/** Format minor units for display, e.g. formatMoney(125050, 'NPR') → "Rs 1,250.50", formatMoney(25000) → "Rs 250" */
export function formatMoney(minor, currency = 'NPR', opts = {}) {
  const n = Math.round(Number(minor || 0));
  const value = (opts.absolute ? Math.abs(n) : n) / 100;
  const style = opts.compact ? 'compact' : n % 100 === 0 ? 'whole' : 'cents';
  return getFormatter(currency, style).format(value);
}

/** Add a sign for display: +Rs 500 / −Rs 200 */
export function formatSigned(minor, currency = 'NPR') {
  const n = Number(minor || 0);
  const abs = formatMoney(Math.abs(n), currency);
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

/** Sum a list of minor-unit amounts safely. */
export function sumMinor(values) {
  let total = 0;
  for (const v of values) total += Math.round(Number(v || 0));
  return total;
}
