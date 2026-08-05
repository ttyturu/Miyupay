// Jest globalSetup runs once, outside the transformed test environment — plain
// JS/CommonJS, no ts-jest transform applied here.
//
// The local `miyupay` Postgres role has no CREATEDB privilege, so tests run
// against the same dev database (using a distinct @test.miyupay.dev email
// domain for isolation) rather than a dedicated test database. This also
// applies any schema changes that were added to schema.sql after the dev DB
// volume was first initialized, since there's no migration tool in this repo.
require('dotenv/config');
const { Client } = require('pg');

module.exports = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(6);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS risk_score INT NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS topups (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            UUID NOT NULL REFERENCES users(id),
      stripe_session_id  VARCHAR(255) UNIQUE NOT NULL,
      currency           VARCHAR(3) NOT NULL,
      amount             DECIMAL(18,6) NOT NULL CHECK (amount > 0),
      status             VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at         TIMESTAMP DEFAULT NOW(),
      completed_at       TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_topups_user ON topups(user_id);

    ALTER TABLE topups ADD COLUMN IF NOT EXISTS fraud_flagged BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE topups ADD COLUMN IF NOT EXISTS fraud_reason TEXT;
    ALTER TABLE topups ADD COLUMN IF NOT EXISTS risk_score INT NOT NULL DEFAULT 0;

    -- Clearing wallet: give it a legitimately-negative balance by exempting
    -- it from the normal non-negative check.
    ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_balance_check;
    ALTER TABLE wallets ADD CONSTRAINT wallets_balance_check CHECK (balance >= 0 OR is_system);

    -- Ledger entries can now belong to a top-up instead of a transaction.
    ALTER TABLE ledger_entries ALTER COLUMN transaction_id DROP NOT NULL;
    ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS topup_id UUID REFERENCES topups(id);
    ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_ref_check;
    ALTER TABLE ledger_entries ADD CONSTRAINT ledger_ref_check
      CHECK ((transaction_id IS NOT NULL) <> (topup_id IS NOT NULL));

    -- Reserved clearing account — the double-entry counterparty for top-ups.
    INSERT INTO users (id, email, password_hash, full_name, role, is_verified) VALUES
      ('00000000-0000-0000-0000-000000000001', 'system.clearing@miyupay.internal',
       '$2a$12$DuxRLhp6/YnkLJqPmtgMu.9tj/iTacYD/3wCC0t8IrtK7CREhaDCW',
       'MiyuPay Clearing (Stripe)', 'user', TRUE)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO wallets (user_id, currency, balance, is_system) VALUES
      ('00000000-0000-0000-0000-000000000001', 'SGD', 0, TRUE)
    ON CONFLICT (user_id, currency) DO NOTHING;
  `);

  await client.end();
};
