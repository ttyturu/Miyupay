// Set before importing the app — the handler reads this per-request, and
// without it the endpoint short-circuits to "not configured".
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_for_signature_checks';

import request from 'supertest';
import Stripe from 'stripe';
import app from '../app';
import { db } from '../utils/db';
import { registerAndVerify } from './testUtils';

afterAll(async () => {
  await db.pool.end();
});

const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// Sends `payload` as the literal request body. Note it must be passed as a
// string, not a Buffer — supertest re-serializes a Buffer into
// {"type":"Buffer","data":[...]}, which changes the bytes and would make even a
// valid signature fail.
const post = (payload: string, secret?: string) => {
  const req = request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json');
  if (secret) {
    req.set('stripe-signature', Stripe.webhooks.generateTestHeaderString({ payload, secret }));
  }
  return req.send(payload);
};

// The webhook endpoint is public and unauthenticated — Stripe has no session to
// present. The signature check is therefore the ONLY thing standing between an
// anonymous POST and free wallet credit, so these tests guard the money.
describe('Stripe webhook signature enforcement', () => {
  it('rejects an unsigned request', async () => {
    const res = await post(JSON.stringify({ type: 'checkout.session.completed' }));
    expect(res.status).toBe(400);
  });

  it('rejects a request signed with the wrong secret', async () => {
    const res = await post(JSON.stringify({ type: 'checkout.session.completed' }), 'whsec_attacker_guess');
    expect(res.status).toBe(400);
  });

  it('does not credit a wallet from a forged "paid" event', async () => {
    const { user } = await registerAndVerify();
    const balance = async () => {
      const { rows: [w] } = await db.query<{ balance: string }>(
        `SELECT balance FROM wallets WHERE user_id=$1 AND currency='SGD'`, [user.id]
      );
      return Number(w.balance);
    };
    const before = await balance(); // new accounts open with a starting balance

    const { rows: [topup] } = await db.query<{ id: string }>(
      `INSERT INTO topups (user_id,stripe_session_id,currency,amount,status)
       VALUES ($1,$2,'SGD',9999,'pending') RETURNING id`,
      [user.id, `cs_test_forged_${Date.now()}`]
    );

    // Exactly the payload an attacker would send to mint themselves credit.
    const forged = JSON.stringify({
      id: 'evt_forged', object: 'event', type: 'checkout.session.completed',
      data: { object: { id: `cs_test_forged_${Date.now()}`, payment_status: 'paid' } },
    });
    const res = await post(forged);

    expect(res.status).toBe(400);
    const { rows: [after] } = await db.query<{ status: string }>(
      'SELECT status FROM topups WHERE id=$1', [topup.id]
    );
    expect(after.status).toBe('pending');
    expect(await balance()).toBe(before); // not credited the forged 9999
  });

  it('accepts a correctly signed event', async () => {
    const payload = JSON.stringify({
      id: 'evt_test', object: 'event', type: 'checkout.session.expired',
      data: { object: { id: 'cs_session_that_does_not_exist' } },
    });
    const res = await post(payload, SECRET);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('marks a top-up expired on a signed checkout.session.expired', async () => {
    const { user } = await registerAndVerify();
    const sessionId = `cs_test_expiry_${Date.now()}`;
    const { rows: [topup] } = await db.query<{ id: string }>(
      `INSERT INTO topups (user_id,stripe_session_id,currency,amount,status)
       VALUES ($1,$2,'SGD',75,'pending') RETURNING id`,
      [user.id, sessionId]
    );

    const payload = JSON.stringify({
      id: 'evt_expired', object: 'event', type: 'checkout.session.expired',
      data: { object: { id: sessionId } },
    });
    const res = await post(payload, SECRET);

    expect(res.status).toBe(200);
    const { rows: [after] } = await db.query<{ status: string }>(
      'SELECT status FROM topups WHERE id=$1', [topup.id]
    );
    expect(after.status).toBe('expired');
  });
});
