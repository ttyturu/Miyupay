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
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
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
  balance    DECIMAL(18,6) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, currency)
);

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
  note              TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  completed_at      TIMESTAMP,
  CHECK (sender_id != receiver_id)
);

-- ─── Ledger entries ───────────────────────────────────────────────────────────
-- Double-entry: every transaction produces exactly 2 entries
-- One DEBIT (money leaves sender), one CREDIT (money arrives at receiver)
-- This is how every regulated financial institution tracks money
CREATE TABLE ledger_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  wallet_id      UUID NOT NULL REFERENCES wallets(id),
  entry_type     VARCHAR(6) NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  currency       VARCHAR(3) NOT NULL,
  amount         DECIMAL(18,6) NOT NULL CHECK (amount > 0),
  balance_after  DECIMAL(18,6) NOT NULL,   -- snapshot of balance after this entry
  created_at     TIMESTAMP DEFAULT NOW()
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
