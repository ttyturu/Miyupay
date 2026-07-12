import { useQuery } from '@tanstack/react-query';
import { transactionService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Currency } from '../types';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };

export default function TransactionsPage() {
  const { user } = useAuth();
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: transactionService.getAll,
  });

  const statusBadge = (status: string, flagged: boolean) => {
    if (flagged) return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">flagged</span>;
    if (status === 'completed') return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">completed</span>;
    return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{status}</span>;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Transactions</h1>
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !transactions?.length ? (
        <div className="text-center py-12 text-sm text-gray-400">No transactions yet.</div>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => {
            const isSender = tx.sender_id === user?.id;
            const currency = isSender ? tx.sender_currency : tx.receiver_currency;
            const amount   = isSender ? tx.sender_amount  : tx.receiver_amount;
            return (
              <div key={tx.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {isSender ? `→ ${tx.receiver_name}` : `← ${tx.sender_name}`}
                      </span>
                      {statusBadge(tx.status, tx.fraud_flagged)}
                      {tx.is_cross_border && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">cross-border</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tx.reference_code} · {new Date(tx.created_at).toLocaleDateString('en-SG')}
                    </p>
                    {tx.note && <p className="text-xs text-gray-500 mt-1">{tx.note}</p>}
                    {tx.fraud_flagged && tx.fraud_reason && (
                      <p className="text-xs text-amber-600 mt-1">{tx.fraud_reason}</p>
                    )}
                    {tx.is_cross_border && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {isSender
                          ? `${tx.sender_currency} → ${tx.receiver_currency} · rate ${Number(tx.exchange_rate).toFixed(4)}`
                          : `${tx.sender_currency} → ${tx.receiver_currency}`}
                      </p>
                    )}
                  </div>
                  <span className={`text-sm font-medium ml-4 ${
                    tx.status !== 'completed' ? 'text-gray-400' : isSender ? 'text-red-500' : 'text-green-600'
                  }`}>
                    {tx.status === 'completed' ? (isSender ? '-' : '+') : ''}{SYMBOLS[currency]}{Number(amount).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
