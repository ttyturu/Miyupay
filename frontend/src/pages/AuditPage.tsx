import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheckIcon, CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import { auditService } from '../services/api';

const EVENT_COLORS: Record<string, string> = {
  TRANSACTION_CREATED:   'bg-secondary/10 text-secondary',
  TRANSACTION_COMPLETED: 'bg-success/10 text-success',
  TRANSACTION_FLAGGED:   'bg-warning/10 text-warning',
  TRANSACTION_FAILED:    'bg-destructive/10 text-destructive',
};

function AuditDetail({ txId }: { txId: string }) {
  const [tab, setTab] = useState<'ledger' | 'fraud'>('ledger');
  const { data, isLoading } = useQuery({
    queryKey: ['audit-detail', tab, txId],
    queryFn: () => (tab === 'ledger' ? auditService.getLedger(txId) : auditService.getFraud(txId)),
  });

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex gap-1 mb-2">
        {(['ledger', 'fraud'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-primary'
            }`}
          >
            {t === 'ledger' ? 'Ledger entries' : 'Fraud check'}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="h-16 bg-muted rounded-lg animate-pulse" />
      ) : (
        <pre className="text-xs font-mono bg-primary text-primary-foreground/90 rounded-lg p-3 overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditPage() {
  const { data: log, isLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: auditService.getLog,
    refetchInterval: 10_000,
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheckIcon size={24} weight="fill" className="text-secondary" />
        <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Immutable record of every transaction state change. Append-only — nothing is ever edited or deleted.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : !log?.length ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No audit entries yet. Send a payment to see events appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {log.map(entry => {
            const isOpen = expanded === entry.id;
            return (
              <div key={entry.id} className="bg-card border border-border rounded-lg shadow-sm px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EVENT_COLORS[entry.event_type] || 'bg-muted text-muted-foreground'}`}>
                        {entry.event_type.replace(/_/g, ' ')}
                      </span>
                      {entry.reference_code && (
                        <span className="text-xs font-mono text-muted-foreground">{entry.reference_code}</span>
                      )}
                    </div>
                    {(entry.old_status || entry.new_status) && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {entry.old_status && `${entry.old_status} → `}{entry.new_status}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString('en-SG')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="flex items-center gap-1 text-xs font-medium text-secondary mt-2 hover:text-primary transition-colors"
                >
                  {isOpen ? <CaretUpIcon size={12} /> : <CaretDownIcon size={12} />}
                  {isOpen ? 'Hide detail' : 'View ledger / fraud-check detail'}
                </button>
                {isOpen && <AuditDetail txId={entry.transaction_id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
