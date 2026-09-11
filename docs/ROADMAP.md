# Roadmap

V1 (this release) is the **personal finance MVP**. The codebase was shaped so
the next versions slot in without rewrites.

## ✅ V1 — Personal Finance MVP (done)

Authentication · income & expense tracking · categories · people · lending &
borrowing · repayments · dashboard · basic analytics · mobile-first UI · PWA
installability · offline creation & local persistence · cloud synchronization.

Definition of done met: implementation exists, happy paths and invalid input
are tested, offline behaviour is covered, user isolation is tested, the UI is
integrated, and documentation is written.

## V2 — Smart Finance (next)

| Feature | Where it plugs in |
| --- | --- |
| Budgets per category/month | New `Budget` model + entity config in `records.service.js`; progress bars on the dashboard from `categoryBreakdown` |
| Savings goals & contributions | `SavingsGoal` / `Contribution` models, same sync pattern as loans/repayments |
| Recurring transactions | A `Recurrence` rule on transactions; materialise due items locally on app open |
| Custom date ranges & advanced filters | Transactions page already has search/type/month — add range & category filters |
| CSV / JSON export & import | Client-side from IndexedDB (works offline) |
| Notifications & reminders (due loans) | Web Push via the existing service worker |
| Field-level conflict merge | Replace whole-record last-write-wins in `upsertRecord` |

## V3 — AI Finance Assistant

Natural-language entry ("lunch 250 yesterday"), category suggestions, spending
summaries, "ask your data" questions, unusual-spending alerts. Keep the
principle *AI-assisted, not AI-dependent*: send only the minimum aggregated data
to the model, keep an offline rule-based parser as fallback.

## V4 — Connected money between users

Friend invitations, loan requests that the other person accepts/declines,
shared loan status & repayment history. Needs a `LoanShare` relationship with
explicit permissions — the current ownership checks in `records.service.js`
are the place to extend.

## V5 — Product / SaaS

Onboarding, subscription tiers, multi-device management, support, product
analytics, email verification & password reset, Redis-backed rate limiting,
horizontal scaling, terms/privacy/security pages, account export & deletion.

## Ideas backlog

Multiple wallets (cash / bank / eSewa-Khalti balances) · receipt OCR · currency
conversion · family/shared budgets · PDF/CSV reports · bank statement import ·
forecasting · group expenses & settlements · Play Store listing via Trusted Web
Activity (Bubblewrap).
