// All shared TypeScript types for MiyuPay

export type Currency = 'SGD' | 'MYR' | 'THB';
export type Country  = 'SGP' | 'MYS' | 'THA';
export type TxStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'flagged';
export type EntryType = 'DEBIT' | 'CREDIT';

export interface User {
  id: string;
  email: string;
  full_name: string;
  country: Country;
  is_active: boolean;
  created_at: Date;
}

export interface Wallet {
  id: string;
  user_id: string;
  currency: Currency;
  balance: number;
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
  note: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  wallet_id: string;
  entry_type: EntryType;
  currency: Currency;
  amount: number;
  balance_after: number;
  created_at: Date;
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
}

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
