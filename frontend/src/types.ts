export type Currency = 'SGD' | 'MYR' | 'THB';
export type TxStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'flagged';

export interface User {
  id: string;
  email: string;
  fullName: string;
  country: string;
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
  note: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExchangeRate {
  from_currency: Currency;
  to_currency: Currency;
  rate: number;
}

export interface AuditEntry {
  id: string;
  transaction_id: string;
  reference_code: string;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  wallet_id: string;
  wallet_owner: string;
  entry_type: 'DEBIT' | 'CREDIT';
  currency: Currency;
  amount: number;
  balance_after: number;
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
