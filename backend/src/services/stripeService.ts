import Stripe from 'stripe';

// STRIPE_SECRET_KEY is optional at startup so the app still boots without it —
// the top-up routes just return a clear error until a test-mode key is added.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
