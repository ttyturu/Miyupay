import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WarningCircleIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { adminService } from '../../services/api';
import { Currency, ActivityItem } from '../../types';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };

function LedgerTab({ item }: { item: ActivityItem }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-ledger', item.type, item.id],
    queryFn: () => item.type === 'transfer'
      ? adminService.getTransactionLedger(item.id)
      : adminService.getTopupLedger(item.id),
  });

  if (isLoading) return <div className="h-16 bg-muted rounded-lg animate-pulse" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No ledger entries yet — funds haven't been posted.</p>;

  return (
    <div className="space-y-1.5">
      {data.map(entry => (
        <div key={entry.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              entry.entry_type === 'CREDIT' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            }`}>
              {entry.entry_type}
            </span>
            <span className="text-sm text-foreground font-medium">{entry.wallet_owner}</span>
          </div>
          <div className="text-right">
            <p className={`text-sm font-mono font-semibold tabular-nums ${
              entry.entry_type === 'CREDIT' ? 'text-success' : 'text-destructive'
            }`}>
              {entry.entry_type === 'CREDIT' ? '+' : '-'}{SYMBOLS[entry.currency]}{Number(entry.amount).toFixed(2)}
            </p>
            <p className="text-sm font-mono text-muted-foreground">
              bal {SYMBOLS[entry.currency]}{Number(entry.balance_after).toFixed(2)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FraudTab({ txId }: { txId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-fraud', txId],
    queryFn: () => adminService.getTransactionFraud(txId),
  });

  if (isLoading) return <div className="h-16 bg-muted rounded-lg animate-pulse" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No fraud rules were evaluated for this transaction.</p>;

  return (
    <div className="space-y-1.5">
      {data.map(check => (
        <div key={check.id} className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
          {check.triggered
            ? <WarningCircleIcon size={16} weight="fill" className="text-warning shrink-0 mt-0.5" />
            : <CheckCircleIcon size={16} weight="fill" className="text-success shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-semibold text-foreground">{check.rule_name.replace(/_/g, ' ')}</p>
            <p className="text-sm text-muted-foreground">{check.triggered ? 'Triggered' : 'Passed'}{check.details ? ` — ${check.details}` : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Admin-only expandable detail — migrated from the old customer-facing Audit
// Trail page. Top-ups only ever get a ledger tab (a single CREDIT entry,
// nothing rule-by-rule to show); transfers get both tabs.
export default function AdminActivityDetail({ item }: { item: ActivityItem }) {
  const [tab, setTab] = useState<'ledger' | 'fraud'>('ledger');
  const showFraudTab = item.type === 'transfer';

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setTab('ledger')}
          className={`text-sm px-2.5 py-1 rounded-lg font-medium transition-colors ${
            tab === 'ledger' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-primary'
          }`}
        >
          Ledger entries
        </button>
        {showFraudTab && (
          <button
            type="button"
            onClick={() => setTab('fraud')}
            className={`text-sm px-2.5 py-1 rounded-lg font-medium transition-colors ${
              tab === 'fraud' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-primary'
            }`}
          >
            Fraud check
          </button>
        )}
      </div>
      {tab === 'ledger' || !showFraudTab
        ? <LedgerTab item={item} />
        : <FraudTab txId={item.id} />}
    </div>
  );
}
