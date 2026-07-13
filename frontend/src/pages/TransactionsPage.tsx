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
    if (flagged) return <span className="text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full whitespace-nowrap">flagged</span>;
    if (status === 'completed') return <span className="text-xs font-medium bg-success/10 text-success px-2 py-0.5 rounded-full whitespace-nowrap">completed</span>;
    if (status === 'failed') return <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full whitespace-nowrap">failed</span>;
    return <span className="text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full whitespace-nowrap">{status}</span>;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Transactions</h1>
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : !transactions?.length ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No transactions yet.</div>
      ) : (
        <div className="bg-card border border-border rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Counterparty</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-32">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">Currency</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const isSender = tx.sender_id === user?.id;
                const currency = isSender ? tx.sender_currency : tx.receiver_currency;
                const amount   = isSender ? tx.sender_amount  : tx.receiver_amount;
                return (
                  <tr key={tx.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString('en-SG')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {isSender ? `→ ${tx.receiver_name}` : `← ${tx.sender_name}`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5 font-mono">{tx.reference_code}</p>
                      {tx.note && <p className="text-sm text-muted-foreground mt-0.5">{tx.note}</p>}
                      {tx.fraud_flagged && tx.fraud_reason && (
                        <p className="text-sm text-warning mt-0.5">{tx.fraud_reason}</p>
                      )}
                      {tx.is_cross_border && (
                        <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                          {isSender
                            ? `${tx.sender_currency} → ${tx.receiver_currency} · rate ${Number(tx.exchange_rate).toFixed(4)}`
                            : `${tx.sender_currency} → ${tx.receiver_currency}`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        {statusBadge(tx.status, tx.fraud_flagged)}
                        {tx.is_cross_border && (
                          <span className="text-xs font-medium bg-secondary/10 text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">cross-border</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{currency}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                      tx.status !== 'completed' ? 'text-muted-foreground' : isSender ? 'text-destructive' : 'text-success'
                    }`}>
                      {tx.status === 'completed' ? (isSender ? '-' : '+') : ''}{SYMBOLS[currency]}{Number(amount).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
