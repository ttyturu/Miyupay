import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { authenticate } from '../middleware/auth';

// ─── Wallet ───────────────────────────────────────────────────────────────────
export const walletRouter = Router();
walletRouter.use(authenticate);

walletRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM wallets WHERE user_id=$1 ORDER BY currency',
      [req.user!.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditRouter = Router();
auditRouter.use(authenticate);

// Full audit log for current user
auditRouter.get('/log', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query(
      `SELECT al.*, t.reference_code
       FROM audit_log al
       LEFT JOIN transactions t ON al.transaction_id = t.id
       WHERE al.user_id=$1
       ORDER BY al.created_at DESC LIMIT 100`,
      [req.user!.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Ledger entries for a specific transaction
auditRouter.get('/ledger/:txId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query(
      `SELECT le.*, u.full_name AS wallet_owner
       FROM ledger_entries le
       JOIN wallets w ON le.wallet_id = w.id
       JOIN users u ON w.user_id = u.id
       JOIN transactions t ON le.transaction_id = t.id
       WHERE le.transaction_id=$1 AND (t.sender_id=$2 OR t.receiver_id=$2)`,
      [req.params.txId, req.user!.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Fraud check results for a transaction
auditRouter.get('/fraud/:txId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query(
      `SELECT fc.* FROM fraud_checks fc
       JOIN transactions t ON fc.transaction_id = t.id
       WHERE fc.transaction_id=$1 AND (t.sender_id=$2 OR t.receiver_id=$2)`,
      [req.params.txId, req.user!.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});
