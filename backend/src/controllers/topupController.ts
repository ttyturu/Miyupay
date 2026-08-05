import { Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { stripe } from '../services/stripeService';
import { runTopupFraudChecks } from '../services/topupFraudService';
import { CLEARING_ACCOUNT_ID } from '../utils/constants';

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
    // case (e.g. the success page re-rendering). NOT the actual safety
    // mechanism against double-crediting; see the atomic claim below for that.
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

      // Atomic claim: only one concurrent request can ever flip
      // pending -> completed, since this is a single indivisible statement —
      // there's no gap between "check" and "act" for a second request to slip
      // into. If this updates zero rows, another request (a page refresh, a
      // second tab, a retried request) already claimed and processed this
      // top-up between our check above and now; treat that as success rather
      // than crediting the wallet a second time.
      const { rows: [claimed] } = await client.query<{ id: string }>(
        `UPDATE topups SET status='completed', completed_at=NOW()
         WHERE id=$1 AND status='pending' RETURNING id`,
        [topup.id]
      );

      if (!claimed) {
        await client.query('ROLLBACK');
        const { rows: [wallet] } = await db.query<{ balance: string }>(
          'SELECT balance FROM wallets WHERE user_id=$1 AND currency=$2',
          [req.user!.userId, topup.currency]
        );
        res.json({ amount: Number(topup.amount), balance: Number(wallet.balance) });
        return;
      }

      // DEBIT the clearing wallet — money entering from Stripe now has a real
      // counterparty, same double-entry pattern a transfer uses. Legitimately
      // goes negative (it's a pass-through, not a bounded pool of funds).
      const { rows: [clearingWallet] } = await client.query<{ id: string; balance: string }>(
        `UPDATE wallets SET balance = balance - $1, updated_at = NOW()
         WHERE user_id = $2 AND currency = $3 RETURNING id, balance`,
        [topup.amount, CLEARING_ACCOUNT_ID, topup.currency]
      );

      // CREDIT the user's wallet
      const { rows: [userWallet] } = await client.query<{ id: string; balance: string }>(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW()
         WHERE user_id=$2 AND currency=$3 RETURNING id, balance`,
        [topup.amount, req.user!.userId, topup.currency]
      );

      await client.query(
        `INSERT INTO ledger_entries (topup_id,wallet_id,entry_type,currency,amount,balance_after)
         VALUES ($1,$2,'DEBIT',$3,$4,$5)`,
        [topup.id, clearingWallet.id, topup.currency, topup.amount, parseFloat(clearingWallet.balance)]
      );
      await client.query(
        `INSERT INTO ledger_entries (topup_id,wallet_id,entry_type,currency,amount,balance_after)
         VALUES ($1,$2,'CREDIT',$3,$4,$5)`,
        [topup.id, userWallet.id, topup.currency, topup.amount, parseFloat(userWallet.balance)]
      );

      await client.query(
        `INSERT INTO audit_log (user_id,event_type,metadata) VALUES ($1,'WALLET_TOPUP',$2)`,
        [req.user!.userId, JSON.stringify({ amount: Number(topup.amount), currency: topup.currency, stripeSessionId: sessionId })]
      );
      await client.query('COMMIT');
      res.json({ amount: Number(topup.amount), balance: Number(userWallet.balance) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
};
