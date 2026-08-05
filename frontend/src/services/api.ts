import axios from 'axios';
import { User, Wallet, Transaction, ExchangeRate, LedgerEntry, FraudCheck, AdminUser, ActivityItem } from '../types';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api`, timeout: 10_000 });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('miyupay_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    // Only treat this as "session expired" if we actually had a token — a 401
    // from a login/verify/reset attempt (no token yet) is just a normal form
    // error and should stay on the page for the user to read, not reload it.
    const hadToken = Boolean(localStorage.getItem('miyupay_token'));
    if (err.response?.status === 401 && hadToken) {
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
  freeze: () =>
    api.post<{ message: string }>('/auth/freeze').then(r => r.data),
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
    api.get<ActivityItem[]>('/transactions').then(r => r.data),
  checkRecipient: (email: string) =>
    api.get<{ isNewRecipient: boolean }>('/transactions/recipient-check', { params: { email } }).then(r => r.data),
  getRecentRecipients: () =>
    api.get<{ email: string; fullName: string }[]>('/transactions/recent-recipients').then(r => r.data),
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

export const adminService = {
  searchUsers: (q: string) =>
    api.get<{ email: string; fullName: string }[]>('/admin/users/search', { params: { q } }).then(r => r.data),
  getUserAudit: (email: string) =>
    api.get<{ user: AdminUser; activity: ActivityItem[]; aggregateRisk: number }>(
      `/admin/users/${encodeURIComponent(email)}/audit`
    ).then(r => r.data),
  getUserSummary: (email: string) =>
    api.get<{ summary: string }>(`/admin/users/${encodeURIComponent(email)}/summary`).then(r => r.data),
  getFlagged: (sort: 'recent' | 'risk') =>
    api.get<ActivityItem[]>('/admin/flagged', { params: { sort } }).then(r => r.data),
  freezeUser: (email: string, password: string) =>
    api.post<{ email: string; frozen: boolean }>(`/admin/users/${encodeURIComponent(email)}/freeze`, { password }).then(r => r.data),
  unfreezeUser: (email: string, password: string) =>
    api.post<{ email: string; frozen: boolean }>(`/admin/users/${encodeURIComponent(email)}/unfreeze`, { password }).then(r => r.data),
  getTransactionLedger: (txId: string) =>
    api.get<LedgerEntry[]>(`/admin/transactions/${txId}/ledger`).then(r => r.data),
  getTransactionFraud: (txId: string) =>
    api.get<FraudCheck[]>(`/admin/transactions/${txId}/fraud`).then(r => r.data),
  getTopupLedger: (topupId: string) =>
    api.get<LedgerEntry[]>(`/admin/topups/${topupId}/ledger`).then(r => r.data),
};

export default api;
