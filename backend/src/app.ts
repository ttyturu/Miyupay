import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import { walletRouter, auditRouter } from './routes/walletAndAudit';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallet',       walletRouter);
app.use('/api/audit',        auditRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'MiyuPay v3' }));

app.use(errorHandler);

export default app;
