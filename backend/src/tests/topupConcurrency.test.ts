import { db } from '../utils/db';
import { registerAndVerify } from './testUtils';

afterAll(async () => {
  await db.pool.end();
});

// Exercises the exact atomic-claim statement confirmTopup relies on, without
// needing a real Stripe session — proves that firing the same claim twice at
// once only ever lets one of them "win" pending -> completed, which is what
// stops a page refresh / double-tab from crediting a wallet twice.
describe('Top-up atomic claim (race-condition fix)', () => {
  it('only lets one of two concurrent claims succeed on the same pending top-up', async () => {
    const { user } = await registerAndVerify();
    const { rows: [topup] } = await db.query<{ id: string }>(
      `INSERT INTO topups (user_id,stripe_session_id,currency,amount,status)
       VALUES ($1,$2,'SGD',50,'pending') RETURNING id`,
      [user.id, `cs_test_race_${Date.now()}`]
    );

    const claim = () => db.query<{ id: string }>(
      `UPDATE topups SET status='completed', completed_at=NOW()
       WHERE id=$1 AND status='pending' RETURNING id`,
      [topup.id]
    );

    const [a, b] = await Promise.all([claim(), claim()]);
    const successCount = [a, b].filter(r => r.rows.length === 1).length;

    expect(successCount).toBe(1);

    const { rows: [final] } = await db.query<{ status: string }>(
      'SELECT status FROM topups WHERE id=$1', [topup.id]
    );
    expect(final.status).toBe('completed');
  });
});
