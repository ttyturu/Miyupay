import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../utils/db';
import { User, Currency, Country } from '../types';

const STARTER_BALANCES: Record<Currency, number> = { SGD: 1000, MYR: 3000, THB: 25000 };

// Generates a 6-digit code and returns it directly in the API response instead of
// emailing it — this is a portfolio-demo mock, no real email provider is wired up.
const generateVerificationCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, fullName, country } = req.body as {
      email: string; password: string; fullName: string; country?: Country;
    };

    const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows[0]) { res.status(409).json({ error: 'Email already registered' }); return; }

    const hash = await bcrypt.hash(password, 12);
    const verificationCode = generateVerificationCode();
    const { rows: [user] } = await db.query<Pick<User, 'id' | 'email' | 'full_name' | 'country'>>(
      `INSERT INTO users (email,password_hash,full_name,country,verification_code)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,email,full_name,country`,
      [email, hash, fullName, country ?? 'SGP', verificationCode]
    );

    for (const [currency, balance] of Object.entries(STARTER_BALANCES)) {
      await db.query('INSERT INTO wallets (user_id,currency,balance) VALUES ($1,$2,$3)', [user.id, currency, balance]);
    }

    res.status(201).json({
      user: { id: user.id, email: user.email, fullName: user.full_name, country: user.country },
      verificationCode,
    });
  } catch (err) { next(err); }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, code } = req.body as { email: string; code: string };

    const { rows: [user] } = await db.query<User & { verification_code: string | null }>(
      'SELECT * FROM users WHERE email=$1', [email]
    );
    if (!user || user.verification_code !== code) {
      res.status(400).json({ error: 'Invalid verification code' }); return;
    }

    await db.query(
      'UPDATE users SET is_verified=TRUE, verification_code=NULL WHERE id=$1',
      [user.id]
    );

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, country: user.country } });
  } catch (err) { next(err); }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const { rows: [user] } = await db.query<User & { password_hash: string }>(
      'SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email]
    );
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password' }); return;
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, country: user.country } });
  } catch (err) { next(err); }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body as { email: string };

    const { rows: [user] } = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE email=$1 AND is_active=TRUE', [email]
    );
    if (!user) { res.status(404).json({ error: 'No account with that email' }); return; }

    const resetCode = generateVerificationCode();
    await db.query('UPDATE users SET reset_code=$1 WHERE id=$2', [resetCode, user.id]);

    // Mocked — no real email sent, the code is returned directly for this demo.
    res.json({ resetCode });
  } catch (err) { next(err); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body as { email: string; code: string; newPassword: string };

    const { rows: [user] } = await db.query<{ id: string; reset_code: string | null }>(
      'SELECT id, reset_code FROM users WHERE email=$1', [email]
    );
    if (!user || !user.reset_code || user.reset_code !== code) {
      res.status(400).json({ error: 'Invalid or expired reset code' }); return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash=$1, reset_code=NULL WHERE id=$2', [hash, user.id]);

    res.json({ message: 'Password reset — you can now log in with your new password.' });
  } catch (err) { next(err); }
};

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows: [user] } = await db.query<User>(
      'SELECT id,email,full_name,country,created_at FROM users WHERE id=$1', [req.user!.userId]
    );
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) { next(err); }
};
