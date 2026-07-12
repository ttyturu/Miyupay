import { Request, Response, NextFunction } from 'express';
import { db } from '../utils/db';
import { processTransaction } from '../services/transactionService';
import { Currency } from '../types';

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

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query(
      `SELECT t.*,
              s.full_name AS sender_name, s.email AS sender_email,
              r.full_name AS receiver_name, r.email AS receiver_email
       FROM transactions t
       JOIN users s ON t.sender_id = s.id
       JOIN users r ON t.receiver_id = r.id
       WHERE t.sender_id=$1 OR t.receiver_id=$1
       ORDER BY t.created_at DESC LIMIT 50`,
      [req.user!.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

export const getRates = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await db.query('SELECT * FROM exchange_rates ORDER BY from_currency');
    res.json(rows);
  } catch (err) { next(err); }
};
