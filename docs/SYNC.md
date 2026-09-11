# Offline-first & sync design

SpendWise treats the phone as the primary copy of your data and the server as
the backup and the bridge between devices.

## 1. Local-first write

```
User taps Save
  → one IndexedDB transaction:
      • write the record (with _status = "pending")
      • append an op to the outbox
  → UI updates instantly (Dexie live queries)
  → sync engine is asked to run (debounced 400 ms)
      online  → push now
      offline → wait
```

Code: `frontend/src/db/repo.js` (`saveRecord`, `deleteRecord`).

- Records get a **client-generated UUID**, so an expense created offline keeps
  the same id forever — no id remapping after sync.
- Repeated edits of a record that has **not been sent yet** are merged into the
  one waiting op. An op that was already attempted is never merged (the server
  may have applied it even though the phone never saw the reply).
- Deletes cascade locally exactly like on the server (person → loans → repayments).

## 2. The outbox (sync queue)

Table `outbox` in IndexedDB, one row per change:

| field | meaning |
| --- | --- |
| `seq` | auto-increment — defines the order ops are sent in |
| `opId` | UUID — the idempotency key |
| `entity`, `action`, `recordId`, `data` | what to do |
| `clientUpdatedAt` | when the user made the change (for conflict resolution) |
| `status` | `pending` → `syncing` → removed when synced · or `failed` |
| `attempts`, `nextAttemptAt`, `permanent`, `error` | retry bookkeeping |

### Sync states shown to the user

| State | Where you see it |
| --- | --- |
| **pending** — not yet on the server | cloud-upload icon on the item, "N pending" badge |
| **syncing** — being sent | spinning badge |
| **synced** — server accepted it | "Synced" badge, no icon on the item |
| **failed** — will be retried, or was rejected | "N failed" badge, details in *Settings → Sync status* |

## 3. Push

`frontend/src/sync/engine.js → push()`

1. Take outbox ops in `seq` order (max 100 per request). Skip ops that were
   permanently rejected; stop at an op that is still backing off (keeps order,
   so a repayment is never sent before its loan).
2. Mark them `syncing`, `POST /api/sync/push`.
3. For each result:
   - `applied` / `stale` → delete the op; if no newer local change is queued
     for that record, store the server's copy and mark it `synced`.
   - `rejected` → keep the op as **failed (permanent)** with the server's
     message; the record is marked failed. The user can *Discard* it.
   - `error` (server hiccup) → failed, retried with backoff; after 8 server
     errors it becomes permanent.
4. If the whole request fails (no network, 5xx, timeout) every op in the batch
   becomes `failed` with **exponential backoff**: 2 s, 4 s, 8 s … max 5 min.
   Network failures never count toward the permanent limit.

## 4. Pull

`GET /api/sync/pull?since=<cursor>` returns everything changed on the server
since the last pull — including **tombstones** (`deletedAt`) so deletions reach
every device. The cursor is the *server's* clock (never the phone's).

Merging rules (`applyPulled`):
- A record that still has a queued local change is **not overwritten** —
  the local edit wins until it is pushed; the server then decides.
- Tombstones delete the local copy.
- A *full* pull (first login on a device, or after discarding a failed change)
  also removes local records the server doesn't have (unless queued).

The server re-sends a 30-second overlap window on every pull, so a write that
was still committing during the previous pull is never missed.

## 5. When does sync run?

- right after every local change (debounced),
- on app start,
- when the browser fires `online`,
- when the app comes back to the foreground,
- every 60 s while visible,
- when the user taps **Sync now**.

Only one sync runs at a time; calls during a run schedule exactly one more.

## 6. Duplicate-sync protection

The server stores every processed `opId` (table `SyncOperation`, primary key
`(userId, opId)`) together with its result. If an op arrives again —
because the response was lost, the app was killed mid-sync (ops stuck in
`syncing` are reset to `pending` on the next start), or two tabs raced — the
server returns the original result with `duplicate: true` and applies nothing.
A repayment re-sent three times is counted once. Tested in
`backend/test/sync.test.js` and `frontend/test/sync.test.js`.

## 7. Conflict rules (multi-device)

Deterministic, never silent:

1. **Ownership first.** A record id belongs to one user. Ops touching another
   user's record are rejected as "not found" (no information leak).
2. **Deletes are final.** Once deleted (tombstoned), later edits for that record
   are ignored (`stale`, reason `deleted`) — nothing is resurrected.
3. **Last write wins by `clientUpdatedAt`.** If the server already holds a
   version edited later than the incoming one, the incoming edit is ignored
   (`stale`, reason `newer-version-exists`) and the server copy is returned so
   the device converges.
4. **Business rules still apply.** A repayment for a loan deleted on another
   device, or one that would exceed the outstanding amount, is `rejected`.

Client clocks set far in the future are clamped to server time + 5 minutes so a
wrong clock can't make a device's edits win forever.

Known V1 limits: whole-record last-write-wins (no field-level merge); clock
skew within 5 minutes can still decide close races; pull returns all changes in
one response (fine for personal-scale data).

## 8. Sessions while offline

The app opens without a network using the saved session. If the refresh token
is rejected when the device reconnects (expired after 30 days, or revoked), the
session is marked *expired*: **local data and queued changes are kept**, a
banner asks the user to sign in again, and syncing resumes after sign-in.
Logging out deletes that account's local database (after warning if there are
unsynced changes).
