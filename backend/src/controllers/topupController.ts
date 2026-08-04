import { Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { stripe } from '../services/stripeService';

export const createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!stripe) {
      res.status(503).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to enable top-ups.' });
      return;
    }
    const { amount } = req.body as { amount: number };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'sgd',
          product_data: { name: 'MiyuPay Wallet Top-up' },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/topup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/topup`,
    });

    await db.query(
      `INSERT INTO topups (user_id,stripe_session_id,currency,amount) VALUES ($1,$2,'SGD',$3)`,
      [req.user!.userId, session.id, amount]
    );

    res.json({ url: session.url });
  } catch (err) { next(err); }
};

export const confirmTopup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!stripe) {
      res.status(503).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to enable top-ups.' });
      return;
    }
    const { sessionId } = req.body as { sessionId: string };

    const { rows: [topup] } = await db.query<{
      id: string; user_id: string; amount: string; currency: string; status: string;
    }>('SELECT * FROM topups WHERE stripe_session_id=$1', [sessionId]);

    if (!topup || topup.user_id !== req.user!.userId) {
      res.status(404).json({ error: 'Top-up not found' }); return;
    }

    // Already processed — respond idempotently instead of crediting twice.
    if (topup.status === 'completed') {
      const { rows: [wallet] } = await db.query<{ balance: string }>(
        'SELECT balance FROM wallets WHERE user_id=$1 AND currency=$2',
        [req.user!.userId, topup.currency]
      );
      res.json({ amount: Number(topup.amount), balance: Number(wallet.balance) });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      res.status(400).json({ error: 'Payment not completed' }); return;
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [wallet] } = await client.query<{ balance: string }>(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW()
         WHERE user_id=$2 AND currency=$3 RETURNING balance`,
        [topup.amount, req.user!.userId, topup.currency]
      );
      await client.query(`UPDATE topups SET status='completed', completed_at=NOW() WHERE id=$1`, [topup.id]);
      await client.query(
        `INSERT INTO audit_log (user_id,event_type,metadata) VALUES ($1,'WALLET_TOPUP',$2)`,
        [req.user!.userId, JSON.stringify({ amount: Number(topup.amount), currency: topup.currency, stripeSessionId: sessionId })]
      );
      await client.query('COMMIT');
      res.json({ amount: Number(topup.amount), balance: Number(wallet.balance) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
};
