import { Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { stripe } from '../services/stripeService';
import { runTopupFraudChecks } from '../services/topupFraudService';
import { creditTopup } from '../services/topupCreditService';

// Stripe defaults to 24h, which is far longer than anyone legitimately spends
// on a wallet top-up. A tighter window closes abandoned rows sooner and makes a
// burst of expiries a much sharper card-testing signal. Stripe's floor is 30m.
const SESSION_TTL_MINUTES = 60;

export const createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!stripe) {
      res.status(503).json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to enable top-ups.' });
      return;
    }
    const { amount } = req.body as { amount: number };

    const fraud = await runTopupFraudChecks(req.user!.userId);

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
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_MINUTES * 60,
    });

    await db.query(
      `INSERT INTO topups (user_id,stripe_session_id,currency,amount,fraud_flagged,fraud_reason,risk_score)
       VALUES ($1,$2,'SGD',$3,$4,$5,$6)`,
      [req.user!.userId, session.id, amount, fraud.flagged, fraud.reason, fraud.riskScore]
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

    // Fast path only — avoids an unnecessary Stripe API call for the common
    // case (e.g. the success page re-rendering, or the webhook having already
    // landed first). NOT the safety mechanism against double-crediting; the
    // atomic claim inside creditTopup is.
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

    // Shared with the webhook path, which is racing this request — whichever
    // arrives second is absorbed idempotently.
    const result = await creditTopup(topup.id);
    res.json({ amount: result.amount, balance: result.balance });
  } catch (err) { next(err); }
};
