/**
 * Creates a demo account with three months of realistic sample data.
 *   npm run db:seed
 * Login: demo@spendwise.app / demo1234
 * Running it again resets the demo account.
 */
import crypto from 'node:crypto';
import { addDays, todayISO } from '@spendwise/shared';
import { prisma } from '../src/lib/prisma.js';
import { register } from '../src/services/auth.service.js';
import { upsertRecord } from '../src/services/records.service.js';

const EMAIL = 'demo@spendwise.app';
const PASSWORD = 'demo1234';

async function main() {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  const { user } = await register({ name: 'Demo User', email: EMAIL, password: PASSWORD, currency: 'NPR' });
  const userId = user.id;
  const categories = await prisma.category.findMany({ where: { userId } });
  const cat = (name) => categories.find((c) => c.name === name).id;
  const today = todayISO();
  const save = (entity, data) => upsertRecord(prisma, userId, entity, { id: crypto.randomUUID(), ...data }, new Date());
  const rs = (n) => Math.round(n * 100);

  // Salary on the 1st of the last three months
  for (const back of [0, 1, 2]) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - back);
    await save('transactions', { type: 'income', amount: rs(85000), categoryId: cat('Salary'), date: todayISO(d), description: 'Monthly salary', paymentMethod: 'bank' });
    await save('transactions', { type: 'expense', amount: rs(18000), categoryId: cat('Rent'), date: todayISO(d), description: 'Flat rent', paymentMethod: 'bank' });
  }
  await save('transactions', { type: 'income', amount: rs(15000), categoryId: cat('Freelance'), date: addDays(today, -12), description: 'Website project', paymentMethod: 'wallet' });

  const spend = [
    ['Food & Dining', 'Momo with friends', 650, 'cash'],
    ['Groceries', 'Bhatbhateni groceries', 3400, 'card'],
    ['Transport', 'Pathao ride', 220, 'wallet'],
    ['Mobile & Internet', 'Internet bill', 1500, 'wallet'],
    ['Food & Dining', 'Lunch', 350, 'cash'],
    ['Entertainment', 'Movie tickets', 900, 'card'],
    ['Bills & Utilities', 'Electricity', 1200, 'wallet'],
    ['Shopping', 'New shoes', 4500, 'card'],
    ['Health', 'Pharmacy', 780, 'cash'],
    ['Education', 'Online course', 2500, 'card'],
    ['Transport', 'Bus fare', 60, 'cash'],
    ['Food & Dining', 'Coffee', 280, 'cash'],
  ];
  for (let i = 0; i < 75; i++) {
    const [category, description, base, method] = spend[i % spend.length];
    const amount = rs(Math.round(base * (0.7 + ((i * 37) % 60) / 100)));
    await save('transactions', { type: 'expense', amount, categoryId: cat(category), date: addDays(today, -Math.floor(i * 1.2)), description, paymentMethod: method });
  }

  const people = {};
  for (const [name, phone] of [['Aarav Sharma', '9800000001'], ['Sita Karki', '9800000002'], ['Rohan Thapa', '']]) {
    const { record } = await save('people', { name, phone });
    people[name] = record.id;
  }

  const { record: l1 } = await save('loans', { personId: people['Aarav Sharma'], direction: 'lent', amount: rs(5000), date: addDays(today, -20), dueDate: addDays(today, 10), note: 'For his bike repair' });
  await save('repayments', { loanId: l1.id, amount: rs(2000), date: addDays(today, -5) });
  const { record: l2 } = await save('loans', { personId: people['Sita Karki'], direction: 'borrowed', amount: rs(3000), date: addDays(today, -15), note: 'Trip expenses' });
  await save('repayments', { loanId: l2.id, amount: rs(1000), date: addDays(today, -3) });
  await save('loans', { personId: people['Rohan Thapa'], direction: 'lent', amount: rs(1500), date: addDays(today, -40), dueDate: addDays(today, -10) });
  await save('loans', { personId: people['Sita Karki'], direction: 'lent', amount: rs(800), date: addDays(today, -50) }).then(({ record }) =>
    save('repayments', { loanId: record.id, amount: rs(800), date: addDays(today, -30) }),
  );

  console.log(`Demo account ready → ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
