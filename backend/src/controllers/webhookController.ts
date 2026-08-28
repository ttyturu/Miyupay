import { Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../utils/db';
import { stripe } from '../services/stripeService';
import { creditTopup, expireTopup } from '../services/topupCreditService';

/**
 * Stripe webhook — the authoritative confirmation path.
 *
 * Without this, a top-up is only ever credited by the browser landing back on
 * /topup/success. If that redirect never happens (tab closed after paying,
 * network drop, phone dies), Stripe has taken the money and the wallet is
 * never credited — the user is simply out the funds. Webhooks arrive
 * server-to-server and retry for 72h, so confirmation no longer depends on the
 * customer's browser surviving the round trip.
 */
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    res.status(503).json({ error: 'Stripe webhooks are not configured.' });
    return;
  }

  // Verify the signature against the RAW body. This is what proves the request
  // actually came from Stripe — the endpoint is unauthenticated and public, so
  // without this anyone could POST a fake "payment succeeded" and mint credit.
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      req.headers['stripe-signature'] as string,
      secret
    );
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
    return;
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;

      // checkout.session.completed also fires for sessions still awaiting an
      // async payment method, so confirm the money actually arrived.
      if (session.payment_status === 'paid') {
        const { rows: [topup] } = await db.query<{ id: string }>(
          'SELECT id FROM topups WHERE stripe_session_id=$1', [session.id]
        );
        if (topup) await creditTopup(topup.id);
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { rows: [topup] } = await db.query<{ id: string }>(
        'SELECT id FROM topups WHERE stripe_session_id=$1', [session.id]
      );
      if (topup) await expireTopup(topup.id);
    }

    res.json({ received: true });
  } catch (err) {
    // Return 500 so Stripe retries — swallowing the error here would silently
    // drop a real payment.
    console.error('Stripe webhook handler failed:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};
