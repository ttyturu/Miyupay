import { db } from '../utils/db';
import { CLEARING_ACCOUNT_ID } from '../utils/constants';

export interface CreditResult {
  amount: number;
  currency: string;
  balance: number;
  /** False when another path (webhook or a second confirm) already credited it. */
  credited: boolean;
}

/**
 * Credits a paid top-up to the user's wallet, exactly once.
 *
 * Shared by BOTH confirmation paths — the browser hitting /topup/confirm after
 * the Stripe redirect, and the checkout.session.completed webhook. They race
 * each other constantly (the webhook often lands first), so this must be
 * idempotent; keeping it in one place is also what stops the two paths from
 * drifting apart.
 *
 * CALLERS MUST have already verified with Stripe that the session is paid —
 * this function trusts that and does not re-check.
 */
export const creditTopup = async (topupId: string): Promise<CreditResult> => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Atomic claim: a single indivisible statement, so there's no gap between
    // "check" and "act" for a second caller to slip into. Claiming from any
    // non-completed status (not just 'pending') also covers the rare race
    // where a session was marked expired but Stripe confirms it was paid —
    // Stripe is authoritative about payment, so we still credit it.
    const { rows: [claimed] } = await client.query<{
      id: string; amount: string; currency: string; user_id: string;
    }>(
      `UPDATE topups SET status='completed', completed_at=NOW()
       WHERE id=$1 AND status<>'completed'
       RETURNING id, amount, currency, user_id`,
      [topupId]
    );

    if (!claimed) {
      // Someone else already credited this one. Report the current balance so
      // the caller can still render a correct success page.
      await client.query('ROLLBACK');
      const { rows: [topup] } = await db.query<{
        amount: string; currency: string; user_id: string;
      }>('SELECT amount, currency, user_id FROM topups WHERE id=$1', [topupId]);
      const { rows: [wallet] } = await db.query<{ balance: string }>(
        'SELECT balance FROM wallets WHERE user_id=$1 AND currency=$2',
        [topup.user_id, topup.currency]
      );
      return {
        amount: Number(topup.amount),
        currency: topup.currency,
        balance: Number(wallet.balance),
        credited: false,
      };
    }

    // DEBIT the clearing wallet — money entering from Stripe now has a real
    // counterparty, same double-entry pattern a transfer uses. Legitimately
    // goes negative (it's a pass-through, not a bounded pool of funds).
    const { rows: [clearingWallet] } = await client.query<{ id: string; balance: string }>(
      `UPDATE wallets SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2 AND currency = $3 RETURNING id, balance`,
      [claimed.amount, CLEARING_ACCOUNT_ID, claimed.currency]
    );

    // CREDIT the user's wallet
    const { rows: [userWallet] } = await client.query<{ id: string; balance: string }>(
      `UPDATE wallets SET balance = balance + $1, updated_at = NOW()
       WHERE user_id=$2 AND currency=$3 RETURNING id, balance`,
      [claimed.amount, claimed.user_id, claimed.currency]
    );

    await client.query(
      `INSERT INTO ledger_entries (topup_id,wallet_id,entry_type,currency,amount,balance_after)
       VALUES ($1,$2,'DEBIT',$3,$4,$5)`,
      [claimed.id, clearingWallet.id, claimed.currency, claimed.amount, parseFloat(clearingWallet.balance)]
    );
    await client.query(
      `INSERT INTO ledger_entries (topup_id,wallet_id,entry_type,currency,amount,balance_after)
       VALUES ($1,$2,'CREDIT',$3,$4,$5)`,
      [claimed.id, userWallet.id, claimed.currency, claimed.amount, parseFloat(userWallet.balance)]
    );

    await client.query(
      `INSERT INTO audit_log (user_id,event_type,metadata) VALUES ($1,'WALLET_TOPUP',$2)`,
      [claimed.user_id, JSON.stringify({
        amount: Number(claimed.amount),
        currency: claimed.currency,
        topupId: claimed.id,
      })]
    );

    await client.query('COMMIT');
    return {
      amount: Number(claimed.amount),
      currency: claimed.currency,
      balance: Number(userWallet.balance),
      credited: true,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Marks an unpaid top-up dead once its Stripe session expires. Terminal, and
 * never shown to the user — it exists so admins can tell "still open" from
 * "abandoned", and so a burst of expiries reads as the card-testing signal it
 * is. Guarded on status<>'completed' so a late expiry event can never
 * un-credit a top-up that was actually paid.
 */
export const expireTopup = async (topupId: string): Promise<void> => {
  await db.query(
    `UPDATE topups SET status='expired' WHERE id=$1 AND status<>'completed'`,
    [topupId]
  );
};
