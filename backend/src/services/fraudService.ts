import { db } from '../utils/db';
import { Currency, FraudCheck, FraudResult } from '../types';

interface FraudContext {
  senderId: string;
  receiverId: string;
  senderAmount: number;
  senderAmountSGD: number;
  isCrossBorder: boolean;
}

type Rule = {
  name: string;
  check: (ctx: FraudContext) => Promise<FraudCheck>;
};

const RULES: Rule[] = [
  {
    name: 'LARGE_AMOUNT',
    check: async ({ senderAmountSGD }) => {
      const triggered = senderAmountSGD > 5000;
      return {
        rule_name: 'LARGE_AMOUNT',
        triggered,
        details: triggered
          ? `Amount SGD ${senderAmountSGD.toFixed(2)} exceeds large transaction threshold of SGD 5,000`
          : null,
      };
    },
  },
  {
    name: 'UNUSUAL_HOUR',
    check: async () => {
      const hour = new Date(
        new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
      ).getHours();
      const triggered = hour >= 1 && hour < 5;
      return {
        rule_name: 'UNUSUAL_HOUR',
        triggered,
        details: triggered ? `Transaction at unusual hour: ${hour}:00 SGT` : null,
      };
    },
  },
  {
    name: 'NEW_RECIPIENT',
    check: async ({ senderId, receiverId }) => {
      const { rows } = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM transactions
         WHERE sender_id = $1 AND receiver_id = $2 AND status = 'completed'`,
        [senderId, receiverId]
      );
      const isNew = parseInt(rows[0].count) === 0;
      return {
        rule_name: 'NEW_RECIPIENT',
        triggered: isNew,
        details: isNew ? 'First transaction to this recipient' : null,
      };
    },
  },
  {
    name: 'HIGH_FREQUENCY',
    check: async ({ senderId }) => {
      const { rows } = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM transactions
         WHERE sender_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [senderId]
      );
      const count = parseInt(rows[0].count);
      const triggered = count >= 5;
      return {
        rule_name: 'HIGH_FREQUENCY',
        triggered,
        details: triggered ? `${count} transactions in the last hour` : null,
      };
    },
  },
  {
    name: 'LARGE_CROSS_BORDER',
    check: async ({ isCrossBorder, senderAmountSGD }) => {
      const triggered = isCrossBorder && senderAmountSGD > 2000;
      return {
        rule_name: 'LARGE_CROSS_BORDER',
        triggered,
        details: triggered
          ? `Cross-border amount SGD ${senderAmountSGD.toFixed(2)} exceeds SGD 2,000 threshold`
          : null,
      };
    },
  },
];

export const runFraudChecks = async (params: {
  senderId: string;
  receiverId: string;
  senderAmount: number;
  senderCurrency: Currency;
  isCrossBorder: boolean;
}): Promise<FraudResult> => {
  const { senderId, receiverId, senderAmount, senderCurrency, isCrossBorder } = params;

  // Convert to SGD equivalent for threshold comparisons
  let senderAmountSGD = senderAmount;
  if (senderCurrency !== 'SGD') {
    const { rows } = await db.query<{ rate: string }>(
      'SELECT rate FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2',
      [senderCurrency, 'SGD']
    );
    if (rows[0]) senderAmountSGD = senderAmount * parseFloat(rows[0].rate);
  }

  const ctx: FraudContext = { senderId, receiverId, senderAmount, senderAmountSGD, isCrossBorder };
  const results = await Promise.all(RULES.map(r => r.check(ctx)));
  const flagged = results.some(r => r.triggered);
  const reasons = results.filter(r => r.triggered && r.details).map(r => r.details!);

  return { flagged, reason: flagged ? reasons.join('; ') : null, rules: results };
};
