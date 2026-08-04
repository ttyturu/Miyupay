// Runs before each test file loads the app. Loads the real backend/.env (for
// DATABASE_URL, JWT_SECRET) and forces NODE_ENV=test so rate limiting is
// disabled — the suite makes far more requests per minute than a real user.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
