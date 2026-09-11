# Testing

SpendWise has four layers of automated tests. All of them pass on the V1
codebase (**62 unit/API tests + a 20-step end-to-end run**).

| Layer | Tool | Where | What it proves |
| --- | --- | --- | --- |
| Financial logic | Vitest | `shared/test/finance.test.js` (14) | Money parsing without float errors, lakh formatting, balances, loan status/outstanding, per-person balances, analytics |
| API | Vitest + Supertest + real PostgreSQL | `backend/test/*.test.js` (35) | Auth, validation, CRUD, business rules, **user isolation**, sync idempotency & conflicts |
| Offline engine | Vitest + fake-indexeddb | `frontend/test/sync.test.js` (13) | Local-first writes, outbox, retries/backoff, duplicate protection, merge rules |
| End-to-end | Playwright (Chromium, Pixel 7 + desktop) | `e2e/run.mjs` | The real app: service worker, offline mode, reconnect sync, multi-device |

Run: `npm test` (first three) and `npm run test:e2e` (needs the app running — see
[DEPLOYMENT.md](DEPLOYMENT.md#running-the-tests-locally)).

## Coverage of the project's testing strategy

| Requirement (from the project plan) | Covered by |
| --- | --- |
| Unit-test financial calculations and validation | `finance.test.js`; `records.test.js › rejects invalid input` (7 cases) |
| API-test authentication and authorization | `auth.test.js` — register, login, duplicate email, bcrypt hash stored, expired/forged tokens, refresh rotation, logout revocation |
| CRUD for each core entity | `records.test.js` — transactions, people, loans, repayments, categories |
| Offline creation, editing and deletion | `frontend/test/sync.test.js › local-first writes`; E2E steps 8–10 |
| Reconnect and sync behaviour | engine test "stays offline… then syncs on reconnect"; E2E step 11–12 |
| Retry after failed synchronization | engine tests "keeps ops queued with backoff", "marks rejected ops as permanently failed…", "discarding a failed change…" |
| Duplicate-sync protection | API "is idempotent: re-sending the same ops never applies them twice" (incl. a repayment sent twice counted once); engine "does not duplicate records when a response is lost", "re-queues ops interrupted mid-sync" |
| Mobile layouts on Android screen sizes | E2E runs on a Pixel 7 profile; screenshots in `docs/screenshots/` |
| PWA installation & service-worker behaviour | E2E step 4 (SW controls page), 5 (manifest installable, maskable icon), 8 (offline reload served from SW cache) |
| User isolation | API "never lets one account read or change another account's records", sync "never lets another account overwrite or delete…", pull "does not leak another account's changes" |

## End-to-end run (latest)

```
01. Unauthenticated visit redirects to /login
02. Registered a new account and landed on the dashboard
03. Initial sync completed (default categories downloaded)
04. Service worker installed and controlling the page
05. Web app manifest OK (SpendWise — Personal Finance, 3 icons, maskable icon present)
06. Added an expense online — it synced
07. Added income — synced
08. Went OFFLINE and reloaded — app shell served by the service worker, data read from IndexedDB
09. Added an expense while offline ("Saved on this device")
10. Lent money to a NEW person while offline — badge: "Offline · 3 to sync"
11. Back ONLINE — pending changes synced automatically
12. Verified on the server: 3 transactions, 1 person, 1 loan (Rs 5,000)
13. Recorded a partial repayment — outstanding Rs 3,000 on the server
14. Dashboard, Activity and Insights render
15. Signed in on a second "device" (desktop, dark mode) — all data pulled from the server
16. Edit made on desktop appeared on the phone after sync
17. Changed currency to USD — amounts re-render and the setting synced to the account
18. Created a custom category — synced to the server
19. Logged out — this device's local database was deleted
20. No JavaScript errors in the console
✅ All E2E checks passed.
```

## Bugs the tests caught during development

- Mobile dashboard cards overflowed the screen width (CSS grid `min-width:auto`) —
  fixed with `grid-cols-1`/`min-w-0`; seen in E2E screenshots.
- Compact amounts used Indian-English "T" for thousand ("Rs 1.3T") — now "Rs 1.3K".
- Amounts with paisa showed one decimal ("Rs 80,689.5") — now "Rs 80,689.50".
- `upgrade-insecure-requests` CSP broke plain-http use on a LAN IP — removed (HTTPS + HSTS in production instead).
- The login rate limiter correctly blocked sign-ins after many E2E runs from one IP.

## Manual checklist before a release

- [ ] Install on a real Android phone from the HTTPS URL; open from the home screen.
- [ ] Airplane mode: open the app, add an expense and a loan, close and reopen, turn airplane mode off → badge goes to *Synced*.
- [ ] Two devices, same account: edit on one, see it on the other.
- [ ] Deploy a new build → "A new version is ready" prompt appears → Update works.
- [ ] Dark mode and a small phone (360 px wide).
