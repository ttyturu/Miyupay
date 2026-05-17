import { db } from '../utils/db';
import { runFraudChecks } from './fraudService';
import { generateReference } from '../utils/helpers';
import { Currency, Transaction, TxStatus } from '../types';

interface SendParams {
  senderId: string;
  receiverEmail: string;
  senderCurrency: Currency;
  receiverCurrency: Currency;
  amount: number;
  note?: string;
}

interface SendResult {
  transaction: Transaction;
  flagged: boolean;
  message: string;
}

export const processTransaction = async (params: SendParams): Promise<SendResult> => {
  const { senderId, receiverEmail, senderCurrency, receiverCurrency, amount, note } = params;
  const client = await db.pool.connect();

  try {
    // 1. Validate receiver
    const { rows: receiverRows } = await client.query<{ id: string; full_name: string }>(
      'SELECT id, full_name FROM users WHERE email = $1 AND is_active = TRUE',
      [receiverEmail]
    );
    if (!receiverRows[0]) throw Object.assign(new Error('Recipient not found'), { status: 404 });
    const receiver = receiverRows[0];
    if (receiver.id === senderId) throw Object.assign(new Error('Cannot send to yourself'), { status: 400 });

    // 2. Get exchange rate
    const { rows: rateRows } = await client.query<{ rate: string }>(
      'SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2',
      [senderCurrency, receiverCurrency]
    );
    if (!rateRows[0]) throw Object.assign(new Error('Currency pair not supported'), { status: 400 });

    const exchangeRate = parseFloat(rateRows[0].rate);
    const receiverAmount = parseFloat((amount * exchangeRate).toFixed(6));
    const isCrossBorder = senderCurrency !== receiverCurrency;

    // 3. Run fraud checks before touching money
    const fraud = await runFraudChecks({ senderId, receiverId: receiver.id, senderAmount: amount, senderCurrency, isCrossBorder });

    // 4. Begin atomic DB transaction
    await client.query('BEGIN');

    const reference = generateReference();
    const status: TxStatus = fraud.flagged ? 'flagged' : 'processing';

    const { rows: [tx] } = await client.query<Transaction>(
      `INSERT INTO transactions
        (reference_code,sender_id,receiver_id,sender_currency,receiver_currency,
         sender_amount,receiver_amount,exchange_rate,is_cross_border,
         status,fraud_flagged,fraud_reason,note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [reference, senderId, receiver.id, senderCurrency, receiverCurrency,
       amount, receiverAmount, exchangeRate, isCrossBorder,
       status, fraud.flagged, fraud.reason, note ?? null]
    );

    // Log which fraud rules fired
    for (const rule of fraud.rules) {
      await client.query(
        'INSERT INTO fraud_checks (transaction_id,rule_name,triggered,details) VALUES ($1,$2,$3,$4)',
        [tx.id, rule.rule_name, rule.triggered, rule.details]
      );
    }

    // Audit log — transaction created
    await client.query(
      `INSERT INTO audit_log (transaction_id,user_id,event_type,new_status,metadata)
       VALUES ($1,$2,'TRANSACTION_CREATED',$3,$4)`,
      [tx.id, senderId, status, JSON.stringify({ fraud_flagged: fraud.flagged })]
    );

    // Stop here if flagged — don't move money
    if (fraud.flagged) {
      await client.query('COMMIT');
      return { transaction: tx, flagged: true, message: 'Transaction flagged for review. No funds have been moved.' };
    }

    // 5. Double-entry ledger
    // DEBIT sender
    const { rows: debitRows } = await client.query<{ id: string; balance: string }>(
      `UPDATE wallets SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2 AND currency = $3 AND balance >= $1
       RETURNING id, balance`,
      [amount, senderId, senderCurrency]
    );
    if (!debitRows[0]) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Insufficient balance'), { status: 400 });
    }
    await client.query(
      `INSERT INTO ledger_entries (transaction_id,wallet_id,entry_type,currency,amount,balance_after)
       VALUES ($1,$2,'DEBIT',$3,$4,$5)`,
      [tx.id, debitRows[0].id, senderCurrency, amount, parseFloat(debitRows[0].balance)]
    );

    // CREDIT receiver
    const { rows: creditRows } = await client.query<{ id: string; balance: string }>(
      `INSERT INTO wallets (user_id,currency,balance)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id,currency) DO UPDATE SET balance = wallets.balance + $3, updated_at = NOW()
       RETURNING id, balance`,
      [receiver.id, receiverCurrency, receiverAmount]
    );
    await client.query(
      `INSERT INTO ledger_entries (transaction_id,wallet_id,entry_type,currency,amount,balance_after)
       VALUES ($1,$2,'CREDIT',$3,$4,$5)`,
      [tx.id, creditRows[0].id, receiverCurrency, receiverAmount, parseFloat(creditRows[0].balance)]
    );

    // 6. Mark complete + audit log
    await client.query(
      `UPDATE transactions SET status='completed', completed_at=NOW() WHERE id=$1`,
      [tx.id]
    );
    await client.query(
      `INSERT INTO audit_log (transaction_id,user_id,event_type,old_status,new_status)
       VALUES ($1,$2,'TRANSACTION_COMPLETED','processing','completed')`,
      [tx.id, senderId]
    );

    await client.query('COMMIT');
    return { transaction: { ...tx, status: 'completed' }, flagged: false, message: 'Payment sent successfully.' };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
