/**
 * End-to-end check of the real app in a real (headless) Chromium:
 * registration, fast entry, OFFLINE use (service worker + IndexedDB),
 * automatic sync on reconnect, lending/repayment, insights, and the PWA
 * manifest. Saves screenshots to e2e/output/.
 *
 * Usage:
 *   npm run build && npm start          # serve API + built PWA on :4000
 *   npm run test:e2e                    # in another terminal
 *
 * Env: BASE_URL (default http://localhost:4000), HEADED=1 to watch it run.
 */
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const OUT = new URL('./output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const email = `e2e-${Date.now()}@spendwise.test`;
const password = 'e2e-password-123';
let step = 0;
const log = (msg) => console.log(`  ${String(++step).padStart(2, '0')}. ${msg}`);
const assert = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
};

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

async function waitForSyncState(page, state, timeout = 15_000) {
  await page.locator(`[data-sync-state="${state}"]`).first().waitFor({ state: 'attached', timeout });
}

const browser = await chromium.launch({ headless: !process.env.HEADED });
const errors = [];
let current = null; // page to screenshot if a step fails

try {
  console.log(`\nSpendWise E2E against ${BASE}\n`);
  const phone = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'allow' });
  const page = await phone.newPage();
  current = page;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text()) && errors.push(m.text()));

  // ------------------------------------------------------------------ auth
  await page.goto(BASE);
  await page.waitForURL('**/login');
  log('Unauthenticated visit redirects to /login');
  await page.screenshot({ path: `${OUT}mobile-login.png` });

  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill('Dipesh');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByText(/Good (morning|afternoon|evening), Dipesh/).waitFor();
  log('Registered a new account and landed on the dashboard');
  await waitForSyncState(page, 'synced');
  log('Initial sync completed (default categories downloaded)');

  // ------------------------------------------------------------------ service worker
  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 15_000 });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15_000 });
  log('Service worker installed and controlling the page');

  const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
  assert(manifest.display === 'standalone' && manifest.icons.some((i) => i.purpose === 'maskable'), 'manifest is installable');
  log(`Web app manifest OK (${manifest.name}, ${manifest.icons.length} icons, maskable icon present)`);

  // ------------------------------------------------------------------ online entry
  await page.getByRole('navigation').getByRole('link', { name: 'Add entry' }).click();
  await page.getByLabel('Amount').fill('1,250.50');
  await page.getByRole('button', { name: /Food & Dining/ }).click();
  await page.getByLabel('Description').fill('Momo with friends');
  await page.screenshot({ path: `${OUT}mobile-add.png` });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Momo with friends').first().waitFor();
  await waitForSyncState(page, 'synced');
  log('Added an expense online — it synced');

  await page.getByRole('navigation').getByRole('link', { name: 'Add entry' }).click();
  await page.getByRole('tab', { name: 'Income' }).click();
  await page.getByPlaceholder('e.g. September salary').waitFor(); // income form mounted
  await page.getByLabel('Amount').fill('85000');
  await page.getByRole('button', { name: /Salary/ }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByTestId('balance').waitFor();
  await waitForSyncState(page, 'synced');
  log('Added income — synced');

  // ------------------------------------------------------------------ offline
  await phone.setOffline(true);
  await page.reload(); // app shell must come from the service worker cache
  await page.getByText(/You're offline/).waitFor();
  await page.getByText('Momo with friends').first().waitFor();
  log('Went OFFLINE and reloaded — app shell served by the service worker, data read from IndexedDB');

  await page.getByRole('navigation').getByRole('link', { name: 'Add entry' }).click();
  await page.getByLabel('Amount').fill('60');
  await page.getByLabel('Description').fill('Milk tea');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText(/Saved on this device/).waitFor();
  log('Added an expense while offline ("Saved on this device")');

  await page.getByRole('navigation').getByRole('link', { name: 'Add entry' }).click();
  await page.getByRole('tab', { name: 'Lent' }).click();
  await page.getByLabel('Amount lent').waitFor();
  await page.getByLabel('Amount lent').fill('5000');
  await page.getByLabel("New person's name").fill('Aarav Sharma');
  await page.getByRole('button', { name: 'Save money lent' }).click();
  await page.waitForURL(BASE + '/');
  await waitForSyncState(page, 'offline');
  await page.locator('[data-sync-state]', { hasText: '3 to sync' }).first().waitFor({ timeout: 5000 }).catch(() => {});
  const badge = await page.locator('[data-sync-state]').first().innerText();
  assert(/3 to sync/.test(badge), `badge shows 3 pending ops, got "${badge}"`);
  log(`Lent money to a NEW person while offline — badge: "${badge}"`);
  await page.screenshot({ path: `${OUT}mobile-offline.png` });

  // Server must not have the offline records yet.
  const auth = (await api('/auth/login', { method: 'POST', body: { email, password } })).body;
  let server = await api('/transactions', { token: auth.accessToken });
  assert(server.body.data.length === 2, 'server has only the 2 online transactions');

  // ------------------------------------------------------------------ reconnect
  await phone.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitForSyncState(page, 'synced', 20_000);
  log('Back ONLINE — pending changes synced automatically');

  server = await api('/transactions', { token: auth.accessToken });
  assert(server.body.data.length === 3, `server now has 3 transactions (got ${server.body.data.length})`);
  const loans = await api('/loans', { token: auth.accessToken });
  assert(loans.body.data.length === 1 && loans.body.data[0].amount === 500000, 'server has the offline loan');
  const people = await api('/people', { token: auth.accessToken });
  assert(people.body.data[0].name === 'Aarav Sharma', 'server has the offline person');
  log('Verified on the server: 3 transactions, 1 person, 1 loan (Rs 5,000)');

  // ------------------------------------------------------------------ repayment
  await page.getByRole('navigation').getByRole('link', { name: 'People' }).click();
  await page.getByText('Aarav Sharma').click();
  await page.getByText('owes you').first().waitFor();
  await page.getByRole('link', { name: /You lent/ }).first().click();
  await page.getByRole('button', { name: 'Record money received' }).click();
  await page.locator('#repay-amount').fill('2000');
  await page.getByRole('button', { name: 'Save repayment' }).click();
  await page.getByText('Partly repaid').first().waitFor();
  await waitForSyncState(page, 'synced');
  const loan = await api(`/loans/${loans.body.data[0].id}`, { token: auth.accessToken });
  assert(loan.body.data.outstanding === 300000, 'server outstanding = 3,000');
  log('Recorded a partial repayment — outstanding Rs 3,000 on the server');
  await page.screenshot({ path: `${OUT}mobile-loan.png` });

  // ------------------------------------------------------------------ screens
  await page.getByRole('button', { name: 'Go back' }).click(); // loan → person
  await page.getByRole('navigation').getByRole('link', { name: 'Home' }).click();
  await page.getByTestId('balance').waitFor();
  await page.screenshot({ path: `${OUT}mobile-dashboard.png` });
  await page.getByRole('navigation').getByRole('link', { name: 'Insights' }).click();
  await page.getByText('Spending by category').waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}mobile-insights.png`, fullPage: true });
  await page.getByRole('navigation').getByRole('link', { name: 'Activity' }).click();
  await page.getByText('Milk tea').waitFor();
  await page.screenshot({ path: `${OUT}mobile-activity.png` });
  log('Dashboard, Activity and Insights render');

  // ------------------------------------------------------------------ desktop + dark
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const dpage = await desktop.newPage();
  dpage.on('pageerror', (e) => errors.push(e.message));
  await dpage.goto(`${BASE}/login`);
  await dpage.getByLabel('Email').fill(email);
  await dpage.getByLabel('Password').fill(password);
  await dpage.getByRole('button', { name: 'Sign in' }).click();
  await dpage.getByTestId('balance').waitFor();
  await dpage.getByText('Momo with friends').first().waitFor();
  log('Signed in on a second "device" (desktop, dark mode) — all data pulled from the server');
  await dpage.waitForTimeout(400);
  await dpage.screenshot({ path: `${OUT}desktop-dashboard-dark.png` });
  await dpage.goto(`${BASE}/people`);
  await dpage.getByText('Aarav Sharma').waitFor();
  await dpage.screenshot({ path: `${OUT}desktop-people-dark.png` });

  // Multi-device: an edit on desktop appears on the phone after sync.
  await dpage.goto(`${BASE}/transactions`);
  await dpage.getByText('Milk tea').click();
  await dpage.getByLabel('Description').fill('Milk tea (edited on laptop)');
  await dpage.getByRole('button', { name: 'Save changes' }).click();
  // Wait until the laptop's change has reached the server…
  for (let i = 0; i < 40; i++) {
    const list = await api('/transactions?q=laptop', { token: auth.accessToken });
    if (list.body.data?.length) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  // …then the phone picks it up on its next sync (app reopened).
  await page.reload();
  await page.getByText('Milk tea (edited on laptop)').waitFor({ timeout: 15_000 });
  log('Edit made on desktop appeared on the phone after sync');

  // Settings: currency change syncs to the account; custom category; logout wipes local data.
  await dpage.goto(`${BASE}/settings`);
  await dpage.getByRole('combobox').selectOption('USD');
  await dpage.getByText('Currency updated').waitFor();
  for (let i = 0; i < 40; i++) {
    const me = await api('/auth/me', { token: auth.accessToken });
    if (me.body.user.currency === 'USD') break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert((await api('/auth/me', { token: auth.accessToken })).body.user.currency === 'USD', 'currency synced to server');
  await dpage.goto(`${BASE}/`);
  await dpage.getByTestId('balance').getByText('$').waitFor();
  log('Changed currency to USD — amounts re-render and the setting synced to the account');

  await dpage.goto(`${BASE}/settings/categories`);
  await dpage.getByRole('button', { name: 'New' }).click();
  await dpage.getByLabel('Name').fill('Pets');
  await dpage.getByRole('button', { name: 'Icon 🐶' }).click();
  await dpage.getByRole('button', { name: 'Add category' }).click();
  await dpage.getByText('Pets').waitFor();
  for (let i = 0; i < 40; i++) {
    const cats = await api('/categories', { token: auth.accessToken });
    if (cats.body.data.some((c) => c.name === 'Pets')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert((await api('/categories', { token: auth.accessToken })).body.data.some((c) => c.name === 'Pets'), 'custom category synced');
  log('Created a custom category — synced to the server');

  await dpage.goto(`${BASE}/settings`);
  await dpage.getByRole('button', { name: 'Log out' }).click();
  await dpage.getByRole('dialog').getByRole('button', { name: 'Log out' }).click();
  await dpage.waitForURL('**/login');
  const dbs = await dpage.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  assert(!dbs.some((n) => n?.startsWith('spendwise-')), `local database removed on logout (found ${dbs})`);
  log('Logged out — this device\'s local database was deleted');

  const light = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const lpage = await light.newPage();
  await lpage.goto(`${BASE}/login`);
  await lpage.getByLabel('Email').fill(email);
  await lpage.getByLabel('Password').fill(password);
  await lpage.getByRole('button', { name: 'Sign in' }).click();
  await lpage.getByText('Momo with friends').first().waitFor();
  await lpage.waitForTimeout(400);
  await lpage.screenshot({ path: `${OUT}desktop-dashboard.png` });
  await lpage.goto(`${BASE}/analytics`);
  await lpage.getByText('Spending by category').waitFor();
  await lpage.waitForTimeout(400);
  await lpage.screenshot({ path: `${OUT}desktop-insights.png` });

  assert(errors.length === 0, `no page errors (got: ${errors.join(' | ')})`);
  log('No JavaScript errors in the console');
  console.log(`\n✅ All E2E checks passed. Screenshots: ${OUT}\n`);
} catch (err) {
  console.error(`\n❌ E2E failed at step ${step + 1}: ${err.message}\n`);
  await current?.screenshot({ path: `${OUT}failure.png` }).catch(() => {});
  if (errors.length) console.error('Page errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
