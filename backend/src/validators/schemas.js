/**
 * Request validation (Zod). The server never trusts client-side validation:
 * every write — REST or sync — is parsed through these schemas.
 */
import { z } from 'zod';
import {
  CURRENCY_CODES,
  LIMITS,
  LOAN_DIRECTIONS,
  MAX_AMOUNT_MINOR,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  isISODate,
} from '@spendwise/shared';

// ------------------------------------------------------------ primitives

const emptyToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

const optionalText = (max) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

export const uuid = z.uuid({ message: 'must be a valid UUID' });

export const isoDate = z.string().refine(isISODate, { message: 'must be a date in YYYY-MM-DD format' });

export const amount = z
  .number({ message: 'must be a number' })
  .int('must be an integer number of minor units (e.g. paisa/cents)')
  .positive('must be greater than zero')
  .max(MAX_AMOUNT_MINOR, 'is too large');

const name = z.string().trim().min(1, 'is required').max(LIMITS.name);

// ------------------------------------------------------------ auth

export const registerSchema = z.object({
  name,
  email: z.email({ message: 'must be a valid email' }).trim().toLowerCase().max(254),
  password: z.string().min(8, 'must be at least 8 characters').max(128),
  currency: z.enum(CURRENCY_CODES).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

export const updateProfileSchema = z
  .object({
    name: name.optional(),
    currency: z.enum(CURRENCY_CODES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

// ------------------------------------------------------------ entities
// These describe the FULL record. PATCH requests merge the change into the
// existing record first, then validate the result with the same schema.

export const categorySchema = z.object({
  id: uuid,
  name,
  type: z.enum(TRANSACTION_TYPES),
  icon: optionalText(LIMITS.icon),
  color: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex colour like #22c55e')
      .nullable()
      .optional(),
  ),
});

export const transactionSchema = z.object({
  id: uuid,
  type: z.enum(TRANSACTION_TYPES),
  amount,
  categoryId: z.preprocess(emptyToNull, uuid.nullable().optional()),
  date: isoDate,
  description: optionalText(LIMITS.description),
  paymentMethod: z.preprocess(emptyToNull, z.enum(PAYMENT_METHODS).nullable().optional()),
  note: optionalText(LIMITS.note),
});

export const personSchema = z.object({
  id: uuid,
  name,
  phone: optionalText(LIMITS.phone),
  note: optionalText(LIMITS.note),
});

export const loanSchema = z
  .object({
    id: uuid,
    personId: uuid,
    direction: z.enum(LOAN_DIRECTIONS),
    amount,
    date: isoDate,
    dueDate: z.preprocess(emptyToNull, isoDate.nullable().optional()),
    note: optionalText(LIMITS.note),
  })
  .refine((l) => !l.dueDate || l.dueDate >= l.date, {
    message: 'due date cannot be before the loan date',
    path: ['dueDate'],
  });

export const repaymentSchema = z.object({
  id: uuid,
  loanId: uuid,
  amount,
  date: isoDate,
  note: optionalText(LIMITS.note),
});

// ------------------------------------------------------------ sync

export const syncOpSchema = z.object({
  opId: uuid,
  entity: z.enum(['categories', 'transactions', 'people', 'loans', 'repayments']),
  action: z.enum(['upsert', 'delete']),
  recordId: uuid,
  data: z.record(z.string(), z.unknown()).optional(),
  clientUpdatedAt: z.iso.datetime({ offset: true }),
});

export const syncPushSchema = z.object({
  ops: z.array(z.unknown()).min(1).max(200),
});

export const syncPullSchema = z.object({
  since: z.iso.datetime({ offset: true }).optional(),
});

// ------------------------------------------------------------ queries

export const transactionQuerySchema = z.object({
  type: z.enum(TRANSACTION_TYPES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: uuid.optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be YYYY-MM')
    .optional(),
  months: z.coerce.number().int().min(1).max(24).default(6),
});
