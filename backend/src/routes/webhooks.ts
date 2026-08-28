import { Router, raw } from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';

const router = Router();

// raw, not json — Stripe signs the exact bytes it sent, so parsing the body
// before verification would destroy the signature. This router is mounted
// ahead of the global express.json() in app.ts for the same reason.
// Deliberately unauthenticated: Stripe has no session. The signature check in
// the handler is what authenticates the request.
router.post('/stripe', raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
