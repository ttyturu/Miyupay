import request from 'supertest';
import app from '../app';
import { db } from '../utils/db';
import { registerAndVerify } from './testUtils';

afterAll(async () => {
  await db.pool.end();
});

// Freezes "now" (only Date, real timers stay real so supertest's async I/O keeps working).
const freezeAt = (isoWithOffset: string) => {
  jest.useFakeTimers({
    doNotFake: [
      'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'setImmediate', 'clearImmediate', 'nextTick', 'hrtime', 'performance', 'queueMicrotask',
    ],
  });
  jest.setSystemTime(new Date(isoWithOffset));
};
const unfreeze = () => jest.useRealTimers();

const NORMAL_HOUR_SGT = '2026-01-05T14:00:00+08:00'; // 2pm SGT — well outside the 1-5am window
const UNUSUAL_HOUR_SGT = '2026-01-05T02:30:00+08:00'; // 2:30am SGT

describe('POST /api/transactions/send', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/transactions/send')
      .send({ receiverEmail: 'nobody@test.miyupay.dev', senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid amount', async () => {
    const { token } = await registerAndVerify();
    const res = await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiverEmail: 'nobody@test.miyupay.dev', senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects sending to an unknown recipient', async () => {
    const { token } = await registerAndVerify();
    const res = await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiverEmail: 'nobody@test.miyupay.dev', senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });
    expect(res.status).toBe(404);
  });

  it('rejects sending to yourself', async () => {
    const { token, user } = await registerAndVerify();
    const res = await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiverEmail: user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects insufficient balance', async () => {
    freezeAt(NORMAL_HOUR_SGT);
    try {
      const sender = await registerAndVerify();
      const receiver = await registerAndVerify();
      // Starter SGD balance is 1000. Stay under the 5,000 LARGE_AMOUNT threshold
      // so this exercises the balance check itself, not the fraud block.
      const res = await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 4000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/insufficient balance/i);
    } finally { unfreeze(); }
  });

  it('completes a normal transfer and moves the balance', async () => {
    freezeAt(NORMAL_HOUR_SGT);
    try {
      const sender = await registerAndVerify();
      const receiver = await registerAndVerify();

      // First transfer to this recipient during normal hours — should NOT be
      // blocked, even though NEW_RECIPIENT is triggered on its own.
      const res = await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 50 });

      expect(res.status).toBe(201);
      expect(res.body.flagged).toBe(false);
      expect(res.body.transaction.status).toBe('completed');

      const wallets = await request(app).get('/api/wallet').set('Authorization', `Bearer ${sender.token}`);
      const sgd = wallets.body.find((w: any) => w.currency === 'SGD');
      expect(Number(sgd.balance)).toBe(950); // starter balance 1000 - 50
    } finally { unfreeze(); }
  });

  it('blocks a large amount (LARGE_AMOUNT rule) regardless of hour', async () => {
    freezeAt(NORMAL_HOUR_SGT);
    try {
      const sender = await registerAndVerify();
      const receiver = await registerAndVerify();
      const res = await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 6000 });

      expect(res.status).toBe(201);
      expect(res.body.flagged).toBe(true);
      expect(res.body.transaction.status).toBe('flagged');
    } finally { unfreeze(); }
  });

  it('blocks a large cross-border transfer (LARGE_CROSS_BORDER rule)', async () => {
    freezeAt(NORMAL_HOUR_SGT);
    try {
      const sender = await registerAndVerify();
      const receiver = await registerAndVerify();
      const res = await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'MYR', amount: 2500 });

      expect(res.status).toBe(201);
      expect(res.body.flagged).toBe(true);
    } finally { unfreeze(); }
  });

  it('does NOT block a first-time recipient during normal hours', async () => {
    freezeAt(NORMAL_HOUR_SGT);
    try {
      const sender = await registerAndVerify();
      const receiver = await registerAndVerify();
      const res = await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 20 });

      expect(res.body.flagged).toBe(false);
    } finally { unfreeze(); }
  });

  it('does NOT block an existing recipient during an unusual hour', async () => {
    const sender = await registerAndVerify();
    const receiver = await registerAndVerify();

    // First, establish the relationship during normal hours.
    freezeAt(NORMAL_HOUR_SGT);
    await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });
    unfreeze();

    // Then send again at an unusual hour — recipient is no longer new.
    freezeAt(UNUSUAL_HOUR_SGT);
    try {
      const res = await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });

      expect(res.body.flagged).toBe(false);
    } finally { unfreeze(); }
  });

  it('blocks a first-time recipient combined with an unusual hour', async () => {
    freezeAt(UNUSUAL_HOUR_SGT);
    try {
      const sender = await registerAndVerify();
      const receiver = await registerAndVerify();
      const res = await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });

      expect(res.status).toBe(201);
      expect(res.body.flagged).toBe(true);
      expect(res.body.transaction.status).toBe('flagged');
      expect(res.body.transaction.fraud_reason).toMatch(/first transaction/i);
      expect(res.body.transaction.fraud_reason).toMatch(/unusual hour/i);
    } finally { unfreeze(); }
  });
});

describe('GET /api/transactions/recipient-check', () => {
  it('reports a never-paid recipient as new', async () => {
    const sender = await registerAndVerify();
    const receiver = await registerAndVerify();

    const res = await request(app).get('/api/transactions/recipient-check')
      .query({ email: receiver.user.email })
      .set('Authorization', `Bearer ${sender.token}`);

    expect(res.status).toBe(200);
    expect(res.body.isNewRecipient).toBe(true);
  });

  it('reports a previously-paid recipient as not new', async () => {
    freezeAt(NORMAL_HOUR_SGT);
    try {
      const sender = await registerAndVerify();
      const receiver = await registerAndVerify();
      await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 5 });

      const res = await request(app).get('/api/transactions/recipient-check')
        .query({ email: receiver.user.email })
        .set('Authorization', `Bearer ${sender.token}`);

      expect(res.body.isNewRecipient).toBe(false);
    } finally { unfreeze(); }
  });
});

describe('GET /api/transactions/recent-recipients', () => {
  it('returns an empty list for a sender with no transactions', async () => {
    const sender = await registerAndVerify();

    const res = await request(app).get('/api/transactions/recent-recipients')
      .set('Authorization', `Bearer ${sender.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns distinct recipients ordered by most recent transaction', async () => {
    freezeAt(NORMAL_HOUR_SGT);
    try {
      const sender = await registerAndVerify();
      const receiverA = await registerAndVerify();
      const receiverB = await registerAndVerify();

      await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiverA.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 5 });
      // Send to A again — should still only appear once in the list.
      await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiverA.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 5 });
      await request(app).post('/api/transactions/send')
        .set('Authorization', `Bearer ${sender.token}`)
        .send({ receiverEmail: receiverB.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 5 });

      const res = await request(app).get('/api/transactions/recent-recipients')
        .set('Authorization', `Bearer ${sender.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      // Most recently sent-to (B) should come first.
      expect(res.body[0].email).toBe(receiverB.user.email);
      expect(res.body[1].email).toBe(receiverA.user.email);
      expect(res.body[0]).toHaveProperty('fullName');
    } finally { unfreeze(); }
  });
});
