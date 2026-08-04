import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { topupService } from '../services/api';

export default function TopUpSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const qc = useQueryClient();
  const requested = useRef(false);

  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [result, setResult] = useState<{ amount: number; balance: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId || requested.current) return;
    requested.current = true;
    topupService.confirm(sessionId)
      .then(data => {
        setResult(data);
        setState('done');
        qc.invalidateQueries({ queryKey: ['wallets'] });
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Could not confirm payment');
        setState('error');
      });
  }, [sessionId, qc]);

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="bg-card border border-border rounded-lg shadow-sm p-6 text-center">
        {state === 'loading' && (
          <p className="text-sm text-muted-foreground py-8">Confirming your payment…</p>
        )}
        {state === 'done' && result && (
          <>
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon size={26} weight="fill" className="text-success" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Credit added</h2>
            <p className="text-sm text-muted-foreground mb-4">
              S${result.amount.toFixed(2)} has been added to your SGD wallet. New balance: S${result.balance.toFixed(2)}.
            </p>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <WarningCircleIcon size={26} weight="fill" className="text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Couldn't confirm payment</h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
          </>
        )}
        <Link to="/dashboard"
          className="inline-block w-full bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
