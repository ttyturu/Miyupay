import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PlusCircleIcon } from '@phosphor-icons/react';
import { adminService } from '../services/api';
import { Currency } from '../types';
import Avatar from '../components/ui/Avatar';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };

const riskBadge = (score: number) => {
  if (score >= 50) return <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full whitespace-nowrap">high risk · {score}</span>;
  return <span className="text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full whitespace-nowrap">medium risk · {score}</span>;
};

// Deep-links into the admin lookup page, pre-filled and auto-searched —
// clicking a name here is how an admin jumps from "something looks
// suspicious" to "here's this person's full history."
function PersonLink({ name, email }: { name: string; email: string }) {
  return (
    <Link to={`/admin?email=${encodeURIComponent(email)}`} className="hover:text-secondary transition-colors">
      {name}
    </Link>
  );
}

export default function AdminFlaggedPage() {
  const [sort, setSort] = useState<'recent' | 'risk'>('recent');

  const { data: activity, isLoading } = useQuery({
    queryKey: ['admin-flagged', sort],
    queryFn: () => adminService.getFlagged(sort),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Flagged activity</h1>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['recent', 'risk'] as const).map(s => (
            <button key={s} type="button" onClick={() => setSort(s)}
              className={`text-sm px-3 py-1 rounded-md font-medium transition-colors ${
                sort === s ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {s === 'recent' ? 'Most recent' : 'By risk'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">All fraud-flagged transfers and top-ups across every user.</p>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : !activity?.length ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No flagged activity.</div>
      ) : (
        <div className="space-y-2">
          {activity.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-lg shadow-sm p-4">
              <div className="flex items-start gap-2.5">
                {item.type === 'topup' ? (
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                    <PlusCircleIcon size={18} weight="fill" className="text-success" />
                  </div>
                ) : (
                  <Avatar name={item.sender_name} size={32} className="mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground truncate">
                      {item.type === 'topup'
                        ? <PersonLink name={item.user_full_name} email={item.user_email} />
                        : <>
                            <PersonLink name={item.sender_name} email={item.sender_email} />
                            {' → '}
                            <PersonLink name={item.receiver_name} email={item.receiver_email} />
                          </>}
                    </p>
                    <span className="text-sm font-mono font-semibold tabular-nums whitespace-nowrap text-foreground">
                      {item.type === 'topup'
                        ? `+${SYMBOLS[item.currency]}${Number(item.amount).toFixed(2)}`
                        : `${SYMBOLS[item.sender_currency]}${Number(item.sender_amount).toFixed(2)}`}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                    {item.type === 'transfer' ? `${item.reference_code} · ` : 'Top-up via Stripe · '}
                    {new Date(item.created_at).toLocaleString('en-SG')}
                  </p>
                  {item.fraud_reason && <p className="text-sm text-warning mt-0.5">{item.fraud_reason}</p>}
                  <div className="mt-2">{riskBadge(item.risk_score)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
