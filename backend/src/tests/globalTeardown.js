// Deletes all data created by the test suite (identified by the
// @test.miyupay.dev email domain used in testUtils.uniqueEmail), so repeated
// test runs don't accumulate garbage in the shared dev database.
require('dotenv/config');
const { Client } = require('pg');

module.exports = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    DELETE FROM fraud_checks WHERE transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN users u ON u.id = t.sender_id
      WHERE u.email LIKE '%@test.miyupay.dev'
    );
    DELETE FROM ledger_entries WHERE transaction_id IN (
      SELECT t.id FROM transactions t
      JOIN users u ON u.id = t.sender_id
      WHERE u.email LIKE '%@test.miyupay.dev'
    );
    DELETE FROM ledger_entries WHERE topup_id IN (
      SELECT tp.id FROM topups tp
      JOIN users u ON u.id = tp.user_id
      WHERE u.email LIKE '%@test.miyupay.dev'
    );
    DELETE FROM audit_log WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test.miyupay.dev'
    );
    DELETE FROM transactions WHERE sender_id IN (
      SELECT id FROM users WHERE email LIKE '%@test.miyupay.dev'
    );
    DELETE FROM topups WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%@test.miyupay.dev'
    );
    DELETE FROM users WHERE email LIKE '%@test.miyupay.dev';
  `);

  await client.end();
};
