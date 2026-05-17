import { useQuery } from '@tanstack/react-query';
import { auditService } from '../services/api';

const EVENT_COLORS: Record<string, string> = {
  TRANSACTION_CREATED:   'bg-blue-100 text-blue-700',
  TRANSACTION_COMPLETED: 'bg-green-100 text-green-700',
  TRANSACTION_FLAGGED:   'bg-amber-100 text-amber-700',
  TRANSACTION_FAILED:    'bg-red-100 text-red-700',
};

export default function AuditPage() {
  const { data: log, isLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: auditService.getLog,
    refetchInterval: 10_000,
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Audit Trail</h1>
      <p className="text-sm text-gray-400 mb-6">
        Immutable record of every transaction state change. Append-only — nothing is ever edited or deleted.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !log?.length ? (
        <div className="text-center py-12 text-sm text-gray-400">
          No audit entries yet. Send a payment to see events appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {log.map(entry => (
            <div key={entry.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EVENT_COLORS[entry.event_type] || 'bg-gray-100 text-gray-600'}`}>
                      {entry.event_type.replace(/_/g, ' ')}
                    </span>
                    {entry.reference_code && (
                      <span className="text-xs font-mono text-gray-500">{entry.reference_code}</span>
                    )}
                  </div>
                  {(entry.old_status || entry.new_status) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {entry.old_status && `${entry.old_status} → `}{entry.new_status}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString('en-SG')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
