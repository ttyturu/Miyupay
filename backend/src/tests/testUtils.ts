import request from 'supertest';
import app from '../app';

let counter = 0;
export const uniqueEmail = (prefix = 'user'): string => {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@test.miyupay.dev`;
};

interface RegisteredUser {
  token: string;
  user: { id: string; email: string; fullName: string; country: string };
}

// Registers + verifies a user through the real HTTP flow (mirrors what the
// frontend does), returning a ready-to-use auth token.
export const registerAndVerify = async (overrides: Partial<{
  email: string; password: string; fullName: string; country: string;
}> = {}): Promise<RegisteredUser> => {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? 'Password123!';
  const fullName = overrides.fullName ?? 'Test User';
  const country = overrides.country ?? 'SGP';

  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password, fullName, country });

  if (registerRes.status !== 201) {
    throw new Error(`Register failed: ${registerRes.status} ${JSON.stringify(registerRes.body)}`);
  }

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ email, code: registerRes.body.verificationCode });

  if (verifyRes.status !== 200) {
    throw new Error(`Verify failed: ${verifyRes.status} ${JSON.stringify(verifyRes.body)}`);
  }

  return { token: verifyRes.body.token, user: verifyRes.body.user };
};
