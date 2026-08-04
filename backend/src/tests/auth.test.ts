import request from 'supertest';
import app from '../app';
import { db } from '../utils/db';
import { uniqueEmail, registerAndVerify } from './testUtils';

afterAll(async () => {
  await db.pool.end();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns a verification code instead of a token', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', fullName: 'Alice Tan', country: 'SGP' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.token).toBeUndefined();
    expect(res.body.verificationCode).toMatch(/^\d{6}$/);
  });

  it('rejects a duplicate email', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register')
      .send({ email, password: 'Password123!', fullName: 'Alice Tan', country: 'SGP' });

    const res = await request(app).post('/api/auth/register')
      .send({ email, password: 'Password123!', fullName: 'Alice Tan', country: 'SGP' });

    expect(res.status).toBe(409);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: uniqueEmail(), password: 'short', fullName: 'Alice Tan', country: 'SGP' });

    expect(res.status).toBe(400);
    expect(res.body.fields.password).toBeDefined();
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'Password123!', fullName: 'Alice Tan', country: 'SGP' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/verify-email', () => {
  it('rejects an incorrect code', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register')
      .send({ email, password: 'Password123!', fullName: 'Alice Tan', country: 'SGP' });

    const res = await request(app).post('/api/auth/verify-email').send({ email, code: '000000' });
    expect(res.status).toBe(400);
  });

  it('verifies with the correct code and returns a usable token', async () => {
    const { token, user } = await registerAndVerify();
    expect(token).toBeDefined();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(user.id);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const email = uniqueEmail();
    const password = 'Password123!';
    await registerAndVerify({ email, password });

    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects an incorrect password', async () => {
    const email = uniqueEmail();
    await registerAndVerify({ email, password: 'Password123!' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'WrongPassword1!' });
    expect(res.status).toBe(401);
  });

  it('rejects a non-existent email', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: uniqueEmail(), password: 'Password123!' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns a reset code for an existing account', async () => {
    const { user } = await registerAndVerify();

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(res.status).toBe(200);
    expect(res.body.resetCode).toMatch(/^\d{6}$/);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail() });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('rejects an incorrect code', async () => {
    const { user } = await registerAndVerify();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });

    const res = await request(app).post('/api/auth/reset-password')
      .send({ email: user.email, code: '000000', newPassword: 'NewPassword123!' });
    expect(res.status).toBe(400);
  });

  it('resets the password and allows login with the new one', async () => {
    const email = uniqueEmail();
    await registerAndVerify({ email, password: 'OldPassword123!' });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    const resetCode = forgot.body.resetCode;

    const reset = await request(app).post('/api/auth/reset-password')
      .send({ email, code: resetCode, newPassword: 'NewPassword123!' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: 'OldPassword123!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ email, password: 'NewPassword123!' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.token).toBeDefined();
  });

  it('rejects reusing the same reset code twice', async () => {
    const email = uniqueEmail();
    await registerAndVerify({ email, password: 'OldPassword123!' });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    const resetCode = forgot.body.resetCode;

    await request(app).post('/api/auth/reset-password')
      .send({ email, code: resetCode, newPassword: 'NewPassword123!' });

    const secondAttempt = await request(app).post('/api/auth/reset-password')
      .send({ email, code: resetCode, newPassword: 'AnotherPassword123!' });
    expect(secondAttempt.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
