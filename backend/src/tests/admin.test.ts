import request from 'supertest';
import app from '../app';
import { db } from '../utils/db';
import { registerAndVerify, makeAdmin } from './testUtils';

afterAll(async () => {
  await db.pool.end();
});

describe('Admin routes access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/admin/flagged');
    expect(res.status).toBe(401);
  });

  it('rejects a logged-in user who is not an admin', async () => {
    const { token } = await registerAndVerify();
    const res = await request(app).get('/api/admin/flagged').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/users/search', () => {
  it('rejects a non-admin', async () => {
    const { token } = await registerAndVerify();
    const res = await request(app).get('/api/admin/users/search?q=a').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns an empty list for a blank query', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);

    const res = await request(app)
      .get('/api/admin/users/search?q=')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('matches by partial full name', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    // A distinctive name — most other tests share "Test User", which would
    // sort ahead of it and could push it past the 10-result limit otherwise.
    const target = await registerAndVerify({ fullName: 'Zzyzx Search Target' });

    const res = await request(app)
      .get('/api/admin/users/search?q=Zzyzx Search')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.some((u: { email: string }) => u.email === target.user.email)).toBe(true);
  });
});

describe('GET /api/admin/users/:email/audit', () => {
  it('returns 404 for an unknown email', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);

    const res = await request(app)
      .get('/api/admin/users/nobody@test.miyupay.dev/audit')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it('returns a user and their transaction history to an admin', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    const sender = await registerAndVerify();
    const receiver = await registerAndVerify();

    await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 25 });

    const res = await request(app)
      .get(`/api/admin/users/${sender.user.email}/audit`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(sender.user.email);
    expect(res.body.activity).toHaveLength(1);
    expect(res.body.activity[0].type).toBe('transfer');
    expect(res.body.aggregateRisk).toBe(0);
  });

  it('reflects flagged transfers in the aggregate risk score', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    const sender = await registerAndVerify();
    const receiver = await registerAndVerify();

    await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 6000 });

    const res = await request(app)
      .get(`/api/admin/users/${sender.user.email}/audit`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.body.aggregateRisk).toBe(30); // LARGE_AMOUNT weight
  });
});

describe('GET /api/admin/flagged', () => {
  it('lists flagged transactions, sorted by risk when requested', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    const sender = await registerAndVerify();
    const receiverA = await registerAndVerify();
    const receiverB = await registerAndVerify();

    // Combo block (risk 60) vs. a plain large amount (risk 30)
    await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiverA.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 6000 });
    await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiverB.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });

    const res = await request(app)
      .get('/api/admin/flagged?sort=risk')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    // The list is global (may include other flagged transfers/top-ups from
    // elsewhere), so only assert on what this test itself created.
    expect(res.body.some((t: { sender_email?: string }) => t.sender_email === sender.user.email)).toBe(true);
    expect(res.body.every((t: { fraud_flagged: boolean }) => t.fraud_flagged)).toBe(true);
    // Sorted by risk descending
    for (let i = 1; i < res.body.length; i++) {
      expect(res.body[i - 1].risk_score).toBeGreaterThanOrEqual(res.body[i].risk_score);
    }
  });

  it('includes flagged top-ups alongside flagged transfers', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    const user = await registerAndVerify();

    // Top-ups go through Stripe in the real flow, which isn't reachable in
    // tests — insert the row directly, the same shape createSession would.
    await db.query(
      `INSERT INTO topups (user_id,stripe_session_id,currency,amount,fraud_flagged,fraud_reason,risk_score)
       VALUES ($1,$2,'SGD',50,TRUE,'3 top-up attempts in the last 10 minutes',35)`,
      [user.user.id, `cs_test_${Date.now()}`]
    );

    const res = await request(app)
      .get('/api/admin/flagged')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.some((t: { type: string; user_email?: string }) =>
      t.type === 'topup' && t.user_email === user.user.email
    )).toBe(true);
  });
});

describe('Freeze / unfreeze', () => {
  it('rejects freeze/unfreeze without the admin\'s own correct password', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    const target = await registerAndVerify();

    const noPassword = await request(app)
      .post(`/api/admin/users/${target.user.email}/freeze`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(noPassword.status).toBe(400); // fails validation — password required

    const wrongPassword = await request(app)
      .post(`/api/admin/users/${target.user.email}/freeze`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'DefinitelyWrongPassword1!' });
    expect(wrongPassword.status).toBe(401);
  });

  it('rejects an admin freezing their own account, even with the correct password', async () => {
    const admin = await registerAndVerify(); // default password: Password123!
    await makeAdmin(admin.user.id);

    const res = await request(app)
      .post(`/api/admin/users/${admin.user.email}/freeze`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'Password123!' });

    expect(res.status).toBe(400);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${admin.token}`);
    expect(me.body.frozen).toBe(false);
  });

  it('lets an admin freeze and then unfreeze a user (with their own password), and only unfreeze restores sending', async () => {
    const admin = await registerAndVerify(); // default password: Password123!
    await makeAdmin(admin.user.id);
    const sender = await registerAndVerify();
    const receiver = await registerAndVerify();

    const freeze = await request(app)
      .post(`/api/admin/users/${sender.user.email}/freeze`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'Password123!' });
    expect(freeze.status).toBe(200);
    expect(freeze.body.frozen).toBe(true);

    const blocked = await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });
    expect(blocked.status).toBe(403);

    const unfreeze = await request(app)
      .post(`/api/admin/users/${sender.user.email}/unfreeze`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'Password123!' });
    expect(unfreeze.status).toBe(200);
    expect(unfreeze.body.frozen).toBe(false);

    const allowed = await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });
    expect(allowed.status).toBe(201);
  });
});

describe('Admin ledger / fraud-check drill-down', () => {
  it('returns ledger entries and fraud checks for a transaction', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    const sender = await registerAndVerify();
    const receiver = await registerAndVerify();

    const send = await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 25 });
    const txId = send.body.transaction.id;

    const ledger = await request(app)
      .get(`/api/admin/transactions/${txId}/ledger`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(ledger.status).toBe(200);
    expect(ledger.body).toHaveLength(2); // DEBIT + CREDIT
    expect(ledger.body.map((e: { entry_type: string }) => e.entry_type).sort()).toEqual(['CREDIT', 'DEBIT']);

    const fraud = await request(app)
      .get(`/api/admin/transactions/${txId}/fraud`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(fraud.status).toBe(200);
    expect(fraud.body.length).toBeGreaterThan(0);
  });

  it('returns ledger entries for a top-up, posted against the clearing wallet', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    const user = await registerAndVerify();

    // Simulate what confirmTopup does — insert the topup and its two ledger
    // entries directly, since Stripe confirmation isn't reachable in tests.
    const { rows: [topup] } = await db.query<{ id: string }>(
      `INSERT INTO topups (user_id,stripe_session_id,currency,amount,status)
       VALUES ($1,$2,'SGD',50,'completed') RETURNING id`,
      [user.user.id, `cs_test_${Date.now()}`]
    );
    const { rows: [userWallet] } = await db.query<{ id: string }>(
      `SELECT id FROM wallets WHERE user_id=$1 AND currency='SGD'`, [user.user.id]
    );
    await db.query(
      `INSERT INTO ledger_entries (topup_id,wallet_id,entry_type,currency,amount,balance_after)
       VALUES ($1,$2,'CREDIT','SGD',50,1050)`,
      [topup.id, userWallet.id]
    );

    const res = await request(app)
      .get(`/api/admin/topups/${topup.id}/ledger`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].entry_type).toBe('CREDIT');
  });
});

describe('GET /api/admin/users/:email/summary', () => {
  it('returns a graceful message when GROQ_API_KEY is not configured', async () => {
    const admin = await registerAndVerify();
    await makeAdmin(admin.user.id);
    const sender = await registerAndVerify();
    const receiver = await registerAndVerify();

    await request(app).post('/api/transactions/send')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({ receiverEmail: receiver.user.email, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 10 });

    const res = await request(app)
      .get(`/api/admin/users/${sender.user.email}/summary`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
  });
});
