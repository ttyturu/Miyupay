const RATES = [
  { pair: 'SGD → MYR', rate: '3.450' },
  { pair: 'SGD → THB', rate: '26.800' },
  { pair: 'MYR → SGD', rate: '0.290' },
  { pair: 'MYR → THB', rate: '7.770' },
  { pair: 'THB → SGD', rate: '0.037' },
  { pair: 'THB → MYR', rate: '0.129' },
];

// Repeated so a single row is always wider than any viewport — otherwise the
// two-copy seamless-loop technique below leaves a gap while it waits to wrap.
const REPEATED_RATES = Array.from({ length: 6 }, () => RATES).flat();

function TickerRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="flex items-center shrink-0" aria-hidden={hidden}>
      {REPEATED_RATES.map(({ pair, rate }, i) => (
        <span key={`${pair}-${i}`} className="flex items-center px-6 py-3 font-mono text-xs sm:text-sm text-primary/60 whitespace-nowrap">
          {pair}
          <span className="ml-3 text-primary font-medium">{rate}</span>
        </span>
      ))}
    </div>
  );
}

export default function RateTicker() {
  return (
    <div className="border-y border-border bg-muted/40 overflow-hidden motion-reduce:overflow-x-auto">
      <div className="flex w-max motion-safe:animate-[ticker_168s_linear_infinite] motion-reduce:animate-none">
        <TickerRow />
        <TickerRow hidden />
      </div>
    </div>
  );
}
