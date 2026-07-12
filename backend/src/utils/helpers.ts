import crypto from 'crypto';
import { Currency } from '../types';

export const generateReference = (): string => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `MP-${year}-${random}`;
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  SGD: 'S$',
  MYR: 'RM',
  THB: '฿',
};

export const formatAmount = (amount: number, currency: Currency): string =>
  `${CURRENCY_SYMBOLS[currency]}${amount.toFixed(2)}`;
