import axios from 'axios';
import { User, Wallet, Transaction, ExchangeRate, AuditEntry, LedgerEntry, FraudCheck } from '../types';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api`, timeout: 10_000 });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('miyupay_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authService = {
  register: (data: { email: string; password: string; fullName: string; country: string }) =>
    api.post<{ user: User; verificationCode: string }>('/auth/register', data).then(r => r.data),
  verifyEmail: (data: { email: string; code: string }) =>
    api.post<{ token: string; user: User }>('/auth/verify-email', data).then(r => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/login', data).then(r => r.data),
  forgotPassword: (email: string) =>
    api.post<{ resetCode: string }>('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/reset-password', data).then(r => r.data),
  me: () =>
    api.get<User>('/auth/me').then(r => r.data),
};

export const walletService = {
  getWallets: () =>
    api.get<Wallet[]>('/wallet').then(r => r.data),
  convert: (data: { fromCurrency: string; toCurrency: string; amount: number }) =>
    api.post<{
      fromCurrency: string; toCurrency: string; sourceAmount: number; receivedAmount: number; exchangeRate: number;
    }>('/wallet/convert', data).then(r => r.data),
};

export const transactionService = {
  getAll: () =>
    api.get<Transaction[]>('/transactions').then(r => r.data),
  checkRecipient: (email: string) =>
    api.get<{ isNewRecipient: boolean }>('/transactions/recipient-check', { params: { email } }).then(r => r.data),
  send: (data: {
    receiverEmail: string;
    senderCurrency: string;
    receiverCurrency: string;
    amount: number;
    note?: string;
  }) => api.post<{ transaction: Transaction; flagged: boolean; message: string }>(
    '/transactions/send', data
  ).then(r => r.data),
  getRates: () =>
    api.get<ExchangeRate[]>('/transactions/rates').then(r => r.data),
};

export const topupService = {
  createSession: (amount: number) =>
    api.post<{ url: string }>('/topup/create-session', { amount }).then(r => r.data),
  confirm: (sessionId: string) =>
    api.post<{ amount: number; balance: number }>('/topup/confirm', { sessionId }).then(r => r.data),
};

export const auditService = {
  getLog: () =>
    api.get<AuditEntry[]>('/audit/log').then(r => r.data),
  getLedger: (txId: string) =>
    api.get<LedgerEntry[]>(`/audit/ledger/${txId}`).then(r => r.data),
  getFraud: (txId: string) =>
    api.get<FraudCheck[]>(`/audit/fraud/${txId}`).then(r => r.data),
};

export default api;
