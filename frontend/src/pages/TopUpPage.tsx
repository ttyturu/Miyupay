import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CurrencyCircleDollarIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { topupService } from '../services/api';

const PRESETS = [50, 100, 500];

export default function TopUpPage() {
  const [selected, setSelected] = useState<number | null>(100);
  const [custom, setCustom] = useState('');

  const amount = custom ? parseFloat(custom) : selected ?? 0;
  const isValidAmount = amount > 0 && amount <= 10000;

  const mutation = useMutation({
    mutationFn: () => topupService.createSession(amount),
    onSuccess: data => { window.location.href = data.url; },
  });

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Add credit</h1>
      <p className="text-sm text-muted-foreground mb-6">Top up your SGD wallet via Stripe (test mode).</p>

      <div className="bg-card border border-border rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 text-secondary mb-4">
          <CurrencyCircleDollarIcon size={21} weight="fill" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount (SGD)</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {PRESETS.map(p => (
            <button key={p} type="button"
              onClick={() => { setSelected(p); setCustom(''); }}
              className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                selected === p && !custom
                  ? 'bg-secondary text-white border-secondary'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              S${p}
            </button>
          ))}
        </div>

        <label htmlFor="topup-custom" className="block text-sm font-medium text-muted-foreground mb-1">
          Or enter a custom amount
        </label>
        <input id="topup-custom" type="number" min="1" max="10000" step="0.01" placeholder="0.00"
          value={custom}
          onChange={e => { setCustom(e.target.value); setSelected(null); }}
          className="w-full border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary mb-4"
        />

        {mutation.error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive mb-4">
            <WarningCircleIcon size={14} weight="fill" />
            {(mutation.error as any).response?.data?.error || 'Something went wrong'}
          </p>
        )}

        <button type="button" disabled={!isValidAmount || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="w-full bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {mutation.isPending ? 'Redirecting to Stripe…' : `Add S$${amount > 0 ? amount.toFixed(2) : '0.00'}`}
        </button>
        <p className="text-sm text-muted-foreground text-center mt-3">
          Test mode — use card <span className="font-mono">4242 4242 4242 4242</span>, any future date and CVC.
        </p>
      </div>
    </div>
  );
}
