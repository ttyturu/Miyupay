import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../utils/db';
import { summarizeUserActivity } from '../services/groqService';
import { TransferActivity, TopupActivity, ActivityItem } from '../types';
import { sortActivity } from '../utils/activity';
import { CLEARING_ACCOUNT_ID } from '../utils/constants';

const AGGREGATE_RISK_WINDOW_DAYS = 30;

const findUserByEmail = async (email: string) => {
  const { rows: [user] } = await db.query<{
    id: string; email: string; full_name: string; role: string; frozen: boolean; created_at: Date;
  }>(
    'SELECT id, email, full_name, role, frozen, created_at FROM users WHERE email = $1',
    [email]
  );
  return user;
};

const getActivityForUser = async (userId: string): Promise<ActivityItem[]> => {
  const { rows: transactions } = await db.query<TransferActivity>(
    `SELECT t.*, 'transfer' AS type,
            s.full_name AS sender_name, s.email AS sender_email,
            r.full_name AS receiver_name, r.email AS receiver_email
     FROM transactions t
     JOIN users s ON t.sender_id = s.id
     JOIN users r ON t.receiver_id = r.id
     WHERE t.sender_id = $1 OR t.receiver_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  const { rows: topups } = await db.query<TopupActivity>(
    `SELECT tp.*, 'topup' AS type, u.full_name AS user_full_name, u.email AS user_email
     FROM topups tp
     JOIN users u ON tp.user_id = u.id
     WHERE tp.user_id = $1
     ORDER BY tp.created_at DESC`,
    [userId]
  );
  return sortActivity([...transactions, ...topups]);
};

// Rolling-window "how risky does this person look overall" score — distinct
// from a single transaction's risk_score. Only counts transfers this user
// *sent* (a flag reflects sender behavior, not the receiver's), plus their
// own flagged top-ups. Capped at 100, same scale as a per-item score.
const getAggregateRisk = async (userId: string): Promise<number> => {
  const { rows: [transferRisk] } = await db.query<{ total: string | null }>(
    `SELECT SUM(risk_score) as total FROM transactions
     WHERE sender_id = $1 AND fraud_flagged = TRUE
       AND created_at > NOW() - INTERVAL '${AGGREGATE_RISK_WINDOW_DAYS} days'`,
    [userId]
  );
  const { rows: [topupRisk] } = await db.query<{ total: string | null }>(
    `SELECT SUM(risk_score) as total FROM topups
     WHERE user_id = $1 AND fraud_flagged = TRUE
       AND created_at > NOW() - INTERVAL '${AGGREGATE_RISK_WINDOW_DAYS} days'`,
    [userId]
  );
  const total = parseFloat(transferRisk.total ?? '0') + parseFloat(topupRisk.total ?? '0');
  return Math.min(100, total);
};

const verifyAdminPassword = async (adminUserId: string, password: string): Promise<boolean> => {
  const { rows: [admin] } = await db.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [adminUserId]
  );
  if (!admin) return false;
  return bcrypt.compare(password, admin.password_hash);
};

export const searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) { res.json([]); return; }

    const { rows } = await db.query<{ email: string; full_name: string }>(
      `SELECT email, full_name FROM users
       WHERE (email ILIKE $1 OR full_name ILIKE $1) AND id != $2
       ORDER BY full_name LIMIT 10`,
      [`%${q}%`, CLEARING_ACCOUNT_ID]
    );
    res.json(rows.map(r => ({ email: r.email, fullName: r.full_name })));
  } catch (err) { next(err); }
};

export const getUserAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await findUserByEmail(req.params.email);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const activity = await getActivityForUser(user.id);
    const aggregateRisk = await getAggregateRisk(user.id);
    res.json({ user, activity, aggregateRisk });
  } catch (err) { next(err); }
};

export const getUserSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await findUserByEmail(req.params.email);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const activity = await getActivityForUser(user.id);
    if (activity.length === 0) {
      res.json({ summary: 'No transaction history yet.' });
      return;
    }

    const aggregateRisk = await getAggregateRisk(user.id);
    const summary = await summarizeUserActivity(user.full_name, user.email, activity, aggregateRisk);
    res.json({ summary });
  } catch (err) { next(err); }
};

export const getFlaggedTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sort = req.query.sort === 'risk' ? 'risk' : 'recent';

    const { rows: transactions } = await db.query<TransferActivity>(
      `SELECT t.*, 'transfer' AS type,
              s.full_name AS sender_name, s.email AS sender_email,
              r.full_name AS receiver_name, r.email AS receiver_email
       FROM transactions t
       JOIN users s ON t.sender_id = s.id
       JOIN users r ON t.receiver_id = r.id
       WHERE t.fraud_flagged = TRUE`
    );
    const { rows: topups } = await db.query<TopupActivity>(
      `SELECT tp.*, 'topup' AS type, u.full_name AS user_full_name, u.email AS user_email
       FROM topups tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.fraud_flagged = TRUE`
    );

    const merged = sortActivity([...transactions, ...topups], sort).slice(0, 50);
    res.json(merged);
  } catch (err) { next(err); }
};

export const freezeUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { password } = req.body as { password: string };
    if (!(await verifyAdminPassword(req.user!.userId, password))) {
      res.status(401).json({ error: 'Incorrect password' }); return;
    }

    const user = await findUserByEmail(req.params.email);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    // Prevent an admin from accidentally locking themselves out of sending —
    // self-service freezing is what the Account page's kill switch is for.
    if (user.id === req.user!.userId) {
      res.status(400).json({ error: 'You cannot freeze your own account from the admin panel.' }); return;
    }

    await db.query('UPDATE users SET frozen = TRUE WHERE id = $1', [user.id]);
    res.json({ email: user.email, frozen: true });
  } catch (err) { next(err); }
};

export const unfreezeUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { password } = req.body as { password: string };
    if (!(await verifyAdminPassword(req.user!.userId, password))) {
      res.status(401).json({ error: 'Incorrect password' }); return;
    }

    const user = await findUserByEmail(req.params.email);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await db.query('UPDATE users SET frozen = FALSE WHERE id = $1', [user.id]);
    res.json({ email: user.email, frozen: false });
  } catch (err) { next(err); }
};

// Ledger / fraud-check drill-down — migrated here from the user-scoped
// /api/audit/* routes, which only ever let a person view their own data.
// These are admin-only and have no ownership restriction.
export const getTransactionLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query(
      `SELECT le.*, u.full_name AS wallet_owner
       FROM ledger_entries le
       JOIN wallets w ON le.wallet_id = w.id
       JOIN users u ON w.user_id = u.id
       WHERE le.transaction_id = $1`,
      [req.params.txId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

export const getTransactionFraudChecks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query('SELECT * FROM fraud_checks WHERE transaction_id = $1', [req.params.txId]);
    res.json(rows);
  } catch (err) { next(err); }
};

export const getTopupLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query(
      `SELECT le.*, u.full_name AS wallet_owner
       FROM ledger_entries le
       JOIN wallets w ON le.wallet_id = w.id
       JOIN users u ON w.user_id = u.id
       WHERE le.topup_id = $1`,
      [req.params.topupId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};
