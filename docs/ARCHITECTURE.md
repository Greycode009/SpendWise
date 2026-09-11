# Architecture

```
┌──────────────────────── Phone / Browser ───────────────────────┐
│ React PWA (Vite)                                               │
│   pages ──► hooks (useLiveQuery) ──► IndexedDB (Dexie)         │
│     │                                   ▲       │              │
│     └─ save / remove ──► repo.js ───────┘       │ outbox       │
│                                                 ▼              │
│                         sync/engine.js  (push ▸ pull)          │
│ Service worker (Workbox): caches the app shell for offline     │
└────────────────────────────────────────────────────────────────┘
                                │  HTTPS  /api  (JWT)
                                ▼
┌──────────────────────────── Server ────────────────────────────┐
│ Node.js + Express 5                                            │
│   routes ► middleware (auth, validate, rate-limit)             │
│     ► controllers ► services (records, sync, auth, dashboard)  │
│                           │                                    │
│                           ▼                                    │
│                  Prisma ORM ──► PostgreSQL                     │
└────────────────────────────────────────────────────────────────┘

shared/  ← pure money & finance functions used by BOTH sides
```

The key difference from a normal CRUD app: **the client has its own database.**
Screens never wait for the network. They read IndexedDB through live queries,
and writes go to IndexedDB first. The sync engine reconciles with the server in
the background. See [SYNC.md](SYNC.md).

## Repository layout

```
spendwise/
├── shared/            Pure JS used by frontend AND backend
│   └── src/           money.js · dates.js · finance.js · constants.js
├── backend/
│   ├── prisma/        schema.prisma · migrations/ · seed.js (demo account)
│   ├── src/
│   │   ├── server.js      process entry: listen, housekeeping, shutdown
│   │   ├── app.js         Express app: headers, CORS, limits, routes, PWA
│   │   ├── config.js      environment configuration
│   │   ├── routes/        URL → controller mapping
│   │   ├── controllers/   HTTP layer (thin)
│   │   ├── services/      records (CRUD+ownership+conflicts), sync, auth…
│   │   ├── middleware/    requireAuth, validate (Zod), rate limit, errors
│   │   ├── validators/    Zod schemas for every request
│   │   └── utils/         errors, serialization, id checks
│   └── test/          Vitest + Supertest API tests (real PostgreSQL)
├── frontend/
│   ├── public/        icons, favicon, theme bootstrap, install screenshots
│   ├── src/
│   │   ├── App.jsx        routes + auth guard
│   │   ├── pages/         Dashboard, AddEntry, Transactions, People, …
│   │   ├── layouts/       AppLayout (bottom nav / desktop sidebar)
│   │   ├── components/    UI kit, forms, rows, charts, sheets, sync badge
│   │   ├── hooks/         useData, useFinance (live queries), session…
│   │   ├── db/            db.js (Dexie schema) · repo.js (writes+outbox)
│   │   ├── sync/          engine.js (push/pull, retries, conflicts)
│   │   ├── services/      api.js (Axios + token refresh), session, auth
│   │   └── utils/         formatting, navigation helpers
│   └── test/          Vitest + fake-indexeddb tests of the offline engine
├── e2e/               run.mjs (end-to-end) · screenshots.mjs
├── docs/              this documentation + PDF
├── Dockerfile, docker-compose.yml
└── package.json       npm workspaces: shared, backend, frontend
```

## Technology choices

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React 19 + Vite | Fast dev server, small production bundle |
| Styling | Tailwind CSS 4 | Mobile-first utility classes, dark mode via `.dark` class |
| Routing | React Router 7 | Client-side navigation, deep links work offline |
| HTTP | Axios | Interceptors for the token-refresh flow |
| Charts | Recharts | Donut + bar charts; lazy-loaded with the Insights page |
| Local DB | IndexedDB via Dexie 4 | Transactions across tables, indexes, `useLiveQuery` for reactive screens |
| PWA | vite-plugin-pwa (Workbox) | Precached app shell, update prompt, web manifest |
| API | Node.js + Express 5 | Async error handling built in |
| Validation | Zod 4 | One schema per request, used by REST **and** sync |
| Auth | JWT (15 min) + rotating refresh tokens (30 days), bcrypt | Works for an app that is offline for days |
| DB | PostgreSQL + Prisma 6 | Relational integrity, migrations, typed queries |

## Data model

```
User ─┬─ Category        (income/expense, icon, colour; 16 defaults per user)
      ├─ Transaction     (income|expense, amount, category?, date, description, method, note)
      ├─ Person
      │    └─ Loan       (lent|borrowed, amount, date, due date?, note)
      │         └─ Repayment (amount, date, note)
      ├─ RefreshToken    (hashed, expiry, revoked)
      └─ SyncOperation   (processed opIds — idempotency log)
```

Every financial table has `id` (client UUID), `clientUpdatedAt`, `updatedAt`
(server), `deletedAt` (tombstone) and an index on `(userId, updatedAt)` for
fast pulls. Loan status/outstanding are **computed**, never stored, so they can
never disagree with the repayments.

## Money

Amounts are integers in minor units (paisa/cents) end-to-end: input
`"1,250.50"` → `125050` (`toMinor`), stored as `BIGINT`, displayed with
`Intl.NumberFormat` (lakh grouping for NPR/INR: Rs 1,00,000). No floating-point
arithmetic touches money.

## Balance definitions

- **Balance** (cash you have) = income − expenses − money lent + money borrowed + repayments received − repayments paid
- **Net worth** = balance + owed to you − you owe (= income − expenses)
- **Owed to you / You owe** = sum of outstanding amounts on open loans

Implemented once in `shared/src/finance.js` and used by the dashboard (offline,
on IndexedDB data) and by `/api/dashboard/*` (server).
