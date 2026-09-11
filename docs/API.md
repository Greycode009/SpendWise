# SpendWise REST API

Base URL: `/api` (same origin as the app, or `VITE_API_URL` when hosted separately).

- All request and response bodies are JSON.
- **Amounts are integers in minor units** (paisa / cents): Rs 1,250.50 → `125050`.
- **Dates** are calendar dates `YYYY-MM-DD`; timestamps are ISO-8601 strings.
- Every endpoint except `/health` and `/auth/register|login|refresh|logout` needs
  `Authorization: Bearer <accessToken>`.
- Record ids are UUIDs. Clients may supply their own id when creating a record
  (this is how offline-created records keep their identity).

## Errors

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "amount: must be greater than zero", "details": [{ "path": "amount", "message": "must be greater than zero" }] } }
```

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body/query failed validation or a business rule (e.g. over-repayment) |
| 401 | `UNAUTHORIZED` / `INVALID_TOKEN` | Missing or invalid access token |
| 401 | `TOKEN_EXPIRED` | Access token expired → call `/auth/refresh` |
| 401 | `SESSION_EXPIRED` | Refresh token invalid/used/expired → log in again |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 404 | `NOT_FOUND` | Record does not exist **or belongs to another user** |
| 409 | `EMAIL_TAKEN` / `CONFLICT` / `STALE` | Duplicate email, duplicate id, or a newer version exists |
| 422 | `INVALID_REFERENCE` | Referenced category/person/loan is missing, deleted, not yours, or wrong type |
| 429 | `RATE_LIMITED` | Too many requests |

## Auth

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password (≥8), currency? }` | `201 { user, accessToken, refreshToken }` — also creates 16 default categories |
| POST | `/auth/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | `{ refreshToken }` | New `{ user, accessToken, refreshToken }`; the old refresh token stops working (rotation) |
| POST | `/auth/logout` | `{ refreshToken }` | `204` — refresh token revoked |
| GET | `/auth/me` | — | `{ user }` |
| PATCH | `/auth/me` | `{ name?, currency? }` | `{ user }` |

Access tokens live 15 minutes, refresh tokens 30 days (configurable). Login and
register are rate-limited to 20 requests per 15 minutes per IP.

## Categories · People · Transactions · Loans

Each resource supports the same five operations:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/{resource}` | List (deleted records excluded) |
| POST | `/{resource}` | Create; optional client `id` |
| GET | `/{resource}/:id` | One record |
| PATCH | `/{resource}/:id` | Partial update (merged, then fully re-validated) |
| DELETE | `/{resource}/:id` | Soft delete → `204` (idempotent) |

Resources: `categories`, `people`, `transactions`, `loans`.

### Record shapes

```jsonc
// Category
{ "id": "uuid", "name": "Food & Dining", "type": "expense", "icon": "🍜", "color": "#f97316", "isDefault": true }

// Transaction
{ "id": "uuid", "type": "expense", "amount": 25050, "categoryId": "uuid|null", "date": "2026-09-11",
  "description": "Lunch", "paymentMethod": "cash|card|bank|wallet|other|null", "note": null }

// Person
{ "id": "uuid", "name": "Aarav Sharma", "phone": "98…", "note": null }

// Loan  (GET responses add repaid, outstanding, status, progress)
{ "id": "uuid", "personId": "uuid", "direction": "lent|borrowed", "amount": 500000,
  "date": "2026-09-01", "dueDate": "2026-10-01|null", "note": null,
  "repaid": 200000, "outstanding": 300000, "status": "open|partial|overdue|settled", "progress": 0.4 }

// Repayment
{ "id": "uuid", "loanId": "uuid", "amount": 200000, "date": "2026-09-05", "note": null }
```

Every record also carries `createdAt`, `updatedAt`, `clientUpdatedAt`, `deletedAt`.

### Transaction filters

`GET /transactions?type=expense&from=2026-09-01&to=2026-09-30&categoryId=…&q=coffee&limit=200&offset=0`

### Business rules enforced by the server

- A transaction's category must be the same type (an expense can't use "Salary").
- Loan due date can't be before the loan date.
- A repayment can't exceed the loan's outstanding amount.
- A loan's amount can't be reduced below what has already been repaid.
- Deleting a person deletes their loans and repayments; deleting a loan deletes its repayments.
- Deleted categories stay referenced by old transactions (shown as uncategorized).

## Repayments

| Method | Path |
| --- | --- |
| GET | `/loans/:id/repayments` |
| POST | `/loans/:id/repayments` — `{ amount, date, note? }` |
| GET / PATCH / DELETE | `/repayments/:id` |

## Dashboard

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/dashboard/summary?month=YYYY-MM` | `balance, netWorth, totalIncome, totalExpense, periodIncome, periodExpense, periodNet, savingsRate, owedToMe, iOwe, recent[]` |
| GET | `/dashboard/analytics?month=YYYY-MM&months=6` | `monthly[] (income/expense per month), expenseByCategory[], incomeByCategory[]` |

`balance` = income − expenses − money lent + money borrowed + repayments received − repayments paid (cash you actually have).
`netWorth` = balance + owedToMe − iOwe.

## Sync (used by the offline app)

### `POST /sync/push`

```json
{ "ops": [
  { "opId": "uuid", "entity": "transactions", "action": "upsert", "recordId": "uuid",
    "data": { "type": "expense", "amount": 25000, "date": "2026-09-11" },
    "clientUpdatedAt": "2026-09-11T08:15:00.000Z" },
  { "opId": "uuid", "entity": "people", "action": "delete", "recordId": "uuid",
    "clientUpdatedAt": "2026-09-11T08:16:00.000Z" }
] }
```

Up to 200 ops, applied in order. Response:

```json
{ "serverTime": "…", "results": [
  { "opId": "…", "status": "applied", "record": { … } },
  { "opId": "…", "status": "stale", "reason": "newer-version-exists", "record": { …server copy… } },
  { "opId": "…", "status": "rejected", "error": "Repayment exceeds the outstanding amount of 3000" },
  { "opId": "…", "status": "applied", "duplicate": true }
] }
```

### `GET /sync/pull?since=<serverTime>`

Without `since`: full snapshot of non-deleted records. With `since`: every record
changed after it (a 30-second overlap is included), **including deletions**
(`deletedAt` set). Response: `{ serverTime, full, changes: { categories, people, transactions, loans, repayments } }`.

See [SYNC.md](SYNC.md) for the full protocol and conflict rules.

## Health

`GET /health` → `{ "status": "ok", "time": "…" }`
