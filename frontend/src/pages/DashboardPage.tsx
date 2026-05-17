import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { walletService, transactionService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Currency } from '../types';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };
const FLAGS:   Record<Currency, string> = { SGD: '🇸🇬', MYR: '🇲🇾', THB: '🇹🇭' };

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: wallets, isLoading: wLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: walletService.getWallets,
  });

  const { data: transactions, isLoading: tLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: transactionService.getAll,
  });

  const recent = transactions?.slice(0, 5) ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">
        Welcome back, {user?.fullName?.split(' ')[0]}
      </h1>
      <p className="text-sm text-gray-400 mb-6">Your MiyuPay overview</p>

      {/* Wallets */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Wallets</p>
      {wLoading ? (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {wallets?.map(w => (
            <div key={w.currency} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-lg mb-1">{FLAGS[w.currency]}</div>
              <div className="text-xs text-gray-400">{w.currency}</div>
              <div className="text-base font-semibold text-gray-900 mt-1">
                {SYMBOLS[w.currency]}{Number(w.balance).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mb-8">
        <Link to="/send"
          className="flex-1 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl text-center hover:bg-gray-700 transition-colors">
          Send money
        </Link>
        <Link to="/transactions"
          className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl text-center hover:bg-gray-50 transition-colors">
          All transactions
        </Link>
      </div>

      {/* Recent */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Recent activity</p>
      {tLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : recent.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400">
          No transactions yet. Send your first payment.
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map(tx => {
            const isSender = tx.sender_id === user?.id;
            const currency = isSender ? tx.sender_currency : tx.receiver_currency;
            const amount   = isSender ? tx.sender_amount  : tx.receiver_amount;
            return (
              <div key={tx.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {isSender ? `To ${tx.receiver_name}` : `From ${tx.sender_name}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {tx.reference_code}
                    {tx.fraud_flagged && <span className="ml-2 text-amber-500">⚠ flagged</span>}
                  </p>
                </div>
                <span className={`text-sm font-medium ${isSender ? 'text-red-500' : 'text-green-600'}`}>
                  {isSender ? '-' : '+'}{SYMBOLS[currency]}{Number(amount).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
