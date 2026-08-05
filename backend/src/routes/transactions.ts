import { Router } from 'express';
import { body, query } from 'express-validator';
import { send, getAll, getRates, checkRecipient, getRecentRecipients } from '../controllers/transactionController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

router.get('/', getAll);
router.get('/rates', getRates);
router.get('/recent-recipients', getRecentRecipients);
router.get('/recipient-check', [
  query('email').isEmail().normalizeEmail(),
  validate,
], checkRecipient);

router.post('/send', [
  body('receiverEmail').isEmail().normalizeEmail(),
  body('senderCurrency').isIn(['SGD','MYR','THB']),
  body('receiverCurrency').isIn(['SGD','MYR','THB']),
  body('amount').isFloat({ min: 0.01, max: 50000 }).withMessage('Amount must be between 0.01 and 50,000'),
  body('note').optional().isString().trim().isLength({ max: 280 }).withMessage('Note must be 280 characters or fewer'),
  validate,
], send);

export default router;
