import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowsLeftRightIcon, CheckCircleIcon, InfoIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { transactionService, walletService } from '../services/api';
import { Currency } from '../types';

const CURRENCIES: Currency[] = ['SGD', 'MYR', 'THB'];
const SYMBOLS: Record<Currency, string> = { SGD: 'S$', MYR: 'RM', THB: '฿' };

export default function ConvertPage() {
  const queryClient = useQueryClient();
  const [fromCurrency, setFromCurrency] = useState<Currency>('SGD');
  const [toCurrency, setToCurrency] = useState<Currency>('MYR');
  const [amount, setAmount] = useState('');
  const [success, setSuccess] = useState('');
  const { data: wallets } = useQuery({ queryKey: ['wallets'], queryFn: walletService.getWallets });
  const { data: rates } = useQuery({ queryKey: ['rates'], queryFn: transactionService.getRates });

  const wallet = wallets?.find(item => item.currency === fromCurrency);
  const rate = rates?.find(item => item.from_currency === fromCurrency && item.to_currency === toCurrency);
  const receivedAmount = amount && rate ? Number(amount) * Number(rate.rate) : undefined;
  const mutation = useMutation({
    mutationFn: walletService.convert,
    onSuccess: result => {
      setSuccess(`Converted ${SYMBOLS[fromCurrency]}${result.sourceAmount.toFixed(2)} into ${SYMBOLS[toCurrency]}${result.receivedAmount.toFixed(2)}.`);
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSuccess('');
    mutation.mutate({ fromCurrency, toCurrency, amount: Number(amount) });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Convert currency</h1>
      <p className="text-sm text-muted-foreground mb-6">Exchange money between your own wallets.</p>
      <form onSubmit={submit} className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="convert-from" className="block text-sm font-medium text-muted-foreground mb-1">From</label>
            <select id="convert-from" value={fromCurrency}
              onChange={event => setFromCurrency(event.target.value as Currency)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary">
              {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="convert-to" className="block text-sm font-medium text-muted-foreground mb-1">To</label>
            <select id="convert-to" value={toCurrency}
              onChange={event => setToCurrency(event.target.value as Currency)}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary">
              {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="convert-amount" className="block text-sm font-medium text-muted-foreground mb-1">
            Amount
            {wallet && <span className="ml-2 font-mono text-muted-foreground/70">Balance: {SYMBOLS[fromCurrency]}{Number(wallet.balance).toFixed(2)}</span>}
          </label>
          <input id="convert-amount" type="number" required min="0.01" step="0.01" placeholder="0.00" value={amount}
            onChange={event => setAmount(event.target.value)}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary" />
        </div>
        {receivedAmount !== undefined && fromCurrency !== toCurrency && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="flex justify-between"><span className="text-muted-foreground">You receive</span><span className="font-mono font-semibold">{SYMBOLS[toCurrency]}{receivedAmount.toFixed(2)}</span></p>
            <p className="flex justify-between text-muted-foreground mt-1"><span>Rate</span><span className="font-mono">1 {fromCurrency} = {Number(rate!.rate).toFixed(4)} {toCurrency}</span></p>
          </div>
        )}
        {fromCurrency === toCurrency && <p className="flex items-center gap-1.5 text-sm text-warning"><InfoIcon size={15} /> Choose two different currencies.</p>}
        {mutation.error && <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive"><WarningCircleIcon size={15} weight="fill" />{(mutation.error as any).response?.data?.error || 'Conversion failed'}</p>}
        {success && <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircleIcon size={15} weight="fill" />{success}</p>}
        <button type="submit" disabled={mutation.isPending || fromCurrency === toCurrency}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-secondary to-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
          <ArrowsLeftRightIcon size={18} />{mutation.isPending ? 'Converting…' : 'Convert currency'}
        </button>
      </form>
    </div>
  );
}
