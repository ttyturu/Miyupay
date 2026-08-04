# MiyuPay — Setup & Build Checklist

This is your single source of truth for what needs to be done.
Work through it top to bottom. Tick things off as you go.
Each section has a clear goal — don't move to the next until the current one is done.

---

## Before you start — install these once

- [ ] Node.js 20+ — https://nodejs.org
- [ ] Git — https://git-scm.com
- [ ] VS Code — https://code.visualstudio.com
- [ ] Postman — https://postman.com (for testing APIs)
- [ ] Docker Desktop — https://docker.com/products/docker-desktop (optional but useful)

VS Code extensions worth installing:
- ESLint
- Prettier
- Thunder Client (lightweight Postman alternative)
- GitLens

---

## Step 1 — Create your GitHub repo

- [ ] Go to github.com → New repository → name it `miyupay`
- [ ] Set it to Public (employers look at this)
- [ ] Clone it: `git clone https://github.com/YOUR_USERNAME/miyupay.git`
- [ ] Copy all project files into the cloned folder
- [ ] `git add . && git commit -m "feat: initial project scaffold" && git push`

**From this point: commit every day. Even a 1-line change.**
Good commit message format: `feat: add fraud detection rule for large amounts`
Bad: `update files`

---

## Step 2 — Set up the database

Pick one option. Railway is easier.

### Option A — Railway (recommended)
- [ ] Go to railway.app → sign up (free)
- [ ] New Project → Add PostgreSQL
- [ ] Click the PostgreSQL service → Connect tab
- [ ] Copy the `DATABASE_URL` (looks like `postgresql://user:pass@host:port/db`)
- [ ] Done — no local install needed

### Option B — Local PostgreSQL
- [ ] Download and install PostgreSQL from postgresql.org/download
- [ ] Open a terminal and run: `psql -U postgres`
- [ ] Run: `CREATE DATABASE miyupay;`
- [ ] Exit psql: `\q`
- [ ] Your DATABASE_URL: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/miyupay`

### Run the schema (both options)
- [ ] Open Postman or DBeaver (free DB GUI)
- [ ] Connect using your DATABASE_URL
- [ ] Open `backend/src/models/schema.sql`
- [ ] Run the entire file — all tables, indexes, and seed data will be created
- [ ] Verify: you should see tables — users, wallets, transactions, ledger_entries, audit_log, fraud_checks, exchange_rates, topups

---

## Step 3 — Configure the backend

- [ ] `cd backend`
- [ ] `cp .env.example .env`
- [ ] Open `.env` and fill in:
  - `DATABASE_URL` — from Step 2
  - `JWT_SECRET` — run this to generate one:
    ```
    node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
    ```
  - Leave other values as default for now
- [ ] Install dependencies: `npm install`
- [ ] Start the backend: `npm run dev`
- [ ] You should see: `MiyuPay backend running on port 3001` and `Database connected`

### Test it works
Open Postman and test these — all should return responses:

- [ ] `GET http://localhost:3001/api/health` → `{"status":"ok"}`
- [ ] `POST http://localhost:3001/api/auth/register` with body:
  ```json
  {
    "email": "alice@test.com",
    "password": "password123",
    "fullName": "Alice Tan",
    "country": "SGP"
  }
  ```
  → Should return a `user` object and a `verificationCode` (no token yet — email isn't verified)
- [ ] `POST http://localhost:3001/api/auth/verify-email` with `{ "email": "alice@test.com", "code": "<verificationCode from above>" }` → token returned
- [ ] `POST http://localhost:3001/api/auth/login` with same email/password → token returned
- [ ] Copy the token. `GET http://localhost:3001/api/wallet` with header `Authorization: Bearer YOUR_TOKEN` → 3 wallets returned (SGD 1000, MYR 3000, THB 25000)

**Backend is working. Commit: `feat: backend auth and wallet endpoints working`**

---

## Step 4 — Send a transaction end to end

- [ ] Register a second user (bob@test.com) using Postman
- [ ] Log in as alice@test.com, copy her token
- [ ] `POST http://localhost:3001/api/transactions/send` with alice's token:
  ```json
  {
    "receiverEmail": "bob@test.com",
    "senderCurrency": "SGD",
    "receiverCurrency": "MYR",
    "amount": 100,
    "note": "Test cross-border transfer"
  }
  ```
  → Should return `{ transaction: {...}, flagged: false, message: "Payment sent successfully." }`
- [ ] Check alice's SGD wallet — should be 900
- [ ] Check bob's MYR wallet — should be 345 (100 × 3.45 exchange rate)
- [ ] `GET http://localhost:3001/api/audit/ledger/TRANSACTION_ID` — should show DEBIT and CREDIT entries
- [ ] `GET http://localhost:3001/api/audit/fraud/TRANSACTION_ID` — shows which rules fired

**Core financial logic is working. Commit: `feat: double-entry ledger and fraud detection working`**

---

## Step 5 — Test fraud detection

- [ ] Send a transaction over SGD 5,000 — should come back `flagged: true`
- [ ] Check alice's wallet — balance should NOT have changed (flagged = no money moved)
- [ ] Send 5 transactions quickly in a row — 6th should trigger HIGH_FREQUENCY rule
- [ ] `GET /api/audit/fraud/TRANSACTION_ID` — shows exactly which rules triggered and why

**Fraud detection is working. Commit: `test: fraud detection rules verified`**

---

## Step 6 — Set up the frontend

- [ ] Open a new terminal (keep backend running)
- [ ] `cd frontend`
- [ ] `npm install`
- [ ] `cp .env.example .env` — fills in `VITE_API_URL` (and `VITE_STRIPE_PUBLISHABLE_KEY`, optional)
- [ ] `npm run dev`
- [ ] Open http://localhost:5173 in your browser

### Build these pages in order:
- [ ] **LandingPage** — public marketing page at `/`, links to Login/Register
- [ ] **LoginPage** — form, submits to `/api/auth/login`, stores token in localStorage, redirects to dashboard
- [ ] **RegisterPage** — form, submits to `/api/auth/register`, then shows a verification-code popup (mocked — no real email sent) before logging in
- [ ] **ForgotPasswordPage** — email form → `/api/auth/forgot-password` → shows a mocked reset code popup with a new-password field → `/api/auth/reset-password`
- [ ] **Layout** — nav bar with links: Dashboard, Convert, Send, Transactions, Audit Trail, Sign out
- [ ] **DashboardPage** — fetches `/api/wallet`, shows 3 wallet cards with balances, plus an "Add credit" link to `/topup`
- [ ] **ConvertPage** — form: source/destination currency, amount. Calls `/api/wallet/convert`
- [ ] **SendPage** — form: recipient email, currencies, amount, note. Shows live exchange rate preview. On submit, calls `/api/transactions/send`
- [ ] **TransactionsPage** — fetches `/api/transactions`, lists all with reference code, status, amount
- [ ] **AuditPage** — fetches `/api/audit/log`, shows event history for all transactions
- [ ] **TopUpPage** / **TopUpSuccessPage** — Stripe Checkout (test mode) top-up flow

For each page: build it, test it manually in browser, commit before moving to next.

**Commit pattern:**
```
feat: add dashboard with wallet balance cards
feat: add send money form with exchange rate preview
feat: add transaction history page
feat: add audit trail page
```

---

## Step 7 — Connect TypeScript properly

The backend is already TypeScript. For the frontend:
- [ ] All new files should be `.tsx` (components) or `.ts` (utilities)
- [ ] Never use `any` — if you don't know the type, use the types defined in `src/types.ts`
- [ ] Run `npm run build` in the frontend — it will show TypeScript errors to fix
- [ ] Run `npm run build` in the backend — TypeScript compiles to `dist/`

**Goal: `npm run build` passes in both folders with zero errors.**

---

## Step 8 — Tests (already scaffolded)

`backend/src/tests/` already exists with:

- [x] **auth.test.ts** — register, verify-email, login, forgot-password/reset-password, duplicate email, wrong password, missing fields
- [x] **transactions.test.ts** — send money, insufficient balance, self-transfer, unknown recipient, and the fraud-rule combinations (large amount, large cross-border, new-recipient + unusual-hour block, and that neither condition blocks on its own)

Tests run against your local dev database rather than a separate test DB (no CREATEDB privilege assumed) — test data is namespaced under `@test.miyupay.dev` and cleaned up automatically after each run. See `src/tests/globalSetup.js` / `globalTeardown.js`.

Run: `npm run test:coverage`

If you add new features, add tests alongside them in this folder — `npm run test` already runs automatically in CI (`.github/workflows/ci.yml`) on every push/PR, so a broken test fails the build before it merges.

**Commit: `test: add fraud detection tests covering the new-recipient + unusual-hour combo rule`**

---

## Step 9 — Polish and error handling

- [ ] Every API error returns `{ error: string, code?: string }` shape consistently
- [ ] Every form shows field-level validation errors (not just browser native)
- [ ] Every async action has a loading state (spinner or disabled button)
- [ ] Empty states: no transactions yet, no audit entries yet
- [ ] Test on mobile: open Chrome DevTools → toggle device toolbar → iPhone SE size
- [ ] Fix anything that overflows or breaks on mobile

---

## Step 10 — Docker

- [ ] Make sure Docker Desktop is running
- [ ] From the project root: `docker-compose up --build`
- [ ] This starts both PostgreSQL and the backend in containers
- [ ] `GET http://localhost:3001/api/health` should still work
- [ ] If it works: you understand Docker. That's all you need to say in an interview.

**Commit: `feat: add Dockerfile and docker-compose for local development`**

---

## Step 11 — Deploy

### Frontend → Vercel
- [ ] Go to vercel.com → sign up with GitHub
- [ ] Import your `miyupay` repo
- [ ] Set root directory to `frontend`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Add environment variable: `VITE_API_URL` = your Railway backend URL
- [ ] Deploy → get a live URL

### Backend → Railway
- [ ] Go to railway.app → New Project → Deploy from GitHub repo
- [ ] Set root directory to `backend`
- [ ] Add all environment variables from `.env`
- [ ] Railway auto-detects Node.js and runs `npm start`
- [ ] Get the backend URL → copy it into Vercel's `VITE_API_URL`

- [ ] Test the live URL end to end: register → send money → check audit trail
- [ ] Add the live URL to your README and your LinkedIn

---

## Step 12 — README

Your README is the first thing an interviewer sees when they open your GitHub.

- [ ] Update `README.md` with:
  - Live URL link at the top
  - What the app does (2–3 sentences)
  - Architecture diagram (even a simple ASCII one is fine)
  - API endpoints table (method, path, description, auth required)
  - Setup instructions
  - **Design decisions section** — explain WHY you chose double-entry ledger, why rule-based fraud detection, why PostgreSQL. This is what separates you from someone who copied a tutorial.
  - Singapore fintech context — mention PayNow, MAS AML/CFT, Project Nexus

**This README is your portfolio. Spend a full day on it.**

---

## Git habits — do this every day

```bash
# Start of day
git pull

# After each meaningful change
git add .
git commit -m "feat: describe what you just built"

# Use branches for each feature
git checkout -b feat/send-money
# build the feature
git checkout main
git merge feat/send-money
git push
```

Employers look at:
1. How many commits (consistency)
2. What the commit messages say (communication)
3. Whether you used branches (engineering discipline)

---

## What you have when you're done

| Thing | What it shows |
|---|---|
| TypeScript backend | Modern engineering standards, type safety |
| PostgreSQL + double-entry ledger | Financial systems knowledge |
| Risk-combination fraud detection engine | AML/compliance awareness — not just flat thresholds |
| Immutable audit log | MAS regulatory awareness |
| Jest + Supertest tests | Production engineering habits |
| ESLint + GitHub Actions CI | Automated quality gates, not just "it works on my machine" |
| Stripe (test mode) top-up flow | Real payment-integration experience |
| Docker setup | DevOps awareness |
| Live deployment | Can ship, not just build |
| Clean GitHub with daily commits | Consistent, disciplined engineer |
| README with design decisions | Can communicate technical choices |
