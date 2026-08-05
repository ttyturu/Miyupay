# MiyuPay

A full-stack wallet-based digital payment platform built with TypeScript, Node.js, React and PostgreSQL. Inspired by Singapore's PayNow and MAS Project Nexus cross-border payment infrastructure.

**Live demo:** https://miyupay.vercel.app

---

## What it does

Users hold wallets in SGD, MYR and THB and can send money to each other instantly by email address — the same concept as PayNow's phone/NRIC identifier. Cross-border transfers apply live exchange rates. Every transaction is processed through a double-entry ledger, checked by a fraud detection engine, and recorded in an immutable audit trail.

---

## Features

| Feature | Description |
|---|---|
| Auth | JWT authentication with bcrypt password hashing |
| Email verification | Mocked — no real email sent; the code is shown on screen at registration |
| Password reset | Mocked — no real email sent; a reset code is shown on screen from "Forgot password?" |
| Password strength meter | Live feedback while typing on the register and reset-password forms |
| Multi-currency wallets | SGD, MYR, THB — auto-created on registration |
| Add credit | Stripe Checkout (test mode) top-up flow for the SGD wallet |
| Send money | Instant transfer with live exchange rate preview and recent-recipient autocomplete |
| Double-entry ledger | Every transfer creates a DEBIT + CREDIT — money cannot be created or lost |
| Fraud detection | 5 rules run before every payment — flags suspicious transactions before money moves |
| Immutable audit log | Every state change recorded permanently — append-only |
| Transaction history | Full history for every user — sent and received |
| React frontend | TypeScript, React Query, Tailwind CSS |
| CI | GitHub Actions — lint, typecheck, tests, build on every push/PR |

---

## Singapore fintech context

| MiyuPay feature | Real-world equivalent | Singapore context |
|---|---|---|
| Instant wallet transfer | PayNow / FAST | MAS-mandated real-time payment rails |
| SGD / MYR / THB wallets | Cross-border remittance | MAS Project Nexus — SG, MY, TH linkages |
| Double-entry ledger | Core banking ledger | Required by MAS Notice on Internal Controls |
| Fraud detection rules | Transaction monitoring | MAS Notice on AML/CFT compliance |
| Immutable audit log | Regulatory record-keeping | MAS Technology Risk Management Guidelines |
| JWT auth + bcrypt | Secure authentication | MAS IT security baseline |

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Data fetching | TanStack React Query |
| Auth | JWT + bcrypt |
| Payments | Stripe Checkout (test mode) |
| Testing | Jest + Supertest |
| Lint | ESLint (typescript-eslint) |
| CI | GitHub Actions |
| Container | Docker + docker-compose |
| Deploy | Vercel (frontend) + Render (backend) + Supabase (PostgreSQL) |

---

## Architecture

```
Browser (React + TypeScript)
        │
        │  HTTP + JWT
        ▼
Express API (Node.js + TypeScript)
        │
        ├── Auth middleware (JWT verification)
        ├── Fraud engine (5 rules, pre-payment)
        ├── Transaction service (double-entry ledger)
        └── Audit logger (append-only)
        │
        ▼
PostgreSQL
        │
        ├── users
        ├── wallets
        ├── transactions
        ├── ledger_entries   ← double-entry: DEBIT + CREDIT per transfer
        ├── fraud_checks     ← which rules fired on each transaction
        ├── audit_log        ← immutable event history
        ├── exchange_rates
        └── topups           ← Stripe (test mode) wallet top-ups
```

---

## The full payment flow

When a user sends SGD 100 to someone in MYR:

1. Frontend calls `POST /api/transactions/send` with JWT in header
2. Auth middleware verifies JWT, extracts userId
3. Fraud engine runs 5 rules — if `LARGE_AMOUNT`, `HIGH_FREQUENCY`, or `LARGE_CROSS_BORDER` trigger, or `NEW_RECIPIENT` and `UNUSUAL_HOUR` trigger together, the transaction is flagged and stops here (see [Fraud detection rules](#fraud-detection-rules))
4. PostgreSQL `BEGIN` — everything below is atomic
5. Sender SGD wallet debited by 100 — ledger entry: DEBIT SGD 100
6. Receiver MYR wallet credited by 345 (100 × 3.45) — ledger entry: CREDIT MYR 345
7. Transaction status set to `completed`
8. Audit log entry written: TRANSACTION_COMPLETED
9. PostgreSQL `COMMIT` — both entries permanent
10. Frontend cache invalidated — dashboard refreshes with new balance

If the server crashes between steps 4 and 9, PostgreSQL rolls back everything. No money moves.

---

## Fraud detection rules

| Rule | Trigger condition | Blocks on its own? |
|---|---|---|
| LARGE_AMOUNT | Transaction exceeds SGD 5,000 equivalent | Yes |
| HIGH_FREQUENCY | 5+ transactions sent in the last hour | Yes |
| LARGE_CROSS_BORDER | Cross-border transfer exceeds SGD 2,000 | Yes |
| NEW_RECIPIENT | First-ever transaction to this recipient | No — a first-time transfer is common and legitimate; the frontend shows a scam-awareness popup instead |
| UNUSUAL_HOUR | Transaction between 1 AM – 5 AM Singapore time | No — off-hours activity to a recipient you've already paid is normal |
| NEW_RECIPIENT + UNUSUAL_HOUR | Both trigger together | **Yes** — a first-time transfer sent during an unusual hour is the actual risk combination |

`LARGE_AMOUNT`, `HIGH_FREQUENCY`, and `LARGE_CROSS_BORDER` block a transaction independently, matching how real transaction-monitoring systems treat clear-cut thresholds. `NEW_RECIPIENT` and `UNUSUAL_HOUR` don't block alone — each is common in isolation — but combined they're the pattern real fraud engines flag (e.g. HSBC's transaction monitoring: an unusual time *combined with* an unfamiliar recipient, not either alone).

When a transaction is flagged: status is set to `flagged`, no money moves, all rule results are recorded in `fraud_checks` for audit purposes. The sending account itself is never blocked — only that specific transaction.

---

## API endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Register new user, returns a mocked email verification code |
| POST | /api/auth/verify-email | No | Confirm the verification code, returns JWT |
| POST | /api/auth/login | No | Login, returns JWT |
| POST | /api/auth/forgot-password | No | Request a mocked password reset code |
| POST | /api/auth/reset-password | No | Confirm the reset code and set a new password |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/wallet | Yes | Get all wallets |
| POST | /api/wallet/convert | Yes | Convert between currencies |
| GET | /api/transactions | Yes | Get transaction history |
| POST | /api/transactions/send | Yes | Send money |
| GET | /api/transactions/rates | Yes | Get exchange rates |
| GET | /api/transactions/recipient-check | Yes | Check whether the given email is a first-time recipient |
| GET | /api/transactions/recent-recipients | Yes | List distinct people previously sent to, most recent first |
| POST | /api/topup/create-session | Yes | Create a Stripe Checkout session (test mode) to add credit |
| POST | /api/topup/confirm | Yes | Confirm a completed Stripe session and credit the wallet |
| GET | /api/audit/log | Yes | Get audit event log |
| GET | /api/audit/ledger/:txId | Yes | Get ledger entries for a transaction |
| GET | /api/audit/fraud/:txId | Yes | Get fraud check results for a transaction |
| GET | /api/health | No | Health check |

---

## Project structure

```
miyupay/
├── .github/workflows/ci.yml        # Lint, typecheck, test, build on push/PR
├── backend/
│   ├── src/
│   │   ├── types/index.ts          # All TypeScript domain types
│   │   ├── models/schema.sql       # PostgreSQL schema — 8 tables
│   │   ├── services/
│   │   │   ├── fraudService.ts     # 5 fraud detection rules
│   │   │   ├── transactionService.ts # Double-entry ledger logic
│   │   │   └── stripeService.ts    # Stripe client (test mode)
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── transactionController.ts
│   │   │   └── topupController.ts  # Stripe Checkout session + confirm
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT verification
│   │   │   ├── validate.ts         # express-validator error handling
│   │   │   └── errorHandler.ts     # Centralised error handling
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── transactions.ts
│   │   │   ├── topup.ts
│   │   │   └── walletAndAudit.ts
│   │   ├── utils/
│   │   │   ├── db.ts               # PostgreSQL pool
│   │   │   └── helpers.ts          # Reference generator, formatters
│   │   ├── tests/                  # Jest + Supertest integration tests
│   │   ├── app.ts
│   │   └── index.ts
│   ├── Dockerfile
│   ├── eslint.config.js
│   ├── jest.config.json
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── types.ts                # Shared frontend TypeScript types
│   │   ├── services/api.ts         # Axios instance + API calls
│   │   ├── hooks/useAuth.ts        # Auth state management
│   │   ├── components/
│   │   │   ├── layout/Layout.tsx   # Nav + page wrapper
│   │   │   └── ui/                 # Reusable UI components, incl. PasswordStrengthMeter, Avatar
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ConvertPage.tsx
│   │   │   ├── SendPage.tsx
│   │   │   ├── TransactionsPage.tsx
│   │   │   ├── AuditPage.tsx
│   │   │   ├── TopUpPage.tsx       # Stripe "Add credit" flow
│   │   │   └── TopUpSuccessPage.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── eslint.config.js
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── tsconfig.json
├── docker-compose.yml
└── docs/
    └── SETUP.md
```

---

## Design decisions

**Why double-entry ledger instead of just updating balances?**
Simply updating `wallet.balance -= amount` has a fatal flaw: if the server crashes after debiting the sender but before crediting the receiver, money disappears. A double-entry ledger wrapped in a single PostgreSQL transaction means both entries commit together or neither does. This is why every bank uses it.

**Why rule-based fraud detection instead of ML?**
Regulated financial systems must be able to explain every fraud decision to auditors and regulators. A rule that says "flagged because amount exceeds SGD 5,000" is explainable. An ML model's decision is often not. Rule-based is what MAS-regulated institutions actually run at the transaction level.

**Why PostgreSQL over MongoDB?**
The ledger requires relational integrity — a ledger entry must reference a valid wallet, a fraud check must reference a valid transaction. Foreign key constraints, CHECK constraints (balance >= 0), and atomic multi-table transactions are PostgreSQL strengths. MongoDB would require enforcing all of this in application code, which is less reliable.

**Why TypeScript?**
Type errors in financial logic are expensive. TypeScript catches at compile time that you're passing a `string` where a `number` is expected for an amount — the kind of bug that could cause real financial errors in production. It also appears in 70%+ of Singapore fintech job listings in 2026.

---

## Setup

See [docs/SETUP.md](docs/SETUP.md) for the full step-by-step build checklist.

Quick start:
```bash
# Backend
cd backend && npm install && cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET in .env
# STRIPE_SECRET_KEY is optional — the app runs fine without it, /topup just
# returns an error until you add a free Stripe test-mode key.
npm run dev

# Frontend (new terminal)
cd frontend && npm install && cp .env.example .env
npm run dev
```

Or with Docker (no local PostgreSQL needed):
```bash
docker-compose up --build
```

---

## Running tests

```bash
cd backend
npm run test           # run all tests
npm run test:coverage  # with coverage report
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit
```

Tests run against your local dev database (`DATABASE_URL` in `.env`) rather than a separate test database — there's no separate CREATEDB-privileged role assumed. Test data is namespaced under the `@test.miyupay.dev` email domain and is fully cleaned up after the run (`src/tests/globalTeardown.js`). `src/tests/globalSetup.js` also applies any schema changes that were added to `schema.sql` after your local DB was first created, since there's no migration tool in this repo — if you pull changes that touch `schema.sql`, running the tests once will bring your dev DB's schema up to date.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and build for both `backend` and `frontend` on every push/PR to `main`, using a fresh Postgres service container.

---

## Deployment

- Frontend → [Vercel](https://vercel.com) — connect GitHub repo, set root to `/frontend`. Needs `frontend/vercel.json` (already in the repo) for client-side routing to work — without it, direct links to routes like `/login` 404.
- Backend → [Render](https://render.com) — connect GitHub repo, set root to `/backend`, deploy via the existing `Dockerfile`. Set environment variables from `backend/.env.example` (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` — must be the deployed Vercel URL, not `localhost`, or CORS will block requests — `STRIPE_SECRET_KEY`, `NODE_ENV=production`).
- Database → [Supabase](https://supabase.com) PostgreSQL — paste its connection string into `DATABASE_URL` on Render. Supabase's SQL Editor can be used to run `backend/src/models/schema.sql` directly, and to apply any later schema changes manually — there's no migration tool in this repo, so if `schema.sql` changes after your database was first created, the new `ALTER TABLE`/`CREATE TABLE` statements need to be run against Supabase by hand.

---


