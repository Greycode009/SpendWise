# Running & deploying SpendWise

## 1. Local development

Requirements: **Node.js 22.9+ (24 LTS works)** and **PostgreSQL 14+** (16 recommended).

```bash
# 1. install everything (npm workspaces)
npm install

# 2. create a database and configure the API
createdb spendwise                      # or use Docker: docker compose up -d db
cp backend/.env.example backend/.env    # edit DATABASE_URL and JWT_SECRET

# 3. create the tables
npm run db:migrate

# 4. (optional) load a demo account with 3 months of data
npm run db:seed                         # → demo@spendwise.app / demo1234

# 5. start API (:4000) and web app (:5173) together
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the API on port 4000.

> The service worker is only active in production builds. To test offline mode
> and installation locally: `npm run build && npm start`, then open
> http://localhost:4000.

### On Windows (PowerShell)

1. Install **Node.js 22+** (you have it if `node -v` works) and **PostgreSQL 16**
   from postgresql.org (remember the password you set for the `postgres` user) —
   or install Docker Desktop and run `docker compose up -d db` instead.
2. Create the database (PostgreSQL installer route): open *SQL Shell (psql)* and run
   `CREATE DATABASE spendwise;`
3. In the project folder:

```powershell
npm install
Copy-Item backend\.env.example backend\.env
notepad backend\.env      # set DATABASE_URL, e.g. postgresql://postgres:YOURPASSWORD@localhost:5432/spendwise
npm run db:migrate
npm run db:seed           # optional demo data
npm run dev               # http://localhost:5173
```

### Running the tests locally

The API tests need a separate, throwaway database whose name contains `test`:

```bash
createdb spendwise_test                                  # or CREATE DATABASE spendwise_test;
cp backend/env.test.example backend/.env.test           # edit DATABASE_URL if needed
npm test                                                 # shared + backend + frontend
```

End-to-end browser test: `npm run build && npm start`, then in a second
terminal `npx playwright install chromium` (first time only) and `npm run test:e2e`.

## 2. Production build (one server)

```bash
npm ci
npm run build            # builds frontend/dist
npm run db:deploy        # apply migrations
NODE_ENV=production npm start
```

The Express server serves the API under `/api` **and** the built PWA from
`frontend/dist` on the same origin — no CORS needed, and cookies/tokens stay on
one domain.

### Required environment variables (backend)

| Variable | Example | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/spendwise` | Required |
| `JWT_SECRET` | 48+ random bytes | Required in production (≥ 32 chars). `openssl rand -base64 48` |
| `PORT` | `4000` | |
| `NODE_ENV` | `production` | |
| `TRUST_PROXY` | `1` | Set when behind a load balancer (Render, Railway, Fly, Nginx) so rate limiting sees real IPs |
| `CORS_ORIGIN` | `https://spendwise.example.com` | Only if the frontend is on another domain |
| `SERVE_CLIENT` | `true` | `false` if you deploy the frontend separately |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_DAYS` | `15m` / `30` | Optional |

## 3. Docker

```bash
JWT_SECRET=$(openssl rand -base64 48) docker compose up --build
```

Starts PostgreSQL and the app on http://localhost:4000. Migrations run
automatically on container start.

## 4. Hosting options

**Option A — one service (simplest).** Any Node host with a PostgreSQL
add-on: Render, Railway, Fly.io, a VPS.
- Build command: `npm ci && npm run build`
- Start command: `npm run db:deploy && npm start`
- Set `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `TRUST_PROXY=1`.
- Managed Postgres: Neon, Supabase, Render, Railway all work.

**Option B — split.** Frontend on Vercel/Netlify/Cloudflare Pages, API elsewhere.
- Frontend build: `npm ci && npm run build -w frontend`, output `frontend/dist`,
  env `VITE_API_URL=https://api.example.com/api`, and a SPA fallback rule
  (all routes → `/index.html`).
- API: `SERVE_CLIENT=false`, `CORS_ORIGIN=https://your-frontend.example.com`.

**HTTPS is required** for installation as an app and for service workers
(except on `localhost`). All the hosts above provide it automatically.

## 5. Installing on Android (PWA)

1. Open your SpendWise URL in **Chrome** on the phone.
2. Chrome shows an **Install app** banner — or open the ⋮ menu → **Install app**
   (older versions: **Add to Home screen**). SpendWise → Settings → *Install
   SpendWise* also triggers it.
3. SpendWise appears in the app drawer with its own icon, opens full-screen
   without the browser bar, and works offline.
4. Long-press the icon for the **Add expense / Add income** shortcuts.

Testing on a phone before deploying: the phone needs HTTPS, so expose your
local server with a tunnel, e.g. `npx cloudflared tunnel --url http://localhost:4000`
or `ngrok http 4000`, and open the https URL on the phone.

**Play Store (optional, later):** wrap the PWA in a Trusted Web Activity with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) — no code changes needed.

## 6. Installing on desktop & iPhone

- **Chrome / Edge (Windows, macOS, Linux):** install icon in the address bar, or menu → *Install SpendWise*.
- **Safari (iPhone/iPad):** Share → *Add to Home Screen*.
- Or simply use it in any modern browser — it's the same app.

## 7. Updating

Deploy a new build. Open apps download it in the background and show
"A new version of SpendWise is ready → Update", so nobody loses a half-typed entry.

## 8. Backups

All server data lives in PostgreSQL — use your host's automated backups or
`pg_dump`. Each device also holds a full local copy of its user's data.
