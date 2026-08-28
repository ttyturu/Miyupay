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
Run `backend/src/models/schema.sql` against the chosen database — via Supabase's SQL Editor, `psql`, or a GUI client like DBeaver. This creates all tables, indexes, seed exchange-rate data, and one reserved system row: `users`, `wallets` (including the clearing account's SGD wallet), `transactions`, `topups`, `ledger_entries`, `audit_log`, `fraud_checks`, `exchange_rates`.

There is no migration tool in this repo. If `schema.sql` changes after a database has already been created, the new `ALTER TABLE` / `CREATE TABLE ... IF NOT EXISTS` statements need to be run against that database manually — deploying new backend code does not update the schema automatically. For a database created before the clearing-account/top-up-fraud work, run:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS risk_score INT NOT NULL DEFAULT 0;

ALTER TABLE topups ADD COLUMN IF NOT EXISTS fraud_flagged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE topups ADD COLUMN IF NOT EXISTS fraud_reason TEXT;
ALTER TABLE topups ADD COLUMN IF NOT EXISTS risk_score INT NOT NULL DEFAULT 0;

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_balance_check;
ALTER TABLE wallets ADD CONSTRAINT wallets_balance_check CHECK (balance >= 0 OR is_system);

ALTER TABLE ledger_entries ALTER COLUMN transaction_id DROP NOT NULL;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS topup_id UUID REFERENCES topups(id);
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_ref_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_ref_check
  CHECK ((transaction_id IS NOT NULL) <> (topup_id IS NOT NULL));

INSERT INTO users (id, email, password_hash, full_name, role, is_verified) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system.clearing@miyupay.internal',
   '$2a$12$DuxRLhp6/YnkLJqPmtgMu.9tj/iTacYD/3wCC0t8IrtK7CREhaDCW',
   'MiyuPay Clearing (Stripe)', 'user', TRUE)
ON CONFLICT (id) DO NOTHING;
INSERT INTO wallets (user_id, currency, balance, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'SGD', 0, TRUE)
ON CONFLICT (user_id, currency) DO NOTHING;
```

(This is the same migration `backend/src/tests/globalSetup.js` applies automatically to the local dev database — running the test suite once locally does this for you; a deployed database needs it run by hand.)

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
- `STRIPE_WEBHOOK_SECRET` — optional; see [Stripe webhooks](#stripe-webhooks-optional) below. Without it the webhook endpoint returns 503 and top-ups are confirmed only by the browser redirect.
- `GROQ_API_KEY` — optional; free-tier key from console.groq.com. Powers the AI transaction summary on the admin panel. Without it, that endpoint returns a "not configured" message instead of erroring.

A successful start logs `MiyuPay backend running on port 3001` and `Database connected`.

### Stripe webhooks (optional)

Top-ups are confirmed two ways: the browser hitting `/topup/success` after Stripe redirects back, and a webhook Stripe sends directly to the server. The webhook is what makes crediting survive a customer closing the tab right after paying — without it, Stripe has the money and the wallet is never credited. Both paths are idempotent, so running with or without it is safe.

To enable locally, install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then in a separate terminal:

```bash
stripe login
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

It prints a `whsec_...` signing secret — paste that into `backend/.env` as `STRIPE_WEBHOOK_SECRET` and restart the backend. Leave `stripe listen` running while you test.

To verify it works, start a top-up, pay with test card `4242 4242 4242 4242`, and **close the tab immediately** before the redirect completes. The balance still updates, because the webhook credited it independently of the browser.

In production, create an endpoint at [dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks) pointing at `https://<your-backend>/api/webhooks/stripe`, subscribe it to `checkout.session.completed` and `checkout.session.expired`, and copy that endpoint's signing secret instead.

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

## 5. Demo data and admin access

```bash
cd backend
npm run seed
```

Populates 11 demo accounts (`demo1@miyupay.dev` … `demo11@miyupay.dev`, password `DemoPass123!`) with deliberately varied activity — clean transfers, large amounts, cross-border transfers, high frequency, structuring, the new-recipient + unusual-hour combo, a rapid top-up flagged by `TOPUP_VELOCITY`, a pending (abandoned) top-up — visible in the admin panel but deliberately hidden from the user's own history, since no money ever moved — and one person with flags from both fraud engines to demonstrate the aggregate risk score. Completed top-ups post real ledger entries against the clearing wallet, same as a live top-up would. Safe to re-run; it exits early if the demo data already exists. Reads whichever `DATABASE_URL` is active in `.env`, so pointing it at a Supabase connection string seeds the deployed database instead of the local one (the clearing account must already exist there — see the migration SQL in step 2 — before running the seed script against a deployed database).

There's no self-serve way to become an admin — it's granted with a direct database update:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

---

## 6. Tests

`backend/src/tests/` contains:
- **auth.test.ts** — register, verify-email, login, forgot-password/reset-password, duplicate email, wrong password, missing fields, self-freeze
- **transactions.test.ts** — send money, insufficient balance, self-transfer, unknown recipient, the fraud-rule combinations (large amount, large cross-border, structuring, new-recipient + unusual-hour block, and that neither condition blocks alone), risk-score values, that a frozen account can't send, and a concurrency test firing three structuring-eligible sends at once to prove the sender-row lock still catches it
- **topupFraud.test.ts** — TOPUP_VELOCITY unit tests against `runTopupFraudChecks` directly (no Stripe involved)
- **topupConcurrency.test.ts** — fires the atomic top-up claim statement twice at once and asserts only one succeeds (see [Concurrency safety](../README.md#concurrency-safety))
- **admin.test.ts** — access control (non-admin rejected), user search/lookup, aggregate risk score, flagged-list sorting (transfers + top-ups merged), freeze/unfreeze (including the wrong-password case), ledger/fraud-check drill-down for both a transfer and a top-up, AI summary endpoint

```bash
cd backend
npm test              # run all tests
npm run test:coverage # with coverage report
```

Tests run against the same database as local development (no dedicated test database — no CREATEDB privilege assumed). Test data is namespaced under the `@test.miyupay.dev` email domain and removed automatically after each run (`src/tests/globalSetup.js` / `globalTeardown.js`). `globalSetup.js` also applies any schema changes added after the database was first created.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and build for both `backend` and `frontend` on every push/PR to `main`, using a fresh Postgres container.

---

## 7. Linting and type checking

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

Available in both `backend/` and `frontend/`.

---

## 8. Docker (optional)

```bash
docker-compose up --build
```

Starts PostgreSQL and the backend in containers. `GET http://localhost:3001/api/health` confirms it's running.

---

## 9. Deployment

Current live stack:

### Database → Supabase
- Postgres connection string from Project Settings → Database
- Schema applied via Supabase's SQL Editor (see step 2)

### Backend → Render
- Web Service connected to this GitHub repo, root directory `backend`
- Builds from the existing `Dockerfile`
- Environment variables (from `backend/.env.example`): `DATABASE_URL` (Supabase), `JWT_SECRET`, `FRONTEND_URL` (the Vercel URL, not `localhost` — otherwise CORS blocks the frontend), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (optional — from a webhook endpoint pointing at `https://<render-url>/api/webhooks/stripe`, not the CLI secret), `GROQ_API_KEY` (optional), `NODE_ENV=production`

### Frontend → Vercel
- Root directory `frontend`, build command `npm run build`, output directory `dist`
- Environment variable `VITE_API_URL` = the Render backend URL
- `frontend/vercel.json` (already in the repo) provides the SPA rewrite rule required for client-side routes like `/login` to load on direct visit/refresh — without it, Vercel 404s on any path besides `/`

Live at: https://miyupay.vercel.app
