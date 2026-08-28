# MiyuPay

A full-stack wallet-based digital payment platform built with TypeScript, Node.js, React and PostgreSQL. Inspired by Singapore's PayNow and MAS Project Nexus cross-border payment infrastructure.

**Live demo:** https://miyupay.vercel.app

---

## What it does

Users hold wallets in SGD, MYR and THB and can send money to each other instantly by email address — the same concept as PayNow's phone/NRIC identifier. Cross-border transfers apply live exchange rates. Every transfer and every wallet top-up is processed through a double-entry ledger, checked by a fraud detection engine, and recorded in an immutable, admin-only audit trail.

---

## Features

| Feature | Description |
|---|---|
| Auth | JWT authentication with bcrypt password hashing |
| Email verification | Mocked — no real email sent; the code is shown on screen at registration |
| Password reset | Mocked — no real email sent; a reset code is shown on screen from "Forgot password?" |
| Password strength meter | Live feedback while typing on the register and reset-password forms |
| Multi-currency wallets | SGD, MYR, THB — auto-created on registration |
| Add credit | Stripe Checkout (test mode) top-up flow for the SGD wallet, posted through a real double-entry ledger (see [Clearing account](#clearing-account-double-entry-top-ups)) |
| Send money | Instant transfer with live exchange rate preview and recent-recipient autocomplete |
| Double-entry ledger | Every transfer *and* every top-up creates a DEBIT + CREDIT — money cannot be created or lost |
| Fraud detection | 6 rules run before every payment, 1 more on every top-up attempt — flags suspicious activity before money moves |
| Risk scoring | Every flagged transaction/top-up gets a weighted 0-100 risk score; a rolling 30-day aggregate score summarizes how risky a person looks overall |
| Kill switch | Self-service account freeze — a user can instantly block their own outgoing transfers; only an admin can lift it, with their own password re-confirmed first |
| Admin panel | Role-gated: look up any user's full activity (transfers + top-ups) by email, drill into ledger/fraud-rule detail per item, freeze/unfreeze accounts, browse all flagged activity sorted by recency or risk |
| AI transaction summary | Admin-only — summarizes a user's activity via Groq, with real data and their aggregate risk score as context (RAG-lite) |
| Immutable audit log | Every state change recorded permanently, append-only — admin-only, not customer-facing |
| Transaction history | Full history for every user — transfers sent/received and completed top-ups, one merged chronological feed ([why not pending ones](#top-up-status--and-why-users-never-see-pending)) |
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
        ├── Admin middleware (role check, gates /api/admin/*)
        ├── Fraud engine (6 rules + weighted risk score, pre-transfer)
        ├── Top-up fraud check (1 rule — TOPUP_VELOCITY, pre-topup)
        ├── Transaction service (double-entry ledger)
        ├── Groq service (AI activity summary, admin-only)
        └── Audit logger (append-only)
        │
        ▼
PostgreSQL
        │
        ├── users            ← includes one reserved system row: the clearing account
        ├── wallets           ← includes one system wallet, allowed to run negative
        ├── transactions
        ├── topups            ← Stripe (test mode) wallet top-ups, own risk fields
        ├── ledger_entries   ← double-entry: DEBIT + CREDIT per transfer OR per top-up
        ├── fraud_checks     ← which transfer rules fired on each transaction
        ├── audit_log        ← immutable event history
        └── exchange_rates
```

---

## The full payment flow

When a user sends SGD 100 to someone in MYR:

1. Frontend calls `POST /api/transactions/send` with JWT in header
2. PostgreSQL `BEGIN`, then the sender's row is locked (`SELECT ... FOR UPDATE`) — this serializes any other concurrent send from the same sender for the rest of the flow (see [Concurrency safety](#concurrency-safety)); sender's `frozen` status is checked in the same query and blocks the send with a 403 if set (the kill switch)
3. Fraud engine runs 6 rules — if `LARGE_AMOUNT`, `HIGH_FREQUENCY`, `LARGE_CROSS_BORDER`, or `SPLIT_TRANSFERS` trigger, or `NEW_RECIPIENT` and `UNUSUAL_HOUR` trigger together, the transaction is flagged and stops here (see [Fraud detection rules](#fraud-detection-rules))
4. Everything below runs inside the same atomic transaction opened in step 2
5. Sender SGD wallet debited by 100 — ledger entry: DEBIT SGD 100
6. Receiver MYR wallet credited by 345 (100 × 3.45) — ledger entry: CREDIT MYR 345
7. Transaction status set to `completed`
8. Audit log entry written: TRANSACTION_COMPLETED
9. PostgreSQL `COMMIT` — both entries permanent
10. Frontend cache invalidated — dashboard refreshes with new balance

If the server crashes between steps 4 and 9, PostgreSQL rolls back everything. No money moves.

---

## Fraud detection rules

| Rule | Trigger condition | Blocks on its own? | Risk weight |
|---|---|---|---|
| LARGE_AMOUNT | Transaction exceeds SGD 5,000 equivalent | Yes | 30 |
| HIGH_FREQUENCY | 5+ transactions sent in the last hour | Yes | 35 |
| LARGE_CROSS_BORDER | Cross-border transfer exceeds SGD 2,000 | Yes | 40 |
| SPLIT_TRANSFERS | Several transfers to the same recipient within an hour, each under SGD 5,000, that sum above it (structuring) | Yes | 55 |
| NEW_RECIPIENT | First-ever transaction to this recipient | No — a first-time transfer is common and legitimate; the frontend shows a scam-awareness popup instead | 0 alone |
| UNUSUAL_HOUR | Transaction between 1 AM – 5 AM Singapore time | No — off-hours activity to a recipient you've already paid is normal | 0 alone |
| NEW_RECIPIENT + UNUSUAL_HOUR | Both trigger together | **Yes** — a first-time transfer sent during an unusual hour is the actual risk combination | 60 |

`LARGE_AMOUNT`, `HIGH_FREQUENCY`, `LARGE_CROSS_BORDER`, and `SPLIT_TRANSFERS` block a transaction independently, matching how real transaction-monitoring systems treat clear-cut thresholds. `NEW_RECIPIENT` and `UNUSUAL_HOUR` don't block alone — each is common in isolation — but combined they're the pattern real fraud engines flag (e.g. HSBC's transaction monitoring: an unusual time *combined with* an unfamiliar recipient, not either alone). `SPLIT_TRANSFERS` mirrors real AML "structuring" detection — deliberately splitting a transfer to dodge a threshold is weighted as a stronger signal than simply exceeding one.

When a transaction is flagged: status is set to `flagged`, no money moves, all rule results are recorded in `fraud_checks` for audit purposes, and a weighted `risk_score` (0-100, capped) is stored on the transaction — the sum of the weights of every rule that fired. The sending account itself is never blocked by the fraud engine — only that specific transaction. The one way an account itself gets blocked is the kill switch below, and that's always a deliberate action, not an automatic fraud-rule response.

---

## Top-up fraud check

A second, deliberately separate and much smaller rule set — watching the funding side (money entering via Stripe), not the sending side:

| Rule | Trigger condition | Blocks the top-up? | Risk weight |
|---|---|---|---|
| TOPUP_VELOCITY | 3+ top-up attempts (session creations) within 10 minutes | No — flagged for admin review only | 35 |

This mirrors "card testing" — bots firing many rapid small charges to find a still-valid stolen card. It never blocks the top-up itself: Stripe Checkout already gates whether a charge actually succeeds (CVV/AVS/Radar), and a legitimate user retrying a declined card looks identical to an attacker for the first couple of attempts — blocking would punish honest retries for no real fraud-prevention benefit. It exists purely to give an admin a visible signal (a flag on the top-up, folded into the same `risk_score`/aggregate-risk model as transfers) if the pattern keeps happening.

Runs independently from the 6 transfer rules above — a completely separate function (`topupFraudService.ts`), triggered from a different endpoint (`POST /api/topup/create-session`), because it's answering a different question ("is this funding attempt suspicious?" vs. "is this money movement suspicious?").

---

## Kill switch (account freeze)

Any user can freeze their own account instantly from **Account** in the nav (`POST /api/auth/freeze`) — this immediately blocks all outgoing transfers, mirroring the self-service "kill switch" requirement in MAS's Shared Responsibility Framework for digital banking. Once frozen, only an admin can lift it — the account holder can't undo it themselves, since if their own session is compromised, letting that same session unfreeze it would defeat the point.

Admin-initiated freeze/unfreeze (`POST /api/admin/users/:email/freeze` / `/unfreeze`) requires the admin's *own* login password in the request body, verified server-side with `bcrypt.compare` before the action runs — the same step-up-auth pattern GitHub/AWS use before a destructive action, so a compromised admin session token alone isn't enough to freeze or unfreeze someone's account.

---

## Admin panel

Role-gated (`role = 'admin'` on the `users` table) — there's no self-serve way to become an admin; it's granted by running SQL directly against the database (see [Setup](#setup)). There is no customer-facing audit trail — regular users only ever see their own Transactions page. Admins get two extra nav items:

- **Admin** (`/admin`) — search any user by email (live autocomplete) to see their full activity — transfers and top-ups, merged and sorted chronologically — plus their rolling 30-day aggregate risk score, freeze/unfreeze controls, an AI summary button, and a per-item expandable ledger/fraud-rule drill-down (the same detail a customer-facing "Audit Trail" page would have shown, now admin-only).
- **Flagged** (`/admin/flagged`) — every fraud-flagged transfer *and* top-up across all users in one list, sortable by most recent or by risk score. Clicking a person's name deep-links straight into the Admin lookup page above, pre-filled and pre-searched.

### Aggregate risk score

Distinct from a single transaction's `risk_score`: a rolling 30-day sum of every flagged transfer *and* top-up belonging to one person (capped at 100), shown on the Admin lookup page. A transaction score answers "how bad is this one event"; the aggregate answers "how concerning is this person overall" — the same distinction real AML systems draw between a transaction risk score and a customer risk rating. It's computed live at lookup time (not stored), so it naturally decays as old flags age out of the 30-day window.

### AI activity summary

A RAG-lite pattern, not a framework, in three explicit steps:
1. **Retrieve** — the SQL query behind the Admin lookup page (real transfer + top-up rows from Postgres, for that one person).
2. **Augment** — format those rows, plus the aggregate risk score, into the prompt text handed to the model.
3. **Generate** — send that prompt to [Groq](https://console.groq.com) (free tier, fast inference) and return its plain-English summary.

The prompt opens with the aggregate risk rating and asks the model to prioritize which flags deserve attention first, rather than listing every flag as equally important. No vector database or embeddings — the data being retrieved is small and already structured, so a direct SQL query is enough. Requires `GROQ_API_KEY` in `backend/.env` (see `.env.example`); without it, the summary endpoint returns a "not configured" message instead of erroring.

Two details matter for making the output trustworthy rather than merely fluent:

**The prompt states the rating's real scope.** Aggregate risk counts only transfers the user *sent* plus their own top-ups — a fraud flag describes the sender's behaviour, so a flag on money they merely *received* belongs to the counterparty. An earlier prompt described the score as covering "every flagged transfer and top-up", which made a legitimate `0/100` look self-contradictory next to visibly `FLAGGED` rows. The model resolved the contradiction by inventing a scoring threshold that doesn't exist — a confident, fluent, completely fabricated explanation of how the risk engine works. In a compliance tool that's worse than no summary at all. The prompt now states the actual scope, tags received-flag rows inline as counterparty conduct, and takes a separate branch at `0/100` that instructs the model to report the absence plainly instead of inventing drivers for it.

**Reasoning tokens are budgeted.** `gpt-oss-120b` is a reasoning model, and its hidden reasoning is drawn from the *same* `max_tokens` budget as the visible answer. On the ambiguous prompt above it spent 298 of 300 tokens deliberating and returned empty content with `finish_reason: 'length'` — an "outage" that was really a budget exhaustion. `reasoning_effort: 'low'` plus a larger ceiling keeps the answer from being starved, and an empty response is now reported distinctly from an API failure so the two are debuggable apart.

---

## Clearing account (double-entry top-ups)

A top-up is money entering the system from *outside* (a card via Stripe), not from another user's wallet — so unlike a transfer, there's no natural internal counterparty to pair a ledger entry against. Bolting it onto the `transactions` table (making Stripe a fake "sender") would blur real user-to-user transfers together with system-generated funding events, and would need every transfer-specific check (self-send, recipient lookup, fraud rules) bypassed for a non-user.

Instead there's one reserved system account — `role='user'`, a fixed id, no working password, never returned by admin search — with its own SGD wallet flagged `is_system = TRUE` (exempted from the normal `balance >= 0` constraint, since a pass-through/clearing account is expected to run negative). Confirming a top-up posts two real ledger entries, the same DEBIT/CREDIT shape a transfer uses:

- **DEBIT** the clearing wallet (money leaving the "pool" received from Stripe)
- **CREDIT** the user's wallet

This keeps the ledger's core invariant intact for *all* money movement, not just transfers: sum every DEBIT and CREDIT across the whole table and they still net to zero, so every dollar in every wallet is traceable back to a real source — either another user's transfer, or the clearing account's Stripe-backed top-up. `ledger_entries.transaction_id` is nullable and a new nullable `topup_id` was added, with a `CHECK` ensuring every row belongs to exactly one of the two, never both, never neither.

---

## Top-up status — and why users never see "pending"

A `topups` row is created the moment a Checkout session is opened, *before* the customer has paid anything, because the row is what binds `stripe_session_id → user + amount + fraud snapshot` and what `TOPUP_VELOCITY` counts. It therefore needs a status for the window where the outcome isn't known yet:

| Status | Meaning | User sees | Admin sees |
|---|---|---|---|
| `pending` | Session open, nothing paid | — | yes |
| `completed` | Paid and credited | ✅ completed | yes |
| `expired` | Session lapsed unpaid (abandoned) | — | yes |

Only `completed` top-ups appear in a user's history. A checkout someone opened and walked away from involves **no charge, no authorization, no hold** — nothing moved, so it isn't an entry in a record of money movements. Rendering it as "pending" actively misleads: it implies funds are in flight when nothing was ever taken. And because a card top-up either lands within seconds or never happened, the only moments a user could *see* "pending" are moments when it's already wrong.

This follows what the payment industry actually does. DBS shows pending card transactions because an authorization has genuinely ring-fenced the customer's funds, and *drops* them if the merchant never settles rather than marking them failed. YouTrip shows a pending top-up only while money has left the bank but not yet reached the wallet. GrabPay states plainly that an unsuccessful top-up "may not appear in your transaction history because the amount was not successfully reflected into the wallet." The common rule: **show pending only when the customer's money has actually left their control but hasn't arrived yet** — never as a placeholder for "we're waiting to see if they'll pay."

Admins still see every row, where a cluster of `expired` sessions is a card-testing signal rather than a user-facing event. `expired` is set by the `checkout.session.expired` webhook; sessions are created with a 60-minute `expires_at` (Stripe's default is 24h, far longer than anyone spends on a wallet top-up), so abandoned rows resolve themselves without a cron job.

---

## Concurrency safety

Two race conditions were found (via a deliberate route-by-route review, not in normal use) and fixed — both are the same underlying class of bug: a "check, then act" pattern with a gap in between where a second request can slip through. A third, related gap in the same flow — top-up confirmation depending entirely on the customer's browser — is covered below it.

**Top-up double-crediting.** `confirmTopup` used to check "is this top-up already completed?" as a plain `SELECT`, then — after an intervening network round-trip to Stripe — credit the wallet in a separate step. If that confirm request ran twice around the same time (a page refresh on the success page, two tabs, a retried request), both could read "not yet completed" before either had finished, and both would credit the wallet — real money duplicated from one Stripe payment. The fix replaces the separate check with a single atomic claim, now living in `topupCreditService.ts` so both confirmation paths share one implementation:
```sql
UPDATE topups SET status='completed', completed_at=NOW()
WHERE id=$1 AND status<>'completed' RETURNING id, amount, currency, user_id
```
Only one caller can ever flip a top-up to `completed`, because the check and the change happen as one indivisible database statement instead of two. A caller that gets zero rows back knows someone else already won the race and returns the current balance instead of crediting again. Claiming from *any* non-completed status rather than strictly `pending` also covers the case where a session was marked `expired` but Stripe confirms it was paid after all — Stripe is authoritative about payment, so that money still reaches the user. Covered by `topupConcurrency.test.ts`, which calls `creditTopup()` twice simultaneously and asserts exactly one credits, the ledger holds exactly two entries, and a late expiry can never un-credit a paid top-up.

**Confirmation that depended on the customer's browser.** The bug above assumed `confirmTopup` runs at all. It only runs if Stripe's redirect back to `/topup/success` succeeds — so if the customer closed the tab right after paying, lost signal, or their phone died, Stripe had taken the money and the wallet was never credited. No retry, no recovery: the top-up sat at `pending` forever and the user was simply out the funds. Trusting the redirect is the classic failure mode of a first payments integration. The fix is a Stripe webhook (`POST /api/webhooks/stripe`) — Stripe notifies the server directly, machine-to-machine, and retries for 72 hours, so crediting no longer depends on the customer's browser surviving the round trip. Both paths call the same idempotent `creditTopup()` and routinely race each other; whichever arrives second is absorbed. The endpoint is public and unauthenticated (Stripe has no session to present), so an HMAC signature check against the raw request bytes is the only thing standing between an anonymous POST and free wallet credit — which is why the webhook router is mounted *before* `express.json()`, since parsing the body first would destroy the signature. `webhookSignature.test.ts` asserts that unsigned requests, wrongly-signed requests, and a forged "payment succeeded" event are all rejected without moving a cent.

**Fraud-rule evasion via concurrent sends.** `SPLIT_TRANSFERS`, `HIGH_FREQUENCY`, and `NEW_RECIPIENT` all work by counting/summing the sender's *other* transactions — but that read happened before the current send was inserted, with nothing serializing two sends from the same sender. Two nearly-simultaneous sends (e.g. an attempt to split a large transfer to dodge `SPLIT_TRANSFERS`) could each evaluate fraud against the same "before" state and both slip through a pattern that only trips the rule when considered together. The fix: `processTransaction` now opens its transaction and takes a row lock on the sender (`SELECT ... FOR UPDATE`) before running any fraud checks, so a second concurrent send from the same sender blocks until the first fully commits — by the time it runs its own fraud check, it sees the first send's committed row. Covered by a concurrency test in `transactions.test.ts` that fires three structuring-eligible sends at once via `Promise.all` and asserts at least one is still caught.

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
| POST | /api/auth/freeze | Yes | Freeze the caller's own account (kill switch) |
| GET | /api/wallet | Yes | Get all wallets |
| POST | /api/wallet/convert | Yes | Convert between currencies |
| GET | /api/transactions | Yes | Get transaction history |
| POST | /api/transactions/send | Yes | Send money |
| GET | /api/transactions/rates | Yes | Get exchange rates |
| GET | /api/transactions/recipient-check | Yes | Check whether the given email is a first-time recipient |
| GET | /api/transactions/recent-recipients | Yes | List distinct people previously sent to, most recent first |
| POST | /api/topup/create-session | Yes | Create a Stripe Checkout session (test mode) to add credit; runs TOPUP_VELOCITY first |
| POST | /api/topup/confirm | Yes | Confirm a paid Stripe session from the browser after the redirect; posts DEBIT/CREDIT ledger entries via the clearing wallet. Races the webhook below — both are idempotent |
| POST | /api/webhooks/stripe | Signature | Stripe → server confirmation, independent of the customer's browser. Credits on `checkout.session.completed`, marks `expired` on `checkout.session.expired`. Authenticated by HMAC signature, not JWT |
| GET | /api/admin/users/search | Admin | Live search for a user by partial email or name |
| GET | /api/admin/users/:email/audit | Admin | Look up a user by email — full merged activity (transfers + top-ups) and their aggregate risk score |
| GET | /api/admin/users/:email/summary | Admin | AI-generated plain-English summary of a user's activity |
| POST | /api/admin/users/:email/freeze | Admin | Freeze a user's account (requires the admin's own `password` in the body) |
| POST | /api/admin/users/:email/unfreeze | Admin | Unfreeze a user's account (requires the admin's own `password` in the body) |
| GET | /api/admin/flagged | Admin | All flagged transfers + top-ups across every user, sorted by `?sort=recent\|risk` |
| GET | /api/admin/transactions/:txId/ledger | Admin | Ledger entries for a transfer |
| GET | /api/admin/transactions/:txId/fraud | Admin | Fraud-rule breakdown for a transfer (which of the 6 rules triggered) |
| GET | /api/admin/topups/:topupId/ledger | Admin | Ledger entries for a top-up |
| GET | /api/health | No | Health check |

---

## Project structure

```
miyupay/
├── .github/workflows/ci.yml        # Lint, typecheck, test, build on push/PR
├── backend/
│   ├── src/
│   │   ├── types/index.ts          # All TypeScript domain types
│   │   ├── models/schema.sql       # PostgreSQL schema — 8 tables + reserved clearing account
│   │   ├── services/
│   │   │   ├── fraudService.ts       # 6 transfer fraud rules + weighted risk score
│   │   │   ├── topupFraudService.ts  # TOPUP_VELOCITY — separate, funding-side rule
│   │   │   ├── transactionService.ts # Double-entry ledger logic
│   │   │   ├── stripeService.ts      # Stripe client (test mode)
│   │   │   ├── topupCreditService.ts # Idempotent top-up crediting, shared by confirm + webhook
│   │   │   └── groqService.ts        # AI activity summary (admin-only)
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── transactionController.ts
│   │   │   ├── topupController.ts  # Stripe Checkout session + browser-side confirm
│   │   │   ├── webhookController.ts # Stripe webhook — signature-verified, browser-independent confirm
│   │   │   └── adminController.ts  # User lookup, aggregate risk, flagged list, freeze/unfreeze, ledger/fraud drill-down
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT verification
│   │   │   ├── isAdmin.ts          # Role check, gates /api/admin/*
│   │   │   ├── validate.ts         # express-validator error handling
│   │   │   └── errorHandler.ts     # Centralised error handling
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── transactions.ts
│   │   │   ├── topup.ts
│   │   │   ├── webhooks.ts         # Raw-body route, mounted before express.json()
│   │   │   ├── admin.ts
│   │   │   └── wallet.ts
│   │   ├── utils/
│   │   │   ├── db.ts               # PostgreSQL pool
│   │   │   ├── helpers.ts          # Reference generator, formatters
│   │   │   ├── activity.ts         # Merges + sorts transfers/top-ups into one feed
│   │   │   └── constants.ts        # CLEARING_ACCOUNT_ID
│   │   ├── scripts/
│   │   │   └── seedDemoData.ts     # Populates 11 demo users with varied fraud/risk patterns
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
│   │   │   ├── admin/AdminActivityDetail.tsx # Ledger/fraud-rule drill-down (admin-only)
│   │   │   └── ui/                 # Reusable UI components, incl. PasswordStrengthMeter, Avatar
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── ForgotPasswordPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ConvertPage.tsx
│   │   │   ├── SendPage.tsx
│   │   │   ├── TransactionsPage.tsx  # Merged transfer + top-up history
│   │   │   ├── TopUpPage.tsx       # Stripe "Add credit" flow
│   │   │   ├── TopUpSuccessPage.tsx
│   │   │   ├── AccountPage.tsx     # Self-freeze (kill switch)
│   │   │   ├── AdminPage.tsx       # Admin-only: user lookup, aggregate risk, freeze/unfreeze, AI summary, ledger/fraud drill-down
│   │   │   └── AdminFlaggedPage.tsx # Admin-only: all flagged activity, sortable, deep-links into AdminPage
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
# GROQ_API_KEY is optional too — without it, the admin AI summary just
# returns a "not configured" message instead of erroring.
npm run dev

# Frontend (new terminal)
cd frontend && npm install && cp .env.example .env
npm run dev
```

Or with Docker (no local PostgreSQL needed):
```bash
docker-compose up --build
```

### Demo data + admin access

```bash
cd backend
npm run seed
```

Populates 11 demo accounts (`demo1@miyupay.dev` … `demo11@miyupay.dev`, password `DemoPass123!`) with deliberately varied activity — clean transfers, large amounts, cross-border, high frequency, structuring, the new-recipient + unusual-hour combo, a rapid top-up flagged by `TOPUP_VELOCITY`, a pending (abandoned) top-up, and one person (`demo11`) with flags from *both* engines to demonstrate the aggregate risk score — so the admin panel, risk sorting, and aggregate score all have real data to show. Safe to re-run; it skips silently if the demo data already exists.

There's no self-serve way to become an admin — it's a manual DB update:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
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
- `npm run seed` reads whichever `DATABASE_URL` is active in `.env` — pointing it at the Supabase connection string (temporarily, in a local `.env`) seeds the deployed database instead of the local one, useful for populating a live demo.

---



## License

[MIT](LICENSE) — free to use, modify and distribute, with no warranty.

A portfolio project, not a licensed payment service — Stripe runs in test mode
and no real money moves.
