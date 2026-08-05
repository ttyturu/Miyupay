import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getUserAudit, getUserSummary, getFlaggedTransactions, freezeUser, unfreezeUser, searchUsers,
  getTransactionLedger, getTransactionFraudChecks, getTopupLedger,
} from '../controllers/adminController';
import { authenticate } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate, isAdmin);

router.get('/flagged', [
  query('sort').optional().isIn(['recent', 'risk']),
  validate,
], getFlaggedTransactions);

router.get('/users/search', [
  query('q').optional().isString().trim(),
  validate,
], searchUsers);

router.get('/users/:email/audit', [
  param('email').isEmail().normalizeEmail(),
  validate,
], getUserAudit);

router.get('/users/:email/summary', [
  param('email').isEmail().normalizeEmail(),
  validate,
], getUserSummary);

router.post('/users/:email/freeze', [
  param('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
], freezeUser);

router.post('/users/:email/unfreeze', [
  param('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
], unfreezeUser);

router.get('/transactions/:txId/ledger', getTransactionLedger);
router.get('/transactions/:txId/fraud', getTransactionFraudChecks);
router.get('/topups/:topupId/ledger', getTopupLedger);

export default router;
