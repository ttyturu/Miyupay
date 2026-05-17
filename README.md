# MiyuPay

A full-stack wallet-based digital payment platform built with TypeScript, Node.js, React and PostgreSQL. Inspired by Singapore's PayNow and MAS Project Nexus cross-border payment infrastructure.

**Live demo:** _add your Vercel URL here after deployment_

---

## What it does

Users hold wallets in SGD, MYR and THB and can send money to each other instantly by email address — the same concept as PayNow's phone/NRIC identifier. Cross-border transfers apply live exchange rates. Every transaction is processed through a double-entry ledger, checked by a fraud detection engine, and recorded in an immutable audit trail.

---

## Features

| Feature | Description |
|---|---|
| Auth | JWT authentication with bcrypt password hashing |
| Multi-currency wallets | SGD, MYR, THB — auto-created on registration |
| Send money | Instant transfer with live exchange rate preview |
| Double-entry ledger | Every transfer creates a DEBIT + CREDIT — money cannot be created or lost |
| Fraud detection | 5 rules run before every payment — flags suspicious transactions before money moves |
| Immutable audit log | Every state change recorded permanently — append-only |
| Transaction history | Full history for every user — sent and received |
| React frontend | TypeScript, React Query, Tailwind CSS |

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
| Testing | Jest + Supertest |
| Container | Docker + docker-compose |
| Deploy | Vercel (frontend) + Railway (backend + DB) |

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
        └── exchange_rates
```

---

## The full payment flow

When a user sends SGD 100 to someone in MYR:

1. Frontend calls `POST /api/transactions/send` with JWT in header
2. Auth middleware verifies JWT, extracts userId
3. Fraud engine runs 5 rules — if any trigger, transaction is flagged and stops here
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

| Rule | Trigger condition |
|---|---|
| LARGE_AMOUNT | Transaction exceeds SGD 5,000 equivalent |
| UNUSUAL_HOUR | Transaction between 1 AM – 5 AM Singapore time |
| NEW_RECIPIENT | First-ever transaction to this recipient |
| HIGH_FREQUENCY | 5+ transactions sent in the last hour |
| LARGE_CROSS_BORDER | Cross-border transfer exceeds SGD 2,000 |

When a transaction is flagged: status is set to `flagged`, no money moves, all rule results are recorded in `fraud_checks` for audit purposes.

---

## API endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login, returns JWT |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/wallet | Yes | Get all wallets |
| GET | /api/transactions | Yes | Get transaction history |
| POST | /api/transactions/send | Yes | Send money |
| GET | /api/transactions/rates | Yes | Get exchange rates |
| GET | /api/audit/log | Yes | Get audit event log |
| GET | /api/audit/ledger/:txId | Yes | Get ledger entries for a transaction |
| GET | /api/audit/fraud/:txId | Yes | Get fraud check results for a transaction |
| GET | /api/health | No | Health check |

---

## Project structure

```
miyupay/
├── backend/
│   ├── src/
│   │   ├── types/index.ts          # All TypeScript domain types
│   │   ├── models/schema.sql       # PostgreSQL schema — 7 tables
│   │   ├── services/
│   │   │   ├── fraudService.ts     # 5 fraud detection rules
│   │   │   └── transactionService.ts # Double-entry ledger logic
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   └── transactionController.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT verification
│   │   │   └── errorHandler.ts     # Centralised error handling
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── transactions.ts
│   │   │   └── walletAndAudit.ts
│   │   ├── utils/
│   │   │   ├── db.ts               # PostgreSQL pool
│   │   │   └── helpers.ts          # Reference generator, formatters
│   │   ├── app.ts
│   │   └── index.ts
│   ├── Dockerfile
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── types.ts                # Shared frontend TypeScript types
│   │   ├── services/api.ts         # Axios instance + API calls
│   │   ├── hooks/useAuth.ts        # Auth state management
│   │   ├── components/
│   │   │   ├── layout/Layout.tsx   # Nav + page wrapper
│   │   │   └── ui/                 # Reusable UI components
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── SendPage.tsx
│   │   │   ├── TransactionsPage.tsx
│   │   │   └── AuditPage.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
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
npm run dev

# Frontend (new terminal)
cd frontend && npm install
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
```

---

## Deployment

- Frontend → [Vercel](https://vercel.com) — connect GitHub repo, set root to `/frontend`
- Backend → [Railway](https://railway.app) — connect GitHub repo, set root to `/backend`
- Database → Railway PostgreSQL — paste `DATABASE_URL` into backend environment variables

---

## What to add in Year 2

After taking IS4000 (AI in Financial Services):

Replace the rule-based fraud engine with a Python ML model trained on transaction patterns. Serve it as a FastAPI microservice and call it from the Node.js backend. At that point MiyuPay demonstrates both financial engineering fundamentals and applied AI — the highest-demand combination in Singapore fintech.

---

_Built by an Information Systems student — Fintech Track — Singapore_
