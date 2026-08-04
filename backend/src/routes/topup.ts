import { Router } from 'express';
import { body } from 'express-validator';
import { createSession, confirmTopup } from '../controllers/topupController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

router.post('/create-session', [
  body('amount').isFloat({ min: 1, max: 10000 }).withMessage('Amount must be between 1 and 10,000'),
  validate,
], createSession);

router.post('/confirm', [
  body('sessionId').isString().notEmpty(),
  validate,
], confirmTopup);

export default router;
