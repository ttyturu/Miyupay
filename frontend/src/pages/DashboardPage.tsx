import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { WalletIcon, CurrencyCircleDollarIcon, PaperPlaneTiltIcon, ClockCounterClockwiseIcon, WarningCircleIcon, PlusCircleIcon } from '@phosphor-icons/react';
import { walletService, transactionService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Currency } from '../types';
import Avatar from '../components/ui/Avatar';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };

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

  const { data: rates, isLoading: rLoading } = useQuery({
    queryKey: ['rates'],
    queryFn: transactionService.getRates,
  });

  const recent = transactions?.slice(0, 5) ?? [];
  const totalInSgd = wallets?.reduce((total, wallet) => {
    const rate = rates?.find(item => item.from_currency === wallet.currency && item.to_currency === 'SGD');
    return total + (rate ? Number(wallet.balance) * Number(rate.rate) : 0);
  }, 0);
  const totalReady = !wLoading && !rLoading && wallets?.every(wallet =>
    rates?.some(item => item.from_currency === wallet.currency && item.to_currency === 'SGD')
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">
        Welcome back, {user?.fullName?.split(' ')[0]}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">Your MiyuPay overview</p>

      {/* Total balance */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-secondary">
            <CurrencyCircleDollarIcon size={21} weight="fill" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total balance</p>
          </div>
          <Link to="/topup"
            className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:opacity-80 transition-opacity"
          >
            <PlusCircleIcon size={16} weight="fill" />
            Add credit
          </Link>
        </div>
        {wLoading || rLoading ? (
          <div className="h-9 w-52 bg-muted rounded animate-pulse" />
        ) : totalReady ? (
          <>
            <p className="text-3xl font-mono font-bold tabular-nums text-foreground">
              S${totalInSgd!.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Combined value of your SGD, MYR and THB wallets</p>
          </>
        ) : (
          <p className="text-sm text-destructive">Unable to load exchange rates.</p>
        )}
      </div>

      {/* Wallets */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Wallets</p>
      {wLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {wallets?.map(w => (
            <div key={w.currency} className="bg-card border border-border rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <WalletIcon size={20} className="text-secondary" weight="regular" />
                <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {w.currency}
                </span>
              </div>
              <div className="text-base font-mono font-semibold tabular-nums text-foreground">
                {SYMBOLS[w.currency]}{Number(w.balance).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mb-8">
        <Link to="/send"
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg text-center hover:opacity-90 transition-opacity">
          <PaperPlaneTiltIcon size={18} />
          Send money
        </Link>
        <Link to="/transactions"
          className="flex-1 flex items-center justify-center gap-2 border border-border bg-card text-foreground text-sm font-semibold py-2.5 rounded-lg text-center hover:bg-muted transition-colors">
          <ClockCounterClockwiseIcon size={18} />
          All transactions
        </Link>
      </div>

      {/* Recent */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent activity</p>
      {tLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : recent.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          No transactions yet. Send your first payment.
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map(item => {
            if (item.type === 'topup') return (
              <div key={item.id} className="bg-card border border-border rounded-lg shadow-sm px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                    <PlusCircleIcon size={18} weight="fill" className="text-success" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Top-up via Stripe
                  </p>
                </div>
                <span className="text-sm font-mono font-semibold tabular-nums text-success">
                  +{SYMBOLS[item.currency]}{Number(item.amount).toFixed(2)}
                </span>
              </div>
            );

            const isSender = item.sender_id === user?.id;
            const currency = isSender ? item.sender_currency : item.receiver_currency;
            const amount   = isSender ? item.sender_amount  : item.receiver_amount;
            const counterpartyName = isSender ? item.receiver_name : item.sender_name;
            return (
              <div key={item.id} className="bg-card border border-border rounded-lg shadow-sm px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={counterpartyName} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isSender ? `To ${item.receiver_name}` : `From ${item.sender_name}`}
                    </p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5 font-mono">
                      {item.reference_code}
                      {item.fraud_flagged && (
                        <span className="ml-2 flex items-center gap-0.5 text-warning font-sans">
                          <WarningCircleIcon size={12} weight="fill" /> flagged
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-mono font-semibold tabular-nums ${
                  item.status !== 'completed' ? 'text-muted-foreground' : isSender ? 'text-destructive' : 'text-success'
                }`}>
                  {item.status === 'completed' ? (isSender ? '-' : '+') : ''}{SYMBOLS[currency]}{Number(amount).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
