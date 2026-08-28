-- MiyuPay v2 — Database Schema
-- PostgreSQL
-- Core design: double-entry ledger
-- Every debit has a matching credit. Money is never created or destroyed.

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  country       VARCHAR(3) NOT NULL DEFAULT 'SGP', -- SGP | MYS | THA
  role          VARCHAR(10) NOT NULL DEFAULT 'user', -- user | admin — admin is granted manually, no self-serve UI
  frozen        BOOLEAN NOT NULL DEFAULT FALSE, -- self-service "kill switch"; only an admin can lift it
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  verification_code VARCHAR(6),
  reset_code    VARCHAR(6),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ─── Wallets ──────────────────────────────────────────────────────────────────
-- One wallet per currency per user
-- Balance is always derived from the ledger — this is a cached value only
CREATE TABLE wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency   VARCHAR(3) NOT NULL,           -- SGD | MYR | THB
  balance    DECIMAL(18,6) NOT NULL DEFAULT 0,
  is_system  BOOLEAN NOT NULL DEFAULT FALSE, -- the clearing wallet below; legitimately runs negative
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, currency),
  CHECK (balance >= 0 OR is_system)
);

-- ─── Clearing account (Stripe) ───────────────────────────────────────────────
-- A reserved system account, not a real user — never logs in, never appears in
-- admin search. Its SGD wallet is the double-entry counterparty for top-ups:
-- confirming a top-up DEBITs this wallet and CREDITs the user's, exactly like
-- a transfer, instead of a bare balance increment with no ledger trail.
-- Fixed id so the backend can look it up without a join. The password hash
-- below is a real bcrypt hash of an unpublished, unused string — this account
-- has no working password and cannot log in through the normal auth flow.
INSERT INTO users (id, email, password_hash, full_name, role, is_verified) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system.clearing@miyupay.internal',
   '$2a$12$DuxRLhp6/YnkLJqPmtgMu.9tj/iTacYD/3wCC0t8IrtK7CREhaDCW',
   'MiyuPay Clearing (Stripe)', 'user', TRUE);

INSERT INTO wallets (user_id, currency, balance, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'SGD', 0, TRUE);

-- ─── Exchange rates ───────────────────────────────────────────────────────────
CREATE TABLE exchange_rates (
  id            SERIAL PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency   VARCHAR(3) NOT NULL,
  rate          DECIMAL(18,6) NOT NULL,
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (from_currency, to_currency)
);

INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
  ('SGD','MYR',3.45), ('SGD','THB',26.80),
  ('MYR','SGD',0.29), ('MYR','THB',7.77),
  ('THB','SGD',0.037),('THB','MYR',0.129),
  ('SGD','SGD',1.00), ('MYR','MYR',1.00), ('THB','THB',1.00);

-- ─── Transactions ─────────────────────────────────────────────────────────────
-- A transaction is the intent to move money
-- Status: pending → processing → completed | failed | flagged
CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code    VARCHAR(20) UNIQUE NOT NULL,
  sender_id         UUID NOT NULL REFERENCES users(id),
  receiver_id       UUID NOT NULL REFERENCES users(id),
  sender_currency   VARCHAR(3) NOT NULL,
  receiver_currency VARCHAR(3) NOT NULL,
  sender_amount     DECIMAL(18,6) NOT NULL CHECK (sender_amount > 0),
  receiver_amount   DECIMAL(18,6) NOT NULL CHECK (receiver_amount > 0),
  exchange_rate     DECIMAL(18,6) NOT NULL,
  is_cross_border   BOOLEAN NOT NULL DEFAULT FALSE,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  fraud_flagged     BOOLEAN NOT NULL DEFAULT FALSE,
  fraud_reason      TEXT,
  risk_score        INT NOT NULL DEFAULT 0, -- 0-100, weighted sum of triggered fraud rules
  note              TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  completed_at      TIMESTAMP,
  CHECK (sender_id != receiver_id)
);

-- ─── Top-ups (Stripe) ─────────────────────────────────────────────────────────
-- Adding credit via Stripe Checkout (test mode). Money originates outside the
-- system (a card, not another user), so it posts against the clearing wallet
-- below rather than another user's wallet — see Ledger entries.
CREATE TABLE topups (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  stripe_session_id  VARCHAR(255) UNIQUE NOT NULL,
  currency           VARCHAR(3) NOT NULL,
  amount             DECIMAL(18,6) NOT NULL CHECK (amount > 0),
  -- pending   session open, nothing paid yet  (internal — never shown to users)
  -- completed paid and credited                (the only status users ever see)
  -- expired   Stripe session lapsed unpaid     (internal — admin/fraud only)
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  fraud_flagged      BOOLEAN NOT NULL DEFAULT FALSE,
  fraud_reason       TEXT,
  risk_score         INT NOT NULL DEFAULT 0, -- 0-100; currently only TOPUP_VELOCITY
  created_at         TIMESTAMP DEFAULT NOW(),
  completed_at       TIMESTAMP
);

-- ─── Ledger entries ───────────────────────────────────────────────────────────
-- Double-entry: every transaction produces exactly 2 entries
-- One DEBIT (money leaves sender), one CREDIT (money arrives at receiver)
-- This is how every regulated financial institution tracks money
--
-- A top-up posts here too, now that money entering from Stripe has a real
-- counterparty: DEBIT the clearing wallet below, CREDIT the user's wallet.
-- Every entry belongs to exactly one of transaction_id / topup_id, never both.
CREATE TABLE ledger_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  topup_id       UUID REFERENCES topups(id),
  wallet_id      UUID NOT NULL REFERENCES wallets(id),
  entry_type     VARCHAR(6) NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  currency       VARCHAR(3) NOT NULL,
  amount         DECIMAL(18,6) NOT NULL CHECK (amount > 0),
  balance_after  DECIMAL(18,6) NOT NULL,   -- snapshot of balance after this entry
  created_at     TIMESTAMP DEFAULT NOW(),
  CHECK ((transaction_id IS NOT NULL) <> (topup_id IS NOT NULL))
);

-- ─── Audit log ────────────────────────────────────────────────────────────────
-- Immutable record of every state change — required by MAS TRM guidelines
-- Never deleted, never updated — only appended
CREATE TABLE audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  user_id        UUID REFERENCES users(id),
  event_type     VARCHAR(50) NOT NULL,  -- e.g. TRANSACTION_CREATED, FRAUD_FLAGGED
  old_status     VARCHAR(20),
  new_status     VARCHAR(20),
  metadata       JSONB,                 -- any extra context
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ─── Fraud rules log ──────────────────────────────────────────────────────────
-- Records which fraud rules fired on each transaction
CREATE TABLE fraud_checks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  rule_name      VARCHAR(100) NOT NULL,
  triggered      BOOLEAN NOT NULL,
  details        TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_transactions_sender   ON transactions(sender_id);
CREATE INDEX idx_transactions_receiver ON transactions(receiver_id);
CREATE INDEX idx_transactions_status   ON transactions(status);
CREATE INDEX idx_ledger_wallet         ON ledger_entries(wallet_id);
CREATE INDEX idx_ledger_transaction    ON ledger_entries(transaction_id);
CREATE INDEX idx_audit_transaction     ON audit_log(transaction_id);
CREATE INDEX idx_audit_user            ON audit_log(user_id);
CREATE INDEX idx_wallets_user          ON wallets(user_id);
CREATE INDEX idx_topups_user           ON topups(user_id);
