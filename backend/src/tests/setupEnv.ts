// Runs before each test file loads the app. Loads the real backend/.env (for
// DATABASE_URL, JWT_SECRET) and forces NODE_ENV=test so rate limiting is
// disabled — the suite makes far more requests per minute than a real user.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// stripeService builds its client at import time, so this has to be set before
// any test file imports the app — a top-level assignment inside a test file is
// hoisted below its own imports and lands too late. Without a key the client is
// null and every webhook route answers 503, which passes locally (a developer's
// .env supplies a real key) and fails in CI, where no .env exists. A dummy keeps
// the suite independent of local configuration; nothing here calls the Stripe
// API, since signature verification is a local HMAC.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_tests_only';
