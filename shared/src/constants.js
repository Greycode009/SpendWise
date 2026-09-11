/** Enumerations and defaults shared by client and server. */

export const TRANSACTION_TYPES = ['income', 'expense'];
export const LOAN_DIRECTIONS = ['lent', 'borrowed'];
export const PAYMENT_METHODS = ['cash', 'card', 'bank', 'wallet', 'other'];

export const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  card: 'Card',
  bank: 'Bank',
  wallet: 'Digital wallet',
  other: 'Other',
};

/** Syncable entities, in dependency order (parents before children). */
export const ENTITY_NAMES = ['categories', 'people', 'transactions', 'loans', 'repayments'];

/** Categories created for every new account. */
export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', type: 'expense', icon: '🍜', color: '#f97316' },
  { name: 'Groceries', type: 'expense', icon: '🛒', color: '#84cc16' },
  { name: 'Transport', type: 'expense', icon: '🚌', color: '#0ea5e9' },
  { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#ec4899' },
  { name: 'Bills & Utilities', type: 'expense', icon: '💡', color: '#eab308' },
  { name: 'Rent', type: 'expense', icon: '🏠', color: '#8b5cf6' },
  { name: 'Health', type: 'expense', icon: '💊', color: '#ef4444' },
  { name: 'Education', type: 'expense', icon: '📚', color: '#6366f1' },
  { name: 'Entertainment', type: 'expense', icon: '🎬', color: '#d946ef' },
  { name: 'Mobile & Internet', type: 'expense', icon: '📱', color: '#14b8a6' },
  { name: 'Other', type: 'expense', icon: '📦', color: '#64748b' },
  { name: 'Salary', type: 'income', icon: '💼', color: '#10b981' },
  { name: 'Business', type: 'income', icon: '🏪', color: '#22c55e' },
  { name: 'Freelance', type: 'income', icon: '💻', color: '#06b6d4' },
  { name: 'Gift', type: 'income', icon: '🎁', color: '#f43f5e' },
  { name: 'Other Income', type: 'income', icon: '💰', color: '#a3a3a3' },
];

/** Field length limits (enforced on client and server). */
export const LIMITS = {
  name: 60,
  description: 140,
  note: 500,
  phone: 30,
  icon: 16,
};
