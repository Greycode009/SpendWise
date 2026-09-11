/**
 * Builds docs/SpendWise-Documentation.pdf from the Markdown docs + screenshots.
 *   npm i -D marked      (one time)
 *   node docs/build-pdf.mjs
 * Uses Playwright's Chromium to print styled HTML to PDF.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';
import { chromium } from 'playwright';

const dir = new URL('./', import.meta.url).pathname;
const read = (f) => readFileSync(dir + f, 'utf8');

const SECTIONS = [
  { id: 'guide', file: 'USER_GUIDE.md', title: 'User guide' },
  { id: 'architecture', file: 'ARCHITECTURE.md', title: 'Architecture' },
  { id: 'sync', file: 'SYNC.md', title: 'Offline-first & sync' },
  { id: 'api', file: 'API.md', title: 'API reference' },
  { id: 'security', file: 'SECURITY.md', title: 'Security' },
  { id: 'testing', file: 'TESTING.md', title: 'Testing' },
  { id: 'deployment', file: 'DEPLOYMENT.md', title: 'Running, deploying & installing' },
  { id: 'roadmap', file: 'ROADMAP.md', title: 'Roadmap' },
];

// Section files start with their own "# Title" — replace it with a numbered heading.
function render(md, n, title) {
  const body = md.replace(/^# .*\n/, '').replace(/\]\(([A-Z_]+)\.md(#[^)]*)?\)/g, (_m, f) => {
    const s = SECTIONS.find((x) => x.file === `${f}.md`);
    return s ? `](#${s.id})` : `](${f}.md)`;
  });
  return `<h1 class="section"><span>${String(n).padStart(2, '0')}</span>${title}</h1>` + marked.parse(body);
}

const shot = (name, caption, cls = 'phone') =>
  `<figure class="${cls}"><img src="screenshots/${name}.png"><figcaption>${caption}</figcaption></figure>`;

const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const html = `<!doctype html><html><head><meta charset="utf-8"><title>SpendWise — Project Documentation</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  :root { --brand:#0f766e; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --soft:#f1f5f9; }
  * { box-sizing: border-box; }
  body { font-family: 'Liberation Sans', 'DejaVu Sans', Arial, 'Noto Color Emoji', sans-serif; color: var(--ink); font-size: 10.2pt; line-height: 1.55; margin: 0; }
  h1, h2, h3 { line-height: 1.25; break-after: avoid; }
  h1.section { font-size: 22pt; margin: 0 0 14pt; padding-bottom: 8pt; border-bottom: 3px solid var(--brand); break-before: page; }
  h1.section span { color: var(--brand); font-size: 13pt; margin-right: 10pt; vertical-align: 3pt; font-weight: 700; }
  h2 { font-size: 14pt; margin: 20pt 0 6pt; color: var(--brand); }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; }
  p, li { orphans: 3; widows: 3; }
  a { color: var(--brand); text-decoration: none; }
  code { font-family: 'DejaVu Sans Mono', monospace; font-size: 8.4pt; background: var(--soft); padding: 1px 4px; border-radius: 4px; }
  pre { background: #0b1120; color: #e2e8f0; padding: 10pt 12pt; border-radius: 8px; font-size: 8pt; line-height: 1.45; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
  pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 8.8pt; break-inside: auto; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { background: var(--brand); color: #fff; text-align: left; padding: 5pt 7pt; font-weight: 700; }
  td { border-bottom: 1px solid var(--line); padding: 5pt 7pt; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  blockquote { margin: 10pt 0; padding: 8pt 12pt; background: #effcf9; border-left: 4px solid var(--brand); border-radius: 0 8px 8px 0; color: #134641; }
  blockquote p { margin: 0; }
  ul, ol { padding-left: 18pt; }
  input[type=checkbox] { margin-right: 6pt; }

  /* cover */
  .cover { height: 257mm; display: flex; flex-direction: column; justify-content: space-between; }
  .cover .brand { display: flex; align-items: center; gap: 12pt; }
  .cover .brand svg { width: 46pt; height: 46pt; }
  .cover .brand b { font-size: 26pt; letter-spacing: -0.5pt; }
  .cover .brand b span { color: var(--brand); }
  .cover h1 { font-size: 34pt; margin: 34pt 0 6pt; letter-spacing: -0.8pt; line-height: 1.1; }
  .cover .sub { font-size: 13pt; color: var(--muted); max-width: 140mm; }
  .cover .shots { display: flex; gap: 10pt; align-items: flex-end; margin-top: 18pt; }
  .cover .shots img { border-radius: 14pt; box-shadow: 0 6pt 18pt rgba(15,23,42,.18); border: 1px solid var(--line); }
  .cover .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt; font-size: 9pt; color: var(--muted); border-top: 1px solid var(--line); padding-top: 10pt; }
  .cover .meta b { display: block; color: var(--ink); font-size: 10pt; }

  .toc { break-before: page; }
  .toc h2 { font-size: 20pt; color: var(--ink); margin-top: 0; }
  .toc ol { list-style: none; padding: 0; counter-reset: s; }
  .toc li { display: flex; gap: 12pt; padding: 8pt 0; border-bottom: 1px solid var(--line); font-size: 12pt; counter-increment: s; }
  .toc li::before { content: counter(s, decimal-leading-zero); color: var(--brand); font-weight: 700; }
  .toc li small { margin-left: auto; color: var(--muted); font-size: 9pt; align-self: center; }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin: 12pt 0; }
  .kpis div { background: var(--soft); border-radius: 10px; padding: 9pt 10pt; }
  .kpis b { display: block; font-size: 17pt; color: var(--brand); }
  .kpis span { font-size: 8.5pt; color: var(--muted); }

  .gallery { display: flex; flex-wrap: wrap; gap: 10pt; justify-content: space-between; margin: 10pt 0; }
  figure { margin: 0; break-inside: avoid; text-align: center; }
  figure.phone { width: 31%; }
  figure.phone img { width: 100%; border-radius: 12pt; border: 1px solid var(--line); }
  figure.wide { width: 100%; margin: 10pt 0; }
  figure.wide img { width: 100%; border-radius: 8pt; border: 1px solid var(--line); }
  figure.half { width: 48.5%; }
  figure.half img { width: 100%; border-radius: 8pt; border: 1px solid var(--line); }
  figcaption { font-size: 8.5pt; color: var(--muted); margin-top: 4pt; }
</style></head><body>

<section class="cover">
  <div>
    <div class="brand">
      <svg viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0f766e"/><rect x="14" y="34" width="8" height="16" rx="3" fill="#99f6e4"/><rect x="28" y="24" width="8" height="26" rx="3" fill="#5eead4"/><rect x="42" y="14" width="8" height="36" rx="3" fill="#fff"/></svg>
      <b>Spend<span>Wise</span></b>
    </div>
    <h1>Project documentation<br>Version 1.0</h1>
    <p class="sub">An offline-first personal finance Progressive Web App — installable on Android, usable in any desktop browser — for tracking income, expenses, money lent and borrowed, and repayments.</p>
    <div class="shots">
      <img src="screenshots/mobile-dashboard.png" style="width:30%">
      <img src="screenshots/mobile-add.png" style="width:30%">
      <img src="screenshots/mobile-person.png" style="width:30%">
    </div>
  </div>
  <div class="meta">
    <div><b>Built</b>${today}</div>
    <div><b>Stack</b>React · Vite · Tailwind · IndexedDB · PWA · Node.js · Express · PostgreSQL · Prisma</div>
    <div><b>Status</b>V1 complete · 62 automated tests + 20-step end-to-end run passing</div>
  </div>
</section>

<section class="toc">
  <h2>Contents</h2>
  <ol>
    <li><a href="#overview">Overview &amp; screens</a><small>What V1 does</small></li>
    ${SECTIONS.map((s) => `<li><a href="#${s.id}">${s.title}</a><small>${s.file}</small></li>`).join('')}
  </ol>
</section>

<h1 class="section" id="overview"><span>01</span>Overview &amp; screens</h1>
<p><b>SpendWise</b> answers five questions: <i>Where did my money go? How much do I have? Who owes me? Whom do I owe? Am I saving enough?</i>
Every change is written to the device first (IndexedDB), so the app is fully usable without internet, and a background sync engine keeps each device and the server in step.</p>
<div class="kpis">
  <div><b>5</b><span>core record types: transactions, categories, people, loans, repayments</span></div>
  <div><b>34</b><span>REST endpoints + 2 sync endpoints</span></div>
  <div><b>62</b><span>unit, API and offline-engine tests</span></div>
  <div><b>20</b><span>end-to-end steps incl. offline → online</span></div>
</div>
<h2>V1 features</h2>
<table><thead><tr><th>Area</th><th>What you get</th></tr></thead><tbody>
<tr><td>Accounts</td><td>Register / login, 15-min JWT + rotating 30-day refresh tokens, per-user data isolation, rate-limited login</td></tr>
<tr><td>Income &amp; expenses</td><td>Amount, category, date, description, payment method (cash, card, bank, digital wallet), notes; edit, delete, search, month filter</td></tr>
<tr><td>Categories</td><td>16 defaults with icons and colours, plus custom categories</td></tr>
<tr><td>People &amp; loans</td><td>Money lent / borrowed per person, due dates, overdue flags, net balance per person</td></tr>
<tr><td>Repayments</td><td>Partial or full; outstanding amount and status (open, partly repaid, overdue, settled)</td></tr>
<tr><td>Dashboard</td><td>Balance, net worth, month income &amp; spending, owed to you / you owe, spending donut, recent activity, loans due soon</td></tr>
<tr><td>Insights</td><td>Spending by category, 6-month income vs expenses, daily spending, savings rate, change vs last month</td></tr>
<tr><td>PWA</td><td>Installable (Android, desktop, iOS), home-screen shortcuts, offline app shell, “new version” prompt</td></tr>
<tr><td>Offline &amp; sync</td><td>Local-first writes, sync queue with pending / syncing / synced / failed states, retries with backoff, duplicate protection, deterministic multi-device conflict rules</td></tr>
<tr><td>UI</td><td>Mobile-first (bottom nav + big “+”), sidebar on desktop, light &amp; dark themes, 12 currencies with NPR default and lakh grouping</td></tr>
</tbody></table>

<h2>Phone screens</h2>
<div class="gallery">
  ${shot('mobile-dashboard', 'Dashboard')}
  ${shot('mobile-add', 'Add entry — fast, thumb-friendly')}
  ${shot('mobile-activity', 'Activity — grouped by day')}
  ${shot('mobile-people', 'People — who owes whom')}
  ${shot('mobile-person', 'Person — open and settled loans')}
  ${shot('mobile-loan', 'Loan — repayments and progress')}
  ${shot('mobile-sync', 'Sync status')}
  ${shot('mobile-settings', 'Settings')}
  ${shot('mobile-dashboard-dark', 'Dark theme')}
</div>
<h2>Desktop</h2>
${shot('desktop-dashboard', 'Dashboard in a desktop browser (sidebar layout)', 'wide')}
<div class="gallery">
  ${shot('desktop-insights', 'Insights', 'half')}
  ${shot('desktop-dashboard-dark', 'Dark theme', 'half')}
</div>

${SECTIONS.map((s, i) => `<div id="${s.id}">${render(read(s.file), i + 2, s.title)}</div>`).join('\n')}
</body></html>`;

writeFileSync(dir + '.pdf-build.html', html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + dir + '.pdf-build.html', { waitUntil: 'networkidle' });
await page.pdf({
  path: dir + 'SpendWise-Documentation.pdf',
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-size:7.5pt;color:#94a3b8;padding:0 16mm;display:flex;justify-content:space-between;font-family:Liberation Sans,Arial"><span>SpendWise — Project Documentation v1.0</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
});
await browser.close();
console.log('wrote docs/SpendWise-Documentation.pdf');
