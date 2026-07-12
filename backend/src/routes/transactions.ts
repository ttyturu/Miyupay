import { Router } from 'express';
import { body } from 'express-validator';
import { send, getAll, getRates } from '../controllers/transactionController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getAll);
router.get('/rates', getRates);

router.post('/send', [
  body('receiverEmail').isEmail().normalizeEmail(),
  body('senderCurrency').isIn(['SGD','MYR','THB']),
  body('receiverCurrency').isIn(['SGD','MYR','THB']),
  body('amount').isFloat({ min: 0.01, max: 50000 }).withMessage('Amount must be between 0.01 and 50,000'),
], send);

export default router;
