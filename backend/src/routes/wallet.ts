import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { authenticate } from '../middleware/auth';
import { Currency } from '../types';

export const walletRouter = Router();
walletRouter.use(authenticate);

walletRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM wallets WHERE user_id=$1 ORDER BY currency',
      [req.user!.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

walletRouter.post('/convert', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { fromCurrency, toCurrency, amount } = req.body as {
    fromCurrency?: Currency;
    toCurrency?: Currency;
    amount?: number;
  };
  const supportedCurrencies: Currency[] = ['SGD', 'MYR', 'THB'];
  const sourceAmount = Number(amount);

  if (!supportedCurrencies.includes(fromCurrency as Currency) || !supportedCurrencies.includes(toCurrency as Currency)) {
    res.status(400).json({ error: 'Choose supported currencies' });
    return;
  }
  if (fromCurrency === toCurrency) {
    res.status(400).json({ error: 'Choose two different currencies' });
    return;
  }
  if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    res.status(400).json({ error: 'Enter a valid amount' });
    return;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: rateRows } = await client.query<{ rate: string }>(
      'SELECT rate FROM exchange_rates WHERE from_currency=$1 AND to_currency=$2',
      [fromCurrency, toCurrency]
    );
    if (!rateRows[0]) throw Object.assign(new Error('Currency pair not supported'), { status: 400 });

    const exchangeRate = Number(rateRows[0].rate);
    const receivedAmount = Number((sourceAmount * exchangeRate).toFixed(6));
    const { rows: debitRows } = await client.query<{ balance: string }>(
      `UPDATE wallets SET balance=balance-$1, updated_at=NOW()
       WHERE user_id=$2 AND currency=$3 AND balance >= $1
       RETURNING balance`,
      [sourceAmount, req.user!.userId, fromCurrency]
    );
    if (!debitRows[0]) throw Object.assign(new Error('Insufficient balance'), { status: 400 });

    const { rows: creditRows } = await client.query<{ balance: string }>(
      `UPDATE wallets SET balance=balance+$1, updated_at=NOW()
       WHERE user_id=$2 AND currency=$3
       RETURNING balance`,
      [receivedAmount, req.user!.userId, toCurrency]
    );
    if (!creditRows[0]) throw Object.assign(new Error('Destination wallet not found'), { status: 404 });

    await client.query(
      `INSERT INTO audit_log (user_id,event_type,metadata)
       VALUES ($1,'WALLET_CONVERTED',$2)`,
      [req.user!.userId, JSON.stringify({ fromCurrency, toCurrency, sourceAmount, receivedAmount, exchangeRate })]
    );
    await client.query('COMMIT');
    res.status(201).json({
      fromCurrency,
      toCurrency,
      sourceAmount,
      receivedAmount,
      exchangeRate,
      sourceBalance: Number(debitRows[0].balance),
      destinationBalance: Number(creditRows[0].balance),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
