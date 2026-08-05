import { db } from '../utils/db';
import { runTopupFraudChecks } from '../services/topupFraudService';
import { registerAndVerify } from './testUtils';

afterAll(async () => {
  await db.pool.end();
});

const insertTopup = async (userId: string) => {
  await db.query(
    `INSERT INTO topups (user_id,stripe_session_id,currency,amount) VALUES ($1,$2,'SGD',50)`,
    [userId, `cs_test_${Date.now()}_${Math.random()}`]
  );
};

describe('runTopupFraudChecks (TOPUP_VELOCITY)', () => {
  it('does not flag a first attempt', async () => {
    const { user } = await registerAndVerify();
    const result = await runTopupFraudChecks(user.id);
    expect(result.flagged).toBe(false);
    expect(result.riskScore).toBe(0);
  });

  it('does not flag two attempts within the window', async () => {
    const { user } = await registerAndVerify();
    await insertTopup(user.id);
    const result = await runTopupFraudChecks(user.id);
    expect(result.flagged).toBe(false);
  });

  it('flags the 3rd attempt within 10 minutes, weight 35', async () => {
    const { user } = await registerAndVerify();
    await insertTopup(user.id);
    await insertTopup(user.id);
    const result = await runTopupFraudChecks(user.id);
    expect(result.flagged).toBe(true);
    expect(result.riskScore).toBe(35);
    expect(result.reason).toMatch(/3 top-up attempts/i);
  });
});
