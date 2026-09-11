# Security

How each requirement from the project plan is implemented.

| Requirement | Implementation |
| --- | --- |
| Hash passwords; never store plain text | bcrypt (cost 12) via `bcryptjs`; only `passwordHash` is stored. Login compares against a dummy hash for unknown emails so response time doesn't reveal which emails exist. |
| Authenticate API requests | `requireAuth` middleware verifies a signed HS256 JWT (15-minute lifetime) on every non-auth route. |
| Authorize access to user-owned records | Every query is scoped by `userId`. Records of another user are reported as **404 Not found** (no information leak). References (category, person, loan) must belong to the same user. Tested in `records.test.js` and `sync.test.js`. |
| Validate amounts, dates, IDs and bodies on the server | Zod schemas for every request (`backend/src/validators/schemas.js`): integer positive amounts with a cap, real calendar dates, UUIDs, length limits, enums. Malformed ids never reach the database. |
| Never trust client-side validation alone | Sync ops go through the **same** schemas and business rules as the REST API (over-repayment, category type, due date ≥ loan date…). |
| Secrets in environment variables | `DATABASE_URL`, `JWT_SECRET` come from env; the server refuses to start in production with a missing/short/default `JWT_SECRET`. `.env` is git-ignored. |
| HTTPS in production | Required for PWA install anyway; helmet sends HSTS. Deployment guide covers hosts with automatic HTTPS. |
| Prevent access to other users' private records | See authorization row; the sync pull only ever returns the caller's rows. |
| Rate-limit sensitive auth endpoints | `/auth/login` and `/auth/register`: 20 requests / 15 min per IP; whole API: 600 / min. Set `TRUST_PROXY` behind a load balancer. |
| Don't send unnecessary data to third-party AI | V1 has no AI integration — no financial data leaves your server. |
| Plan data deletion/export | Deleting an account cascades all its rows (`onDelete: Cascade`); a user-facing export/delete flow is planned for V2. |

## Tokens and sessions

- **Access token**: JWT, 15 min, sent as `Authorization: Bearer`.
- **Refresh token**: 48 random bytes, 30 days, stored **only as a SHA-256 hash**,
  **single-use** (rotated on every refresh with an atomic conditional update, so
  two concurrent refreshes can't both succeed), revoked on logout, pruned daily.
- The PWA keeps tokens in `localStorage` so it can open offline. Because of
  that, the page ships a strict Content-Security-Policy (`script-src 'self'`,
  no inline scripts, `connect-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'self'`) to make XSS token theft much harder.

## Other hardening

- `helmet` security headers; `x-powered-by` disabled.
- API responses are `Cache-Control: no-store`; the service worker never caches `/api`.
- JSON body limit 1 MB; sync batches limited to 200 ops.
- Soft deletes are final — a deleted record can't be resurrected through sync.
- Client clocks are clamped (max +5 min) so a device with a wrong clock can't win every conflict.
- Logging out deletes the account's IndexedDB database from the device.
- CORS is off by default (same-origin); enable only for your own frontend domain.

## Known limitations (V1)

- Tokens in `localStorage` (mitigated by CSP) rather than httpOnly cookies — a
  deliberate trade-off for offline-first startup.
- No email verification / password reset yet (needs an email provider — V2/V5).
- Rate limiting uses in-memory counters; use a shared store (e.g. Redis) when
  running more than one server instance.
