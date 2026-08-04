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
  `);

  await client.end();
};
