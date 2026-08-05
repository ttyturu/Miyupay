export type Currency = 'SGD' | 'MYR' | 'THB';
export type TxStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'flagged';

export type Role = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  country: string;
  role: Role;
  frozen: boolean;
}

export interface Wallet {
  id: string;
  user_id: string;
  currency: Currency;
  balance: number;
}

export interface Transaction {
  id: string;
  reference_code: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  receiver_name: string;
  sender_email: string;
  receiver_email: string;
  sender_currency: Currency;
  receiver_currency: Currency;
  sender_amount: number;
  receiver_amount: number;
  exchange_rate: number;
  is_cross_border: boolean;
  status: TxStatus;
  fraud_flagged: boolean;
  fraud_reason: string | null;
  risk_score: number;
  note: string | null;
  created_at: string;
  completed_at: string | null;
}

export type TopupStatus = 'pending' | 'completed';

export interface TransferActivity extends Transaction {
  type: 'transfer';
}

export interface TopupActivity {
  type: 'topup';
  id: string;
  user_id: string;
  stripe_session_id: string;
  currency: Currency;
  amount: number;
  status: TopupStatus;
  fraud_flagged: boolean;
  fraud_reason: string | null;
  risk_score: number;
  user_full_name: string;
  user_email: string;
  created_at: string;
  completed_at: string | null;
}

// A transfer and a top-up rendered in one chronological list — Transactions
// page, Dashboard recent activity, admin lookup, admin flagged list.
export type ActivityItem = TransferActivity | TopupActivity;

export interface ExchangeRate {
  from_currency: Currency;
  to_currency: Currency;
  rate: number;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string | null;
  topup_id: string | null;
  wallet_id: string;
  wallet_owner: string;
  entry_type: 'DEBIT' | 'CREDIT';
  currency: Currency;
  amount: number;
  balance_after: number;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  frozen: boolean;
  created_at: string;
}

export interface FraudCheck {
  id: string;
  transaction_id: string;
  rule_name: string;
  triggered: boolean;
  details: string | null;
  created_at: string;
}
