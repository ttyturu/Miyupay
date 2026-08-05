// All shared TypeScript types for MiyuPay

export type Currency = 'SGD' | 'MYR' | 'THB';
export type Country  = 'SGP' | 'MYS' | 'THA';
export type TxStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'flagged';
export type EntryType = 'DEBIT' | 'CREDIT';
export type Role = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  country: Country;
  role: Role;
  frozen: boolean;
  is_active: boolean;
  created_at: Date;
}

export interface Wallet {
  id: string;
  user_id: string;
  currency: Currency;
  balance: number;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  reference_code: string;
  sender_id: string;
  receiver_id: string;
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
  created_at: Date;
  completed_at: Date | null;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string | null;
  topup_id: string | null;
  wallet_id: string;
  entry_type: EntryType;
  currency: Currency;
  amount: number;
  balance_after: number;
  created_at: Date;
}

export type TopupStatus = 'pending' | 'completed';

export interface Topup {
  id: string;
  user_id: string;
  stripe_session_id: string;
  currency: Currency;
  amount: number;
  status: TopupStatus;
  fraud_flagged: boolean;
  fraud_reason: string | null;
  risk_score: number;
  created_at: Date;
  completed_at: Date | null;
}

export interface FraudCheck {
  rule_name: string;
  triggered: boolean;
  details: string | null;
}

export interface FraudResult {
  flagged: boolean;
  reason: string | null;
  rules: FraudCheck[];
  isNewRecipient: boolean;
  riskScore: number;
}

// Merged activity feed — a transfer and a top-up rendered in one chronological
// list (Transactions page, Dashboard recent activity, admin lookup/flagged).
export interface TransferActivity extends Transaction {
  type: 'transfer';
  sender_name: string;
  sender_email: string;
  receiver_name: string;
  receiver_email: string;
}

export interface TopupActivity extends Topup {
  type: 'topup';
  user_full_name: string;
  user_email: string;
}

export type ActivityItem = TransferActivity | TopupActivity;

export interface ExchangeRate {
  from_currency: Currency;
  to_currency: Currency;
  rate: number;
}

// Standard API response shapes
export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  fields?: Record<string, string>;
}

// JWT payload
export interface JwtPayload {
  userId: string;
  email: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
