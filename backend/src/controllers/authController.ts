import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../utils/db';
import { User, Currency, Country } from '../types';

const STARTER_BALANCES: Record<Currency, number> = { SGD: 1000, MYR: 3000, THB: 25000 };

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, fullName, country } = req.body as {
      email: string; password: string; fullName: string; country?: Country;
    };

    const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows[0]) { res.status(409).json({ error: 'Email already registered' }); return; }

    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await db.query<Pick<User, 'id' | 'email' | 'full_name' | 'country'>>(
      `INSERT INTO users (email,password_hash,full_name,country)
       VALUES ($1,$2,$3,$4) RETURNING id,email,full_name,country`,
      [email, hash, fullName, country ?? 'SGP']
    );

    for (const [currency, balance] of Object.entries(STARTER_BALANCES)) {
      await db.query('INSERT INTO wallets (user_id,currency,balance) VALUES ($1,$2,$3)', [user.id, currency, balance]);
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, country: user.country } });
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

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows: [user] } = await db.query<User>(
      'SELECT id,email,full_name,country,created_at FROM users WHERE id=$1', [req.user!.userId]
    );
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) { next(err); }
};
