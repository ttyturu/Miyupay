import { db } from '../utils/db';
import { registerAndVerify } from './testUtils';
import { creditTopup, expireTopup } from '../services/topupCreditService';

afterAll(async () => {
  await db.pool.end();
});

const insertTopup = async (userId: string, status = 'pending', amount = 50) => {
  const { rows: [topup] } = await db.query<{ id: string }>(
    `INSERT INTO topups (user_id,stripe_session_id,currency,amount,status)
     VALUES ($1,$2,'SGD',$3,$4) RETURNING id`,
    [userId, `cs_test_${Date.now()}_${Math.random().toString(36).slice(2)}`, amount, status]
  );
  return topup.id;
};

const balanceOf = async (userId: string): Promise<number> => {
  const { rows: [w] } = await db.query<{ balance: string }>(
    `SELECT balance FROM wallets WHERE user_id=$1 AND currency='SGD'`, [userId]
  );
  return Number(w.balance);
};

// Exercises creditTopup itself rather than a copy of its SQL, so the test fails
// if the real implementation regresses. Both confirmation paths (the browser
// redirect and the Stripe webhook) funnel through this one function and race
// each other in production, so idempotency here is what stops a wallet being
// credited twice.
describe('creditTopup', () => {
  it('credits exactly once when two callers race the same top-up', async () => {
    const { user } = await registerAndVerify();
    const topupId = await insertTopup(user.id);
    const before = await balanceOf(user.id);

    // Simulates the webhook and the success page landing simultaneously.
    const [a, b] = await Promise.all([creditTopup(topupId), creditTopup(topupId)]);

    // Exactly one did the work; the loser reports the same balance rather than
    // erroring, so the success page still renders correctly.
    expect([a.credited, b.credited].filter(Boolean)).toHaveLength(1);
    expect(await balanceOf(user.id)).toBe(before + 50);

    const { rows: [final] } = await db.query<{ status: string }>(
      'SELECT status FROM topups WHERE id=$1', [topupId]
    );
    expect(final.status).toBe('completed');

    // Double-entry intact: one DEBIT (clearing) + one CREDIT (user), not four.
    const { rows: [entries] } = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM ledger_entries WHERE topup_id=$1', [topupId]
    );
    expect(Number(entries.count)).toBe(2);
  });

  it('still credits a top-up Stripe confirms as paid after it was marked expired', async () => {
    const { user } = await registerAndVerify();
    const topupId = await insertTopup(user.id, 'expired');
    const before = await balanceOf(user.id);

    // Callers only reach creditTopup once Stripe says "paid", and Stripe is
    // authoritative about payment — so a stale expiry must not strand money.
    const result = await creditTopup(topupId);

    expect(result.credited).toBe(true);
    expect(await balanceOf(user.id)).toBe(before + 50);
  });

  it('never un-credits a completed top-up when a late expiry event arrives', async () => {
    const { user } = await registerAndVerify();
    const topupId = await insertTopup(user.id);
    await creditTopup(topupId);
    const after = await balanceOf(user.id);

    await expireTopup(topupId);

    const { rows: [final] } = await db.query<{ status: string }>(
      'SELECT status FROM topups WHERE id=$1', [topupId]
    );
    expect(final.status).toBe('completed');
    expect(await balanceOf(user.id)).toBe(after);
  });
});
