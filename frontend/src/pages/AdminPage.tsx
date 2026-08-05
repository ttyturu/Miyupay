import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon, LockIcon, LockOpenIcon, SparkleIcon, WarningCircleIcon,
  CaretDownIcon, CaretUpIcon, PlusCircleIcon,
} from '@phosphor-icons/react';
import { adminService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Currency, ActivityItem } from '../types';
import Avatar from '../components/ui/Avatar';
import AdminActivityDetail from '../components/admin/AdminActivityDetail';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };

const riskBadge = (score: number) => {
  if (score >= 50) return <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full whitespace-nowrap">high risk</span>;
  if (score > 0) return <span className="text-xs font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full whitespace-nowrap">medium risk</span>;
  return null;
};

const aggregateRiskBadge = (score: number) => {
  const tone = score >= 50 ? 'bg-destructive/10 text-destructive' : score > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success';
  const label = score >= 50 ? 'high' : score > 0 ? 'medium' : 'none';
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${tone}`}>
      Overall risk: {score} ({label}, 30d)
    </span>
  );
};

export default function AdminPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [emailInput, setEmailInput] = useState('');
  const [searchedEmail, setSearchedEmail] = useState('');
  const [suggestions, setSuggestions] = useState<{ email: string; fullName: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [freezeAction, setFreezeAction] = useState<'freeze' | 'unfreeze' | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  // Deep link from the flagged list (/admin?email=x) — auto-search on load.
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmailInput(emailParam);
      setSearchedEmail(emailParam.toLowerCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced live search — a new admin endpoint, not the recent-recipients
  // one, since admins need to find any user, not just people they've paid.
  useEffect(() => {
    const q = emailInput.trim();
    if (!q) { setSuggestions([]); return; }
    const timer = setTimeout(() => {
      adminService.searchUsers(q).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [emailInput]);

  const { data, isLoading, isError, isFetched } = useQuery({
    queryKey: ['admin-user-audit', searchedEmail],
    queryFn: () => adminService.getUserAudit(searchedEmail),
    enabled: Boolean(searchedEmail),
    retry: false,
  });

  const freezeMutation = useMutation({
    mutationFn: (password: string) => adminService.freezeUser(searchedEmail, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-audit', searchedEmail] });
      setFreezeAction(null);
      setPasswordInput('');
    },
  });
  const unfreezeMutation = useMutation({
    mutationFn: (password: string) => adminService.unfreezeUser(searchedEmail, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-audit', searchedEmail] });
      setFreezeAction(null);
      setPasswordInput('');
    },
  });
  const summaryMutation = useMutation({
    mutationFn: () => adminService.getUserSummary(searchedEmail),
  });
  const activeFreezeMutation = freezeAction === 'freeze' ? freezeMutation : unfreezeMutation;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    summaryMutation.reset();
    setShowSuggestions(false);
    setSearchedEmail(emailInput.trim().toLowerCase());
  };

  const handleSelectSuggestion = (email: string) => {
    setEmailInput(email);
    setShowSuggestions(false);
    summaryMutation.reset();
    setSearchedEmail(email.toLowerCase());
  };

  const handleConfirmPassword = (e: React.FormEvent) => {
    e.preventDefault();
    activeFreezeMutation.mutate(passwordInput);
  };

  const closePasswordModal = () => {
    setFreezeAction(null);
    setPasswordInput('');
    freezeMutation.reset();
    unfreezeMutation.reset();
  };

  const describeTransfer = (item: Extract<ActivityItem, { type: 'transfer' }>) => {
    const isSender = item.sender_id === data?.user.id;
    const currency = isSender ? item.sender_currency : item.receiver_currency;
    const amount = isSender ? item.sender_amount : item.receiver_amount;
    const counterpartyName = isSender ? item.receiver_name : item.sender_name;
    return { isSender, currency, amount, counterpartyName };
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Admin — user lookup</h1>
      <p className="text-sm text-muted-foreground mb-6">Search a user by email to view their transaction and top-up history.</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email" required autoFocus placeholder="user@example.com" autoComplete="off"
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setShowSuggestions(true); }}
            onFocus={() => { clearTimeout(blurTimer.current); setShowSuggestions(true); }}
            onBlur={() => { blurTimer.current = setTimeout(() => setShowSuggestions(false), 150); }}
            className="w-full border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              {suggestions.map(s => (
                <button
                  key={s.email}
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(s.email)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted transition-colors text-left"
                >
                  <Avatar name={s.fullName} size={28} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.fullName}</p>
                    <p className="text-sm text-muted-foreground truncate">{s.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="submit"
          className="bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold px-5 rounded-lg hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      {!searchedEmail && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Search for a user by email to view their activity.
        </div>
      )}

      {searchedEmail && isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
      )}

      {searchedEmail && isFetched && isError && (
        <div className="text-center py-12 text-sm text-muted-foreground">No user found with that email.</div>
      )}

      {data && (
        <>
          <div className="bg-card border border-border rounded-lg shadow-sm p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <Avatar name={data.user.full_name} size={40} />
              <div>
                <p className="font-semibold text-foreground">{data.user.full_name}</p>
                <p className="text-sm text-muted-foreground">{data.user.email}</p>
              </div>
              {data.user.role === 'admin' && (
                <span className="text-xs font-medium bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">admin</span>
              )}
              {data.user.frozen && (
                <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">frozen</span>
              )}
              {aggregateRiskBadge(data.aggregateRisk)}
            </div>
            <div className="flex gap-2">
              {data.user.frozen ? (
                <button type="button" onClick={() => setFreezeAction('unfreeze')}
                  className="flex items-center gap-1.5 text-sm font-semibold border border-border px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <LockOpenIcon size={16} /> Unfreeze
                </button>
              ) : (
                <button type="button" onClick={() => setFreezeAction('freeze')}
                  disabled={data.user.id === currentUser?.id}
                  title={data.user.id === currentUser?.id ? 'You cannot freeze your own account from the admin panel — use Account to freeze yourself instead.' : undefined}
                  className="flex items-center gap-1.5 text-sm font-semibold border border-destructive text-destructive px-3 py-2 rounded-lg hover:bg-destructive/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                >
                  <LockIcon size={16} /> Freeze
                </button>
              )}
              <button type="button" onClick={() => summaryMutation.mutate()} disabled={summaryMutation.isPending}
                className="flex items-center gap-1.5 text-sm font-semibold bg-muted px-3 py-2 rounded-lg hover:bg-muted/70 disabled:opacity-50 transition-colors"
              >
                <SparkleIcon size={16} /> {summaryMutation.isPending ? 'Summarizing…' : 'Summarize'}
              </button>
            </div>
          </div>

          {summaryMutation.data && (
            <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-4 mb-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary mb-1.5">
                <SparkleIcon size={14} weight="fill" /> AI summary
              </p>
              <p className="text-sm text-foreground">{summaryMutation.data.summary}</p>
            </div>
          )}

          {data.activity.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No activity for this user yet.</div>
          ) : (
            <div className="space-y-2">
              {data.activity.map(item => {
                const isOpen = expandedId === item.id;
                return (
                  <div key={item.id} className="bg-card border border-border rounded-lg shadow-sm p-4">
                    <div className="flex items-start gap-2.5">
                      {item.type === 'topup' ? (
                        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                          <PlusCircleIcon size={18} weight="fill" className="text-success" />
                        </div>
                      ) : (
                        <Avatar name={describeTransfer(item).counterpartyName} size={32} className="mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-foreground truncate">
                            {item.type === 'topup'
                              ? `Top-up via Stripe (${item.status})`
                              : (describeTransfer(item).isSender ? `→ ${item.receiver_name}` : `← ${item.sender_name}`)}
                          </p>
                          <span className="text-sm font-mono font-semibold tabular-nums whitespace-nowrap text-foreground">
                            {item.type === 'topup'
                              ? `+${SYMBOLS[item.currency]}${Number(item.amount).toFixed(2)}`
                              : `${SYMBOLS[describeTransfer(item).currency]}${Number(describeTransfer(item).amount).toFixed(2)}`}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                          {item.type === 'transfer' && `${item.reference_code} · `}
                          {new Date(item.created_at).toLocaleString('en-SG')}
                        </p>
                        {item.fraud_flagged && item.fraud_reason && (
                          <p className="text-sm text-warning mt-0.5">{item.fraud_reason}</p>
                        )}
                        <div className="flex items-center flex-wrap gap-1.5 mt-2">
                          {item.fraud_flagged && <WarningCircleIcon size={14} weight="fill" className="text-warning" />}
                          {riskBadge(item.risk_score)}
                          <button
                            type="button"
                            onClick={() => setExpandedId(isOpen ? null : item.id)}
                            className="flex items-center gap-1 text-sm font-medium text-secondary hover:text-primary transition-colors ml-auto"
                          >
                            {isOpen ? <CaretUpIcon size={12} /> : <CaretDownIcon size={12} />}
                            {isOpen ? 'Hide detail' : 'Ledger / fraud detail'}
                          </button>
                        </div>
                      </div>
                    </div>
                    {isOpen && <AdminActivityDetail item={item} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {freezeAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <form onSubmit={handleConfirmPassword} className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-sm w-full">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${freezeAction === 'freeze' ? 'bg-destructive/10' : 'bg-success/10'}`}>
              {freezeAction === 'freeze'
                ? <LockIcon size={26} weight="fill" className="text-destructive" />
                : <LockOpenIcon size={26} weight="fill" className="text-success" />}
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {freezeAction === 'freeze' ? 'Freeze this account?' : 'Unfreeze this account?'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Confirm with your own admin password to {freezeAction} <span className="font-semibold text-foreground">{data?.user.email}</span>.
            </p>
            <input
              type="password" required autoFocus placeholder="Your password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            {activeFreezeMutation.isError && (
              <p role="alert" className="text-sm text-destructive mb-3">Incorrect password.</p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={closePasswordModal}
                className="flex-1 border border-border text-sm font-semibold py-2.5 rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button type="submit" disabled={activeFreezeMutation.isPending}
                className={`flex-1 text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity ${
                  freezeAction === 'freeze' ? 'bg-destructive' : 'bg-success'
                }`}
              >
                {activeFreezeMutation.isPending ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
