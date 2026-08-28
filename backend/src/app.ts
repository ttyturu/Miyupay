import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import topupRoutes from './routes/topup';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhooks';
import { walletRouter } from './routes/wallet';
import { errorHandler } from './middleware/errorHandler';
import { db } from './utils/db';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

// MUST come before express.json() — Stripe signs the raw request bytes, so the
// webhook route needs the unparsed body to verify the signature.
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());
const isTest = process.env.NODE_ENV === 'test';
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, skip: () => isTest }));

// Auth endpoints get a tighter limit — brute-forcing login/register/reset-code
// guesses shouldn't be as easy as any other API call.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skip: () => isTest });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallet',       walletRouter);
app.use('/api/topup',        topupRoutes);
app.use('/api/admin',        adminRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'MiyuPay v3', db: 'connected' });
  } catch (_err) {
    res.status(503).json({ status: 'error', service: 'MiyuPay v3', db: 'unreachable' });
  }
});

app.use(errorHandler);

export default app;
