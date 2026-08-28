import { Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { processTransaction } from '../services/transactionService';
import { Currency, TransferActivity, TopupActivity, ActivityItem } from '../types';
import { sortActivity } from '../utils/activity';

export const send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { receiverEmail, senderCurrency, receiverCurrency, amount, note } = req.body as {
      receiverEmail: string;
      senderCurrency: Currency;
      receiverCurrency: Currency;
      amount: number;
      note?: string;
    };
    const result = await processTransaction({
      senderId: req.user!.userId,
      receiverEmail, senderCurrency, receiverCurrency,
      amount: parseFloat(String(amount)), note,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const checkRecipient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!email) { res.json({ isNewRecipient: false }); return; }

    const { rows: userRows } = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );
    const receiver = userRows[0];
    if (!receiver || receiver.id === req.user!.userId) {
      res.json({ isNewRecipient: false }); return;
    }

    const { rows } = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM transactions WHERE sender_id = $1 AND receiver_id = $2',
      [req.user!.userId, receiver.id]
    );
    res.json({ isNewRecipient: parseInt(rows[0].count) === 0 });
  } catch (err) { next(err); }
};

export const getRecentRecipients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query<{ email: string; full_name: string }>(
      `SELECT r.email, r.full_name, MAX(t.created_at) AS last_sent
       FROM transactions t
       JOIN users r ON t.receiver_id = r.id
       WHERE t.sender_id = $1
       GROUP BY r.email, r.full_name
       ORDER BY last_sent DESC
       LIMIT 20`,
      [req.user!.userId]
    );
    res.json(rows.map(r => ({ email: r.email, fullName: r.full_name })));
  } catch (err) { next(err); }
};

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows: transactions } = await db.query<TransferActivity>(
      `SELECT t.*, 'transfer' AS type,
              s.full_name AS sender_name, s.email AS sender_email,
              r.full_name AS receiver_name, r.email AS receiver_email
       FROM transactions t
       JOIN users s ON t.sender_id = s.id
       JOIN users r ON t.receiver_id = r.id
       WHERE t.sender_id=$1 OR t.receiver_id=$1
       ORDER BY t.created_at DESC LIMIT 50`,
      [req.user!.userId]
    );
    // Completed only. A pending/expired top-up is a checkout the user opened
    // and never paid for — no charge, no hold, no money moved — so it isn't an
    // entry in a record of money movements. Showing it as "pending" implies
    // funds are in flight when nothing was ever taken. Admins still see every
    // row (see adminController), where abandoned attempts are a card-testing
    // signal rather than a user-facing event.
    const { rows: topups } = await db.query<TopupActivity>(
      `SELECT tp.*, 'topup' AS type, u.full_name AS user_full_name, u.email AS user_email
       FROM topups tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.user_id=$1 AND tp.status='completed'
       ORDER BY tp.created_at DESC LIMIT 50`,
      [req.user!.userId]
    );

    const merged: ActivityItem[] = sortActivity([...transactions, ...topups]).slice(0, 50);
    res.json(merged);
  } catch (err) { next(err); }
};

export const getRates = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query('SELECT * FROM exchange_rates ORDER BY from_currency');
    res.json(rows);
  } catch (err) { next(err); }
};
