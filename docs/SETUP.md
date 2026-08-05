# MiyuPay — Local Development & Deployment

Reference for running MiyuPay locally and understanding how the live deployment is configured.

---

## Prerequisites

- Node.js 20+
- Git
- Docker Desktop (optional — only needed for the docker-compose local Postgres option)

---

## 1. Clone the repository

```bash
git clone https://github.com/ttyturu/Miyupay.git
cd Miyupay
```

---

## 2. Database

One of the following is required. Supabase is what the live deployment uses.

### Option A — Supabase
- Create a project at supabase.com
- Project Settings → Database → copy the connection string as `DATABASE_URL`

### Option B — Railway
- Create a project at railway.app → Add PostgreSQL
- PostgreSQL service → Connect tab → copy `DATABASE_URL`

### Option C — Local PostgreSQL
- Install PostgreSQL
- `psql -U postgres`
- `CREATE DATABASE miyupay;`
- `DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/miyupay`

### Applying the schema
Run `backend/src/models/schema.sql` against the chosen database — via Supabase's SQL Editor, `psql`, or a GUI client like DBeaver. This creates all tables, indexes, and seed exchange-rate data: `users`, `wallets`, `transactions`, `ledger_entries`, `audit_log`, `fraud_checks`, `exchange_rates`, `topups`.

There is no migration tool in this repo. If `schema.sql` changes after a database has already been created, the new `ALTER TABLE` / `CREATE TABLE ... IF NOT EXISTS` statements need to be run against that database manually — deploying new backend code does not update the schema automatically.

---

## 3. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

`.env` values:
- `DATABASE_URL` — from step 2
- `JWT_SECRET` — any long random string, e.g. `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `STRIPE_SECRET_KEY` — optional; test-mode key from a Stripe account. The "Add credit" flow returns an error until this is set, everything else works without it.

A successful start logs `MiyuPay backend running on port 3001` and `Database connected`.

---

## 4. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Opens at http://localhost:5173. `VITE_API_URL` points to the backend from step 3; `VITE_STRIPE_PUBLISHABLE_KEY` is optional.

---

## 5. Tests

`backend/src/tests/` contains:
- **auth.test.ts** — register, verify-email, login, forgot-password/reset-password, duplicate email, wrong password, missing fields
- **transactions.test.ts** — send money, insufficient balance, self-transfer, unknown recipient, and the fraud-rule combinations (large amount, large cross-border, new-recipient + unusual-hour block, and that neither condition blocks alone)

```bash
cd backend
npm test              # run all tests
npm run test:coverage # with coverage report
```

Tests run against the same database as local development (no dedicated test database — no CREATEDB privilege assumed). Test data is namespaced under the `@test.miyupay.dev` email domain and removed automatically after each run (`src/tests/globalSetup.js` / `globalTeardown.js`). `globalSetup.js` also applies any schema changes added after the database was first created.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and build for both `backend` and `frontend` on every push/PR to `main`, using a fresh Postgres container.

---

## 6. Linting and type checking

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

Available in both `backend/` and `frontend/`.

---

## 7. Docker (optional)

```bash
docker-compose up --build
```

Starts PostgreSQL and the backend in containers. `GET http://localhost:3001/api/health` confirms it's running.

---

## 8. Deployment

Current live stack:

### Database → Supabase
- Postgres connection string from Project Settings → Database
- Schema applied via Supabase's SQL Editor (see step 2)

### Backend → Render
- Web Service connected to this GitHub repo, root directory `backend`
- Builds from the existing `Dockerfile`
- Environment variables (from `backend/.env.example`): `DATABASE_URL` (Supabase), `JWT_SECRET`, `FRONTEND_URL` (the Vercel URL, not `localhost` — otherwise CORS blocks the frontend), `STRIPE_SECRET_KEY`, `NODE_ENV=production`

### Frontend → Vercel
- Root directory `frontend`, build command `npm run build`, output directory `dist`
- Environment variable `VITE_API_URL` = the Render backend URL
- `frontend/vercel.json` (already in the repo) provides the SPA rewrite rule required for client-side routes like `/login` to load on direct visit/refresh — without it, Vercel 404s on any path besides `/`

Live at: https://miyupay.vercel.app
