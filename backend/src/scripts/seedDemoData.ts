// Populates 11 demo accounts with deliberately varied activity — clean,
// large-amount, cross-border, high-frequency, structuring, combo (new-
// recipient + unusual-hour), and top-up velocity — so the admin panel's
// user lookup, flagged list, risk sorting, and aggregate risk score all
// have something real to show.
//
// Outcomes (fraud_flagged/fraud_reason/risk_score) are hardcoded per persona
// rather than run through the live fraud engines, since some scenarios (e.g.
// "at 2am") need to be true regardless of when this script is actually run.
// Fraud-check rows are only logged for flagged transactions — a real send
// logs all 6 rules every time; that fidelity isn't worth the extra code here.
// Completed top-ups post real DEBIT/CREDIT ledger entries against the
// clearing wallet, same as topupController.confirmTopup does.
//
// Idempotent: skips entirely if demo1@miyupay.dev already exists.
// Run with: npm run seed  (uses whichever DATABASE_URL is in .env)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../utils/db';
import { generateReference } from '../utils/helpers';
import { Currency } from '../types';
import { CLEARING_ACCOUNT_ID } from '../utils/constants';

const DEMO_PASSWORD = 'DemoPass123!';

const PERSONAS = [
  { email: 'demo1@miyupay.dev',  fullName: 'Alice Tan' },        // 1 — clean
  { email: 'demo2@miyupay.dev',  fullName: 'Brandon Lim' },       // 2 — clean
  { email: 'demo3@miyupay.dev',  fullName: 'Chloe Wong' },        // 3 — combo risk (new recipient + unusual hour)
  { email: 'demo4@miyupay.dev',  fullName: 'Daniel Koh' },        // 4 — large amount
  { email: 'demo5@miyupay.dev',  fullName: 'Evelyn Ng' },         // 5 — large cross-border
  { email: 'demo6@miyupay.dev',  fullName: 'Farhan Rahman' },     // 6 — high frequency
  { email: 'demo7@miyupay.dev',  fullName: 'Grace Lee' },         // 7 — mostly clean, one flagged
  { email: 'demo8@miyupay.dev',  fullName: 'Hassan Ibrahim' },    // 8 — structuring (split transfers)
  { email: 'demo9@miyupay.dev',  fullName: 'Ivy Chua' },          // 9 — new recipient only, not flagged
  { email: 'demo10@miyupay.dev', fullName: 'Jason Teo' },         // 10 — unusual hour only + mostly a receiver
  { email: 'demo11@miyupay.dev', fullName: 'Karen Lim' },         // 11 — top-up velocity + large amount (aggregate risk demo)
] as const;

// Generously funded so every scenario below can complete regardless of the
// real S$1,000 starter balance new users normally get.
const SEED_BALANCES: Record<Currency, number> = { SGD: 50000, MYR: 100000, THB: 200000 };

interface FraudRuleLog { rule_name: string; details: string }

interface SeedTx {
  senderIdx: number;
  receiverIdx: number;
  senderCurrency: Currency;
  receiverCurrency: Currency;
  amount: number;
  daysAgo: number;
  hour: number;
  minuteOffset?: number;
  flagged: boolean;
  reason?: string;
  riskScore?: number;
  rules?: FraudRuleLog[];
}

const at = (daysAgo: number, hour: number, minuteOffset = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minuteOffset, 0, 0);
  return d;
};

// Indexes below are 0-based into PERSONAS.
const TRANSACTIONS: SeedTx[] = [
  // Persona 1 (Alice) & 2 (Brandon) — clean regular activity
  { senderIdx: 0, receiverIdx: 1, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 50,  daysAgo: 20, hour: 13, flagged: false },
  { senderIdx: 0, receiverIdx: 1, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 80,  daysAgo: 12, hour: 15, flagged: false },
  { senderIdx: 0, receiverIdx: 9, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 120, daysAgo: 5,  hour: 11, flagged: false },
  { senderIdx: 1, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 60,  daysAgo: 15, hour: 10, flagged: false },
  { senderIdx: 1, receiverIdx: 9, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 45,  daysAgo: 3,  hour: 16, flagged: false },

  // Persona 3 (Chloe) — combo risk: new recipient + unusual hour, repeated
  {
    senderIdx: 2, receiverIdx: 3, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 200,
    daysAgo: 9, hour: 2, minuteOffset: 15, flagged: true, riskScore: 60,
    reason: 'First transaction to this recipient; Transaction at unusual hour: 2:00 SGT',
    rules: [
      { rule_name: 'NEW_RECIPIENT', details: 'First transaction to this recipient' },
      { rule_name: 'UNUSUAL_HOUR', details: 'Transaction at unusual hour: 2:00 SGT' },
    ],
  },
  {
    senderIdx: 2, receiverIdx: 5, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 350,
    daysAgo: 4, hour: 3, minuteOffset: 40, flagged: true, riskScore: 60,
    reason: 'First transaction to this recipient; Transaction at unusual hour: 3:00 SGT',
    rules: [
      { rule_name: 'NEW_RECIPIENT', details: 'First transaction to this recipient' },
      { rule_name: 'UNUSUAL_HOUR', details: 'Transaction at unusual hour: 3:00 SGT' },
    ],
  },

  // Persona 4 (Daniel) — large amount
  {
    senderIdx: 3, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 6200,
    daysAgo: 11, hour: 14, flagged: true, riskScore: 30,
    reason: 'Amount SGD 6200.00 exceeds large transaction threshold of SGD 5,000',
    rules: [{ rule_name: 'LARGE_AMOUNT', details: 'Amount SGD 6200.00 exceeds large transaction threshold of SGD 5,000' }],
  },
  {
    senderIdx: 3, receiverIdx: 1, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 5800,
    daysAgo: 2, hour: 9, flagged: true, riskScore: 30,
    reason: 'Amount SGD 5800.00 exceeds large transaction threshold of SGD 5,000',
    rules: [{ rule_name: 'LARGE_AMOUNT', details: 'Amount SGD 5800.00 exceeds large transaction threshold of SGD 5,000' }],
  },

  // Persona 5 (Evelyn) — large cross-border
  {
    senderIdx: 4, receiverIdx: 1, senderCurrency: 'SGD', receiverCurrency: 'MYR', amount: 2500,
    daysAgo: 8, hour: 12, flagged: true, riskScore: 40,
    reason: 'Cross-border amount SGD 2500.00 exceeds SGD 2,000 threshold',
    rules: [{ rule_name: 'LARGE_CROSS_BORDER', details: 'Cross-border amount SGD 2500.00 exceeds SGD 2,000 threshold' }],
  },
  {
    senderIdx: 4, receiverIdx: 9, senderCurrency: 'SGD', receiverCurrency: 'THB', amount: 2200,
    daysAgo: 1, hour: 17, flagged: true, riskScore: 40,
    reason: 'Cross-border amount SGD 2200.00 exceeds SGD 2,000 threshold',
    rules: [{ rule_name: 'LARGE_CROSS_BORDER', details: 'Cross-border amount SGD 2200.00 exceeds SGD 2,000 threshold' }],
  },

  // Persona 6 (Farhan) — high frequency: 4 clean, then 2 flagged once the
  // 1-hour count crosses the threshold (mirrors the real rule's >=5 check)
  { senderIdx: 5, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 20, daysAgo: 6, hour: 10, minuteOffset: 0,  flagged: false },
  { senderIdx: 5, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 20, daysAgo: 6, hour: 10, minuteOffset: 8,  flagged: false },
  { senderIdx: 5, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 20, daysAgo: 6, hour: 10, minuteOffset: 16, flagged: false },
  { senderIdx: 5, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 20, daysAgo: 6, hour: 10, minuteOffset: 24, flagged: false },
  {
    senderIdx: 5, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 20,
    daysAgo: 6, hour: 10, minuteOffset: 32, flagged: true, riskScore: 35,
    reason: '5 transactions in the last hour',
    rules: [{ rule_name: 'HIGH_FREQUENCY', details: '5 transactions in the last hour' }],
  },
  {
    senderIdx: 5, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 20,
    daysAgo: 6, hour: 10, minuteOffset: 40, flagged: true, riskScore: 35,
    reason: '6 transactions in the last hour',
    rules: [{ rule_name: 'HIGH_FREQUENCY', details: '6 transactions in the last hour' }],
  },

  // Persona 7 (Grace) — mostly clean, one anomaly buried in the middle
  { senderIdx: 6, receiverIdx: 1, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 40, daysAgo: 18, hour: 14, flagged: false },
  { senderIdx: 6, receiverIdx: 1, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 65, daysAgo: 14, hour: 12, flagged: false },
  {
    senderIdx: 6, receiverIdx: 3, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 5500,
    daysAgo: 10, hour: 13, flagged: true, riskScore: 30,
    reason: 'Amount SGD 5500.00 exceeds large transaction threshold of SGD 5,000',
    rules: [{ rule_name: 'LARGE_AMOUNT', details: 'Amount SGD 5500.00 exceeds large transaction threshold of SGD 5,000' }],
  },
  { senderIdx: 6, receiverIdx: 1, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 30, daysAgo: 6, hour: 11, flagged: false },
  { senderIdx: 6, receiverIdx: 1, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 55, daysAgo: 2, hour: 9,  flagged: false },

  // Persona 8 (Hassan) — structuring: two sub-threshold transfers, then one
  // that pushes the 1-hour total over SGD 5,000
  { senderIdx: 7, receiverIdx: 8, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 2000, daysAgo: 7, hour: 15, minuteOffset: 0,  flagged: false },
  { senderIdx: 7, receiverIdx: 8, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 2000, daysAgo: 7, hour: 15, minuteOffset: 12, flagged: false },
  {
    senderIdx: 7, receiverIdx: 8, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 2000,
    daysAgo: 7, hour: 15, minuteOffset: 24, flagged: true, riskScore: 55,
    reason: 'Multiple transfers to this recipient within the hour total SGD 6000.00, exceeding SGD 5,000',
    rules: [{ rule_name: 'SPLIT_TRANSFERS', details: 'Multiple transfers to this recipient within the hour total SGD 6000.00, exceeding SGD 5,000' }],
  },

  // Persona 9 (Ivy) — new recipient alone, daytime: triggers the rule but
  // does NOT block, proving the combo-only design
  { senderIdx: 8, receiverIdx: 9, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 90, daysAgo: 5, hour: 14, flagged: false },

  // Persona 10 (Jason) — establishes a relationship, then sends again at an
  // unusual hour: proves UNUSUAL_HOUR alone does NOT block a known recipient
  { senderIdx: 9, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 25, daysAgo: 16, hour: 12, flagged: false },
  { senderIdx: 9, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 25, daysAgo: 1,  hour: 3,  flagged: false },

  // Persona 11 (Karen) — a large-amount transfer, combined with her top-up
  // velocity flag below (both within the 30-day window) this demonstrates
  // the aggregate risk score: 30 (this) + 35 (top-up) = 65.
  {
    senderIdx: 10, receiverIdx: 0, senderCurrency: 'SGD', receiverCurrency: 'SGD', amount: 6500,
    daysAgo: 2, hour: 16, flagged: true, riskScore: 30,
    reason: 'Amount SGD 6500.00 exceeds large transaction threshold of SGD 5,000',
    rules: [{ rule_name: 'LARGE_AMOUNT', details: 'Amount SGD 6500.00 exceeds large transaction threshold of SGD 5,000' }],
  },
];

interface SeedTopup {
  personaIdx: number;
  currency: Currency;
  amount: number;
  daysAgo: number;
  hour: number;
  minuteOffset?: number;
  status: 'pending' | 'completed';
  flagged: boolean;
  reason?: string;
  riskScore?: number;
}

const TOPUPS: SeedTopup[] = [
  // Persona 1 (Alice) & 2 (Brandon) — ordinary clean top-ups
  { personaIdx: 0, currency: 'SGD', amount: 100, daysAgo: 9, hour: 12, status: 'completed', flagged: false },
  { personaIdx: 1, currency: 'SGD', amount: 150, daysAgo: 5, hour: 14, status: 'completed', flagged: false },
  // Persona 7 (Grace) — an abandoned Stripe checkout, still shown as pending
  { personaIdx: 6, currency: 'SGD', amount: 80, daysAgo: 1, hour: 19, status: 'pending', flagged: false },

  // Persona 11 (Karen) — rapid top-ups trip TOPUP_VELOCITY on the 3rd attempt
  { personaIdx: 10, currency: 'SGD', amount: 20, daysAgo: 3, hour: 21, minuteOffset: 0, status: 'completed', flagged: false },
  { personaIdx: 10, currency: 'SGD', amount: 20, daysAgo: 3, hour: 21, minuteOffset: 3, status: 'completed', flagged: false },
  {
    personaIdx: 10, currency: 'SGD', amount: 20, daysAgo: 3, hour: 21, minuteOffset: 6,
    status: 'completed', flagged: true, riskScore: 35,
    reason: '3 top-up attempts in the last 10 minutes',
  },
];

const seed = async (): Promise<void> => {
  const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [PERSONAS[0].email]);
  if (existing[0]) {
    console.log('Demo data already present (demo1@miyupay.dev exists) — skipping.');
    return;
  }

  console.log(`Creating ${PERSONAS.length} demo users...`);
  const userIds: string[] = [];
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const persona of PERSONAS) {
    const { rows: [user] } = await db.query<{ id: string }>(
      `INSERT INTO users (email,password_hash,full_name,country,is_verified)
       VALUES ($1,$2,$3,'SGP',TRUE) RETURNING id`,
      [persona.email, hash, persona.fullName]
    );
    userIds.push(user.id);

    for (const [currency, balance] of Object.entries(SEED_BALANCES)) {
      await db.query('INSERT INTO wallets (user_id,currency,balance) VALUES ($1,$2,$3)', [user.id, currency, balance]);
    }
  }

  const { rows: rateRows } = await db.query<{ from_currency: Currency; to_currency: Currency; rate: string }>(
    'SELECT from_currency, to_currency, rate FROM exchange_rates'
  );
  const rateMap = new Map(rateRows.map(r => [`${r.from_currency}_${r.to_currency}`, parseFloat(r.rate)]));

  console.log(`Inserting ${TRANSACTIONS.length} demo transactions...`);
  for (const tx of TRANSACTIONS) {
    const senderId = userIds[tx.senderIdx];
    const receiverId = userIds[tx.receiverIdx];
    const rate = rateMap.get(`${tx.senderCurrency}_${tx.receiverCurrency}`) ?? 1;
    const receiverAmount = parseFloat((tx.amount * rate).toFixed(6));
    const isCrossBorder = tx.senderCurrency !== tx.receiverCurrency;
    const createdAt = at(tx.daysAgo, tx.hour, tx.minuteOffset);
    const status = tx.flagged ? 'flagged' : 'completed';

    const { rows: [inserted] } = await db.query<{ id: string }>(
      `INSERT INTO transactions
        (reference_code,sender_id,receiver_id,sender_currency,receiver_currency,
         sender_amount,receiver_amount,exchange_rate,is_cross_border,
         status,fraud_flagged,fraud_reason,risk_score,created_at,completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [generateReference(), senderId, receiverId, tx.senderCurrency, tx.receiverCurrency,
       tx.amount, receiverAmount, rate, isCrossBorder,
       status, tx.flagged, tx.reason ?? null, tx.riskScore ?? 0,
       createdAt, tx.flagged ? null : createdAt]
    );

    if (tx.flagged) {
      for (const rule of tx.rules ?? []) {
        await db.query(
          'INSERT INTO fraud_checks (transaction_id,rule_name,triggered,details,created_at) VALUES ($1,$2,TRUE,$3,$4)',
          [inserted.id, rule.rule_name, rule.details, createdAt]
        );
      }
      await db.query(
        `INSERT INTO audit_log (transaction_id,user_id,event_type,new_status,metadata,created_at)
         VALUES ($1,$2,'TRANSACTION_CREATED','flagged',$3,$4)`,
        [inserted.id, senderId, JSON.stringify({ fraud_flagged: true }), createdAt]
      );
      continue;
    }

    const { rows: [debitWallet] } = await db.query<{ id: string; balance: string }>(
      `UPDATE wallets SET balance = balance - $1, updated_at = $2
       WHERE user_id = $3 AND currency = $4 RETURNING id, balance`,
      [tx.amount, createdAt, senderId, tx.senderCurrency]
    );
    const { rows: [creditWallet] } = await db.query<{ id: string; balance: string }>(
      `UPDATE wallets SET balance = balance + $1, updated_at = $2
       WHERE user_id = $3 AND currency = $4 RETURNING id, balance`,
      [receiverAmount, createdAt, receiverId, tx.receiverCurrency]
    );

    await db.query(
      `INSERT INTO ledger_entries (transaction_id,wallet_id,entry_type,currency,amount,balance_after,created_at)
       VALUES ($1,$2,'DEBIT',$3,$4,$5,$6)`,
      [inserted.id, debitWallet.id, tx.senderCurrency, tx.amount, parseFloat(debitWallet.balance), createdAt]
    );
    await db.query(
      `INSERT INTO ledger_entries (transaction_id,wallet_id,entry_type,currency,amount,balance_after,created_at)
       VALUES ($1,$2,'CREDIT',$3,$4,$5,$6)`,
      [inserted.id, creditWallet.id, tx.receiverCurrency, receiverAmount, parseFloat(creditWallet.balance), createdAt]
    );
    await db.query(
      `INSERT INTO audit_log (transaction_id,user_id,event_type,old_status,new_status,created_at)
       VALUES ($1,$2,'TRANSACTION_COMPLETED','processing','completed',$3)`,
      [inserted.id, senderId, createdAt]
    );
  }

  const { rows: [clearingWallet] } = await db.query<{ id: string }>(
    `SELECT id FROM wallets WHERE user_id = $1 AND currency = 'SGD'`,
    [CLEARING_ACCOUNT_ID]
  );

  console.log(`Inserting ${TOPUPS.length} demo top-ups...`);
  for (const tp of TOPUPS) {
    const userId = userIds[tp.personaIdx];
    const createdAt = at(tp.daysAgo, tp.hour, tp.minuteOffset);

    const { rows: [insertedTopup] } = await db.query<{ id: string }>(
      `INSERT INTO topups
        (user_id,stripe_session_id,currency,amount,status,fraud_flagged,fraud_reason,risk_score,created_at,completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [userId, `cs_test_seed_${tp.personaIdx}_${createdAt.getTime()}`, tp.currency, tp.amount,
       tp.status, tp.flagged, tp.reason ?? null, tp.riskScore ?? 0,
       createdAt, tp.status === 'completed' ? createdAt : null]
    );

    if (tp.status !== 'completed') continue;

    // Same double-entry pattern as topupController.confirmTopup — DEBIT the
    // clearing wallet, CREDIT the user's.
    const { rows: [debitClearing] } = await db.query<{ balance: string }>(
      `UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3 RETURNING balance`,
      [tp.amount, createdAt, clearingWallet.id]
    );
    const { rows: [creditUser] } = await db.query<{ id: string; balance: string }>(
      `UPDATE wallets SET balance = balance + $1, updated_at = $2
       WHERE user_id = $3 AND currency = $4 RETURNING id, balance`,
      [tp.amount, createdAt, userId, tp.currency]
    );

    await db.query(
      `INSERT INTO ledger_entries (topup_id,wallet_id,entry_type,currency,amount,balance_after,created_at)
       VALUES ($1,$2,'DEBIT',$3,$4,$5,$6)`,
      [insertedTopup.id, clearingWallet.id, tp.currency, tp.amount, parseFloat(debitClearing.balance), createdAt]
    );
    await db.query(
      `INSERT INTO ledger_entries (topup_id,wallet_id,entry_type,currency,amount,balance_after,created_at)
       VALUES ($1,$2,'CREDIT',$3,$4,$5,$6)`,
      [insertedTopup.id, creditUser.id, tp.currency, tp.amount, parseFloat(creditUser.balance), createdAt]
    );
    await db.query(
      `INSERT INTO audit_log (user_id,event_type,metadata,created_at)
       VALUES ($1,'WALLET_TOPUP',$2,$3)`,
      [userId, JSON.stringify({ amount: tp.amount, currency: tp.currency }), createdAt]
    );
  }

  console.log(`Done. All ${PERSONAS.length} demo accounts share the password: ` + DEMO_PASSWORD);
  console.log('To explore the admin panel, promote one manually, e.g.:');
  console.log(`  UPDATE users SET role='admin' WHERE email='${PERSONAS[0].email}';`);
};

seed()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => db.pool.end());
