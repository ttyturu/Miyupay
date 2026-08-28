// Deletes all data created by the test suite (identified by the
// @test.miyupay.dev email domain used in testUtils.uniqueEmail), so repeated
// test runs don't accumulate garbage in the shared dev database.
//
// Every transaction lookup below matches on sender_id OR receiver_id. Matching
// only the sender leaves any transfer a NON-test user sent TO a test user
// undeletable, which then makes the final DELETE FROM users fail on a foreign
// key. Because this all runs as one statement batch, that single orphan row
// aborts the whole teardown and every test user survives — and since
// uniqueEmail() derives from Date.now(), which the fake timers in
// transactions.test.ts freeze to a constant, the NEXT run generates the exact
// same addresses and dies with "Email already registered".
require('dotenv/config');
const { Client } = require('pg');

const TEST_USERS = `SELECT id FROM users WHERE email LIKE '%@test.miyupay.dev'`;
const TEST_TXNS = `
  SELECT id FROM transactions
  WHERE sender_id IN (${TEST_USERS}) OR receiver_id IN (${TEST_USERS})`;
const TEST_TOPUPS = `SELECT id FROM topups WHERE user_id IN (${TEST_USERS})`;

module.exports = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    DELETE FROM fraud_checks   WHERE transaction_id IN (${TEST_TXNS});
    DELETE FROM ledger_entries WHERE transaction_id IN (${TEST_TXNS});
    DELETE FROM ledger_entries WHERE topup_id IN (${TEST_TOPUPS});
    DELETE FROM audit_log      WHERE transaction_id IN (${TEST_TXNS});
    DELETE FROM audit_log      WHERE user_id IN (${TEST_USERS});
    DELETE FROM transactions   WHERE id IN (${TEST_TXNS});
    DELETE FROM topups         WHERE id IN (${TEST_TOPUPS});
    DELETE FROM wallets        WHERE user_id IN (${TEST_USERS});
    DELETE FROM users WHERE email LIKE '%@test.miyupay.dev';
  `);

  await client.end();
};
