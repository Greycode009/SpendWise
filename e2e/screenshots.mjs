/**
 * Captures clean marketing/doc screenshots from the seeded demo account.
 *   npm run db:seed && npm run build && npm start
 *   node e2e/screenshots.mjs
 * Output: docs/screenshots/*.png and frontend/public/screenshots/* (install sheet).
 */
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const DOCS = new URL('../docs/screenshots/', import.meta.url).pathname;
const PUB = new URL('../frontend/public/screenshots/', import.meta.url).pathname;
mkdirSync(DOCS, { recursive: true });
mkdirSync(PUB, { recursive: true });

const browser = await chromium.launch();

async function signIn(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill('demo@spendwise.app');
  await page.getByLabel('Password').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByTestId('balance').waitFor();
  await page.locator('[data-sync-state="synced"]').first().waitFor({ state: 'attached' });
}

async function shot(page, path, name, { full = false, extra = [] } = {}) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  for (const dir of [DOCS, ...extra]) await page.screenshot({ path: `${dir}${name}.png`, fullPage: full });
  console.log('  ✓', name);
}

// ---- phone (Pixel 7), light + dark
for (const scheme of ['light', 'dark']) {
  // 432×880 @2.5x = exactly 1080×2200, the size declared in the web app manifest.
  const ctx = await browser.newContext({ ...devices['Pixel 7'], colorScheme: scheme, viewport: { width: 432, height: 880 }, deviceScaleFactor: 2.5 });
  const page = await ctx.newPage();
  await signIn(page);
  const sfx = scheme === 'dark' ? '-dark' : '';
  const pub = scheme === 'light' ? [PUB] : [];
  await shot(page, '/', `mobile-dashboard${sfx}`, { extra: pub });
  await shot(page, '/add', `mobile-add${sfx}`, { extra: pub });
  if (scheme === 'light') {
    await shot(page, '/transactions', 'mobile-activity');
    await shot(page, '/people', 'mobile-people');
    await shot(page, '/analytics', 'mobile-insights', { full: true });
    const person = page.getByText('Aarav Sharma').first();
    await page.goto(`${BASE}/people`);
    await person.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DOCS}mobile-person.png` });
    await page.getByRole('link', { name: /You lent/ }).first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DOCS}mobile-loan.png` });
    await shot(page, '/sync', 'mobile-sync');
    await shot(page, '/settings', 'mobile-settings');
  }
  await ctx.close();
}

// ---- desktop
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await signIn(page);
  const sfx = scheme === 'dark' ? '-dark' : '';
  await shot(page, '/', `desktop-dashboard${sfx}`, { extra: scheme === 'light' ? [PUB] : [] });
  await shot(page, '/analytics', `desktop-insights${sfx}`);
  await ctx.close();
}

// ---- login screen
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${DOCS}desktop-login.png` });
console.log('  ✓ desktop-login');

await browser.close();
