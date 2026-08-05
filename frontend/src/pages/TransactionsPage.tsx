import { useQuery } from '@tanstack/react-query';
import { PlusCircleIcon } from '@phosphor-icons/react';
import { transactionService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Currency, ActivityItem } from '../types';
import Avatar from '../components/ui/Avatar';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };

export default function TransactionsPage() {
  const { user } = useAuth();
  const { data: activity, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: transactionService.getAll,
  });

  const statusBadge = (status: string, flagged: boolean) => {
    if (flagged) return <span className="text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full whitespace-nowrap">flagged</span>;
    if (status === 'completed') return <span className="text-xs font-medium bg-success/10 text-success px-2 py-0.5 rounded-full whitespace-nowrap">completed</span>;
    if (status === 'failed') return <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full whitespace-nowrap">failed</span>;
    return <span className="text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full whitespace-nowrap">{status}</span>;
  };

  const describe = (item: Extract<ActivityItem, { type: 'transfer' }>) => {
    const isSender = item.sender_id === user?.id;
    const currency = isSender ? item.sender_currency : item.receiver_currency;
    const amount   = isSender ? item.sender_amount  : item.receiver_amount;
    const counterpartyName = isSender ? item.receiver_name : item.sender_name;
    return { isSender, currency, amount, counterpartyName };
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Transactions</h1>
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : !activity?.length ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No transactions yet.</div>
      ) : (
        <>
          {/* Card list — mobile */}
          <div className="md:hidden space-y-2">
            {activity.map(item => {
              if (item.type === 'topup') return (
                <div key={item.id} className="bg-card border border-border rounded-lg shadow-sm p-4">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                      <PlusCircleIcon size={18} weight="fill" className="text-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground truncate">Top-up via Stripe</p>
                        <span className="text-sm font-mono font-semibold tabular-nums whitespace-nowrap text-success">
                          +{SYMBOLS[item.currency]}{Number(item.amount).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                        {new Date(item.created_at).toLocaleDateString('en-SG')}
                      </p>
                      <div className="mt-2">
                        {item.status === 'pending'
                          ? <span className="text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full">pending</span>
                          : <span className="text-xs font-medium bg-success/10 text-success px-2 py-0.5 rounded-full">completed</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );

              const { isSender, currency, amount, counterpartyName } = describe(item);
              return (
                <div key={item.id} className="bg-card border border-border rounded-lg shadow-sm p-4">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={counterpartyName} size={32} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground truncate">
                          {isSender ? `→ ${item.receiver_name}` : `← ${item.sender_name}`}
                        </p>
                        <span className={`text-sm font-mono font-semibold tabular-nums whitespace-nowrap ${
                          item.status !== 'completed' ? 'text-muted-foreground' : isSender ? 'text-destructive' : 'text-success'
                        }`}>
                          {item.status === 'completed' ? (isSender ? '-' : '+') : ''}{SYMBOLS[currency]}{Number(amount).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                        {item.reference_code} · {new Date(item.created_at).toLocaleDateString('en-SG')}
                      </p>
                      {item.note && <p className="text-sm text-muted-foreground mt-0.5">{item.note}</p>}
                      {item.fraud_flagged && item.fraud_reason && (
                        <p className="text-sm text-warning mt-0.5">{item.fraud_reason}</p>
                      )}
                      {item.is_cross_border && (
                        <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                          {isSender
                            ? `${item.sender_currency} → ${item.receiver_currency} · rate ${Number(item.exchange_rate).toFixed(4)}`
                            : `${item.sender_currency} → ${item.receiver_currency}`}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {statusBadge(item.status, item.fraud_flagged)}
                        {item.is_cross_border && (
                          <span className="text-xs font-medium bg-secondary/10 text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">cross-border</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table — tablet/desktop */}
          <div className="hidden md:block bg-card border border-border rounded-lg shadow-sm overflow-x-auto">
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
                {activity.map(item => {
                  if (item.type === 'topup') return (
                    <tr key={item.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('en-SG')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                            <PlusCircleIcon size={16} weight="fill" className="text-success" />
                          </div>
                          <p className="font-medium text-foreground">Top-up via Stripe</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'pending'
                          ? <span className="text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full whitespace-nowrap">pending</span>
                          : <span className="text-xs font-medium bg-success/10 text-success px-2 py-0.5 rounded-full whitespace-nowrap">completed</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{item.currency}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-success">
                        +{SYMBOLS[item.currency]}{Number(item.amount).toFixed(2)}
                      </td>
                    </tr>
                  );

                  const { isSender, currency, amount, counterpartyName } = describe(item);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('en-SG')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <Avatar name={counterpartyName} size={28} className="mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">
                              {isSender ? `→ ${item.receiver_name}` : `← ${item.sender_name}`}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5 font-mono">{item.reference_code}</p>
                            {item.note && <p className="text-sm text-muted-foreground mt-0.5">{item.note}</p>}
                            {item.fraud_flagged && item.fraud_reason && (
                              <p className="text-sm text-warning mt-0.5">{item.fraud_reason}</p>
                            )}
                            {item.is_cross_border && (
                              <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                                {isSender
                                  ? `${item.sender_currency} → ${item.receiver_currency} · rate ${Number(item.exchange_rate).toFixed(4)}`
                                  : `${item.sender_currency} → ${item.receiver_currency}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {statusBadge(item.status, item.fraud_flagged)}
                          {item.is_cross_border && (
                            <span className="text-xs font-medium bg-secondary/10 text-secondary px-2 py-0.5 rounded-full whitespace-nowrap">cross-border</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{currency}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                        item.status !== 'completed' ? 'text-muted-foreground' : isSender ? 'text-destructive' : 'text-success'
                      }`}>
                        {item.status === 'completed' ? (isSender ? '-' : '+') : ''}{SYMBOLS[currency]}{Number(amount).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
