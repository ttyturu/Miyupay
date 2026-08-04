import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon, WarningCircleIcon, PaperPlaneTiltIcon, InfoIcon, ShieldWarningIcon } from '@phosphor-icons/react';
import { transactionService, walletService } from '../services/api';
import { Currency, Transaction } from '../types';

const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };
const CURRENCIES: Currency[] = ['SGD', 'MYR', 'THB'];
const LARGE_AMOUNT_THRESHOLD = 1000;

interface SendResult { transaction: Transaction; flagged: boolean; message: string; }

export default function SendPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    receiverEmail: '', senderCurrency: 'SGD' as Currency,
    receiverCurrency: 'MYR' as Currency, amount: '', note: '',
  });
  const [result, setResult] = useState<SendResult | null>(null);
  const [isNewRecipient, setIsNewRecipient] = useState(false);
  const [acknowledgedEmail, setAcknowledgedEmail] = useState('');
  const [showScamWarning, setShowScamWarning] = useState(false);

  const { data: wallets } = useQuery({ queryKey: ['wallets'], queryFn: walletService.getWallets });
  const { data: rates }   = useQuery({ queryKey: ['rates'],   queryFn: transactionService.getRates });

  // Debounced check for whether this is a first-time recipient, used to
  // decide whether to show a scam-awareness warning before sending.
  useEffect(() => {
    const email = form.receiverEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setIsNewRecipient(false); return; }
    const timer = setTimeout(() => {
      transactionService.checkRecipient(email)
        .then(res => setIsNewRecipient(res.isNewRecipient))
        .catch(() => setIsNewRecipient(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [form.receiverEmail]);

  const senderWallet = wallets?.find(w => w.currency === form.senderCurrency);

  const rate = rates?.find(r =>
    r.from_currency === form.senderCurrency && r.to_currency === form.receiverCurrency
  );
  const receiverAmount = form.amount && rate
    ? (parseFloat(form.amount) * Number(rate.rate)).toFixed(2)
    : '';

  const isLargeAmount = parseFloat(form.amount || '0') >= LARGE_AMOUNT_THRESHOLD;

  const mutation = useMutation({
    mutationFn: transactionService.send,
    onSuccess: data => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNewRecipient && acknowledgedEmail !== form.receiverEmail) {
      setShowScamWarning(true);
      return;
    }
    setResult(null);
    mutation.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  const handleAcknowledgeWarning = () => {
    setAcknowledgedEmail(form.receiverEmail);
    setShowScamWarning(false);
    setResult(null);
    mutation.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  if (result) return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="bg-card border border-border rounded-lg shadow-sm p-6 text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${result.flagged ? 'bg-warning/10' : 'bg-success/10'}`}>
          {result.flagged
            ? <WarningCircleIcon size={26} weight="fill" className="text-warning" />
            : <CheckCircleIcon size={26} weight="fill" className="text-success" />}
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {result.flagged ? 'Transaction Flagged' : 'Payment Sent'}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">{result.message}</p>
        {result.flagged && result.transaction.fraud_reason && (() => {
          const reasons = result.transaction.fraud_reason!.split('; ');
          const isNewRecipient = reasons.some(r => r.toLowerCase().includes('first transaction'));
          return (
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 text-left mb-4">
              <p className="text-sm text-warning font-semibold mb-1">Why this was flagged</p>
              <ul className="text-sm text-warning list-disc pl-4 space-y-0.5">
                {reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              {isNewRecipient && (
                <p className="text-sm text-warning/80 mt-2">
                  This was blocked because it's a first-time transfer to this recipient sent during an unusual hour.
                  Sending during regular hours, or to a recipient you've paid before, won't trigger this block.
                </p>
              )}
            </div>
          );
        })()}
        <div className="bg-muted/50 rounded-lg p-3 text-left mb-4">
          <p className="text-sm text-muted-foreground mb-1">Reference</p>
          <p className="text-sm font-mono font-semibold text-foreground">{result.transaction.reference_code}</p>
        </div>
        <button
          onClick={() => { setResult(null); setForm({ receiverEmail: '', senderCurrency: 'SGD', receiverCurrency: 'MYR', amount: '', note: '' }); }}
          className="w-full bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          Send another
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Send money</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="send-email" className="block text-sm font-medium text-muted-foreground mb-1">
            Recipient email
          </label>
          <input id="send-email" type="email" required placeholder="bob@example.com"
            value={form.receiverEmail}
            onChange={e => setForm(f => ({ ...f, receiverEmail: e.target.value }))}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          {isNewRecipient && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <InfoIcon size={14} /> This is a new recipient — you'll see a quick scam-awareness reminder before sending.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="send-from-currency" className="block text-sm font-medium text-muted-foreground mb-1">
              You send
            </label>
            <select id="send-from-currency" value={form.senderCurrency}
              onChange={e => setForm(f => ({ ...f, senderCurrency: e.target.value as Currency }))}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="send-to-currency" className="block text-sm font-medium text-muted-foreground mb-1">
              They receive
            </label>
            <select id="send-to-currency" value={form.receiverCurrency}
              onChange={e => setForm(f => ({ ...f, receiverCurrency: e.target.value as Currency }))}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="send-amount" className="block text-sm font-medium text-muted-foreground mb-1">
            Amount
            {senderWallet && (
              <span className="text-muted-foreground/70 ml-2 font-mono">
                Balance: {SYMBOLS[form.senderCurrency]}{Number(senderWallet.balance).toFixed(2)}
              </span>
            )}
          </label>
          <input id="send-amount" type="number" required min="0.01" step="0.01" placeholder="0.00"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          {isLargeAmount && (
            <p className="flex items-center gap-1 text-sm text-warning mt-1">
              <InfoIcon size={14} /> Large amount — may be routed through an additional fraud check.
            </p>
          )}
        </div>
        {receiverAmount && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-sans">They receive</span>
              <span className="font-semibold tabular-nums">{SYMBOLS[form.receiverCurrency]}{receiverAmount} {form.receiverCurrency}</span>
            </div>
            {form.senderCurrency !== form.receiverCurrency && rate && (
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span className="font-sans">Rate</span>
                <span className="tabular-nums">1 {form.senderCurrency} = {Number(rate.rate).toFixed(4)} {form.receiverCurrency}</span>
              </div>
            )}
          </div>
        )}
        <div>
          <label htmlFor="send-note" className="block text-sm font-medium text-muted-foreground mb-1">
            Note (optional)
          </label>
          <input id="send-note" type="text" placeholder="Rent, dinner, etc."
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
        {mutation.error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
            <WarningCircleIcon size={14} weight="fill" />
            {(mutation.error as any).response?.data?.error || 'Something went wrong'}
          </p>
        )}
        <button type="submit" disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <PaperPlaneTiltIcon size={18} />
          {mutation.isPending ? 'Sending…' : 'Send'}
        </button>
      </form>

      {showScamWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-4">
              <ShieldWarningIcon size={26} weight="fill" className="text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Be careful of scams</h2>
            <p className="text-sm text-muted-foreground mb-5">
              You're sending money to <span className="font-semibold text-foreground">{form.receiverEmail}</span> for
              the first time. Never send money to someone you don't know or trust, and always double-check requests
              from people claiming to be family, friends, or officials.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowScamWarning(false)}
                className="flex-1 border border-border text-sm font-semibold py-2.5 rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button type="button" onClick={handleAcknowledgeWarning}
                className="flex-1 bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                Understood, send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
