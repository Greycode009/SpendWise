import { dateToISO } from '@spendwise/shared';

/**
 * Convert a Prisma row into the JSON shape the API returns:
 *  - BigInt amounts → numbers (minor units; safe up to 9e15)
 *  - DATE columns   → "YYYY-MM-DD"
 *  - timestamps     → ISO strings
 *  - userId removed (the client already knows who it is)
 */
const DATE_ONLY = new Set(['date', 'dueDate']);

export function serialize(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'userId' || key === 'passwordHash') continue;
    if (typeof value === 'bigint') out[key] = Number(value);
    else if (value instanceof Date) out[key] = DATE_ONLY.has(key) ? dateToISO(value) : value.toISOString();
    else out[key] = value;
  }
  return out;
}

export const serializeMany = (rows) => rows.map(serialize);

export function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    currency: user.currency,
    createdAt: user.createdAt.toISOString(),
  };
}
