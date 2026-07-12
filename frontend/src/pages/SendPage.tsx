import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionService, walletService } from '../services/api';
import { Currency, Transaction } from '../types';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };
const CURRENCIES: Currency[] = ['SGD', 'MYR', 'THB'];

interface SendResult { transaction: Transaction; flagged: boolean; message: string; }

export default function SendPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    receiverEmail: '', senderCurrency: 'SGD' as Currency,
    receiverCurrency: 'MYR' as Currency, amount: '', note: '',
  });
  const [result, setResult] = useState<SendResult | null>(null);

  const { data: wallets } = useQuery({ queryKey: ['wallets'], queryFn: walletService.getWallets });
  const { data: rates }   = useQuery({ queryKey: ['rates'],   queryFn: transactionService.getRates });

  const senderWallet = wallets?.find(w => w.currency === form.senderCurrency);

  const rate = rates?.find(r =>
    r.from_currency === form.senderCurrency && r.to_currency === form.receiverCurrency
  );
  const receiverAmount = form.amount && rate
    ? (parseFloat(form.amount) * Number(rate.rate)).toFixed(2)
    : '';

  const mutation = useMutation({
    mutationFn: transactionService.send,
    onSuccess: data => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    mutation.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  if (result) return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${result.flagged ? 'bg-amber-100' : 'bg-green-100'}`}>
          <span className={`text-xl ${result.flagged ? 'text-amber-600' : 'text-green-600'}`}>
            {result.flagged ? '⚠' : '✓'}
          </span>
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          {result.flagged ? 'Transaction Flagged' : 'Payment Sent'}
        </h2>
        <p className="text-sm text-gray-500 mb-4">{result.message}</p>
        {result.flagged && result.transaction.fraud_reason && (() => {
          const reasons = result.transaction.fraud_reason!.split('; ');
          const isNewRecipient = reasons.some(r => r.toLowerCase().includes('first transaction'));
          return (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-left mb-4">
              <p className="text-xs text-amber-700 font-medium mb-1">Why this was flagged</p>
              <ul className="text-xs text-amber-700 list-disc pl-4 space-y-0.5">
                {reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              {isNewRecipient && (
                <p className="text-xs text-amber-600 mt-2">
                  This recipient is now on record, so "first transaction to this recipient" won't trigger again.
                  {reasons.length > 1 && ' The other reason(s) above may still apply if you retry as-is.'}
                </p>
              )}
            </div>
          );
        })()}
        <div className="bg-gray-50 rounded-xl p-3 text-left mb-4">
          <p className="text-xs text-gray-400 mb-1">Reference</p>
          <p className="text-sm font-mono font-medium text-gray-900">{result.transaction.reference_code}</p>
        </div>
        <button
          onClick={() => { setResult(null); setForm({ receiverEmail: '', senderCurrency: 'SGD', receiverCurrency: 'MYR', amount: '', note: '' }); }}
          className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
        >
          Send another
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Send money</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Recipient email</label>
          <input type="email" required placeholder="bob@example.com"
            value={form.receiverEmail}
            onChange={e => setForm(f => ({ ...f, receiverEmail: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">You send</label>
            <select value={form.senderCurrency}
              onChange={e => setForm(f => ({ ...f, senderCurrency: e.target.value as Currency }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">They receive</label>
            <select value={form.receiverCurrency}
              onChange={e => setForm(f => ({ ...f, receiverCurrency: e.target.value as Currency }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">
            Amount
            {senderWallet && (
              <span className="text-gray-400 ml-2">
                Balance: {SYMBOLS[form.senderCurrency]}{Number(senderWallet.balance).toFixed(2)}
              </span>
            )}
          </label>
          <input type="number" required min="0.01" step="0.01" placeholder="0.00"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        {receiverAmount && (
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">They receive</span>
              <span className="font-medium">{SYMBOLS[form.receiverCurrency]}{receiverAmount} {form.receiverCurrency}</span>
            </div>
            {form.senderCurrency !== form.receiverCurrency && rate && (
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Rate</span>
                <span>1 {form.senderCurrency} = {Number(rate.rate).toFixed(4)} {form.receiverCurrency}</span>
              </div>
            )}
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Note (optional)</label>
          <input type="text" placeholder="Rent, dinner, etc."
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          />
        </div>
        {mutation.error && (
          <p className="text-xs text-red-500">
            {(mutation.error as any).response?.data?.error || 'Something went wrong'}
          </p>
        )}
        <button type="submit" disabled={mutation.isPending}
          className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
