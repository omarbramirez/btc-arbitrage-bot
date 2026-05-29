import { useMemo } from 'react';
import { useTradingStore } from '../store/useTradingStore.js';
import type { ExchangeId, PriceLevel } from '../types/index.js';

const EXCHANGE_NAMES: Record<ExchangeId, string> = {
  binance: 'Binance',
  kraken: 'Kraken',
  coinbase: 'Coinbase',
};

const MAX_LEVELS = 12;

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BookSide({
  levels,
  side,
  maxTotal,
}: {
  levels: PriceLevel[];
  side: 'bids' | 'asks';
  maxTotal: number;
}) {
  const isAsk = side === 'asks';
  const sliced = isAsk ? levels.slice(0, MAX_LEVELS) : levels.slice(0, MAX_LEVELS);

  return (
    <div style={{ flex: 1 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '0 8px 4px',
        fontSize: 9,
        color: 'var(--text-muted)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        <span>{isAsk ? 'Ask Price' : 'Bid Price'}</span>
        <span style={{ textAlign: 'right' }}>Size</span>
        <span style={{ textAlign: 'right' }}>Total</span>
      </div>
      {sliced.map(([price, qty], i) => {
        const total = sliced.slice(0, i + 1).reduce((acc, [, q]) => acc + q, 0);
        const barPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

        return (
          <div
            key={`${price}-${i}`}
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
            }}
          >
            {/* depth bar */}
            <div style={{
              position: 'absolute',
              inset: 0,
              right: isAsk ? 'auto' : undefined,
              left: isAsk ? 0 : undefined,
              width: `${barPct}%`,
              background: isAsk
                ? 'rgba(255, 26, 117, 0.06)'
                : 'rgba(0, 230, 118, 0.06)',
              pointerEvents: 'none',
            }} />
            <span style={{ color: isAsk ? 'var(--red-400)' : 'var(--green-400)', position: 'relative' }}>
              {formatPrice(price)}
            </span>
            <span style={{ textAlign: 'right', color: 'var(--text-secondary)', position: 'relative' }}>
              {qty.toFixed(5)}
            </span>
            <span style={{ textAlign: 'right', color: 'var(--text-muted)', position: 'relative', fontSize: 10 }}>
              {total.toFixed(4)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OrderBookPanel({ exchangeId }: { exchangeId: ExchangeId }) {
  const book = useTradingStore((s) => s.orderBooks[exchangeId]);

  const maxAskTotal = useMemo(() => {
    if (!book) return 0;
    const levels = book.asks.slice(0, MAX_LEVELS);
    return levels.reduce((acc, [, q]) => acc + q, 0);
  }, [book]);

  const maxBidTotal = useMemo(() => {
    if (!book) return 0;
    const levels = book.bids.slice(0, MAX_LEVELS);
    return levels.reduce((acc, [, q]) => acc + q, 0);
  }, [book]);

  if (!book) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
        <div className="spinner" />
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{EXCHANGE_NAMES[exchangeId]} connecting…</div>
      </div>
    );
  }

  const spread = book.bestAsk - book.bestBid;
  const spreadPct = book.bestBid > 0 ? (spread / book.bestBid) * 100 : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{
        padding: '6px 8px',
        borderBottom: '1px solid var(--bg-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
          {EXCHANGE_NAMES[exchangeId]}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          Spread: <span style={{ color: 'var(--cyan-400)' }}>${formatPrice(spread)}</span>
          <span style={{ color: 'var(--text-disabled)', marginLeft: 4 }}>({spreadPct.toFixed(4)}%)</span>
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Asks (top) */}
        <BookSide levels={book.asks} side="asks" maxTotal={maxAskTotal} />

        <div style={{ width: 1, background: 'var(--bg-border)', margin: '0 4px' }} />

        {/* Bids (bottom) */}
        <BookSide levels={book.bids} side="bids" maxTotal={maxBidTotal} />
      </div>

      {/* Mid price */}
      <div style={{
        padding: '4px 8px',
        borderTop: '1px solid var(--bg-border)',
        textAlign: 'center',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        color: 'var(--cyan-300)',
      }}>
        ≈ ${formatPrice((book.bestBid + book.bestAsk) / 2)}
      </div>
    </div>
  );
}

export function OrderBook() {
  return (
    <div
      id="order-book"
      className="card"
      style={{ gridColumn: '1', gridRow: '2', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div className="card-header">
        <span className="card-title">
          <span className="pulse-dot cyan" style={{ width: 5, height: 5 }} />
          Order Books
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Top {MAX_LEVELS} levels</span>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
        <OrderBookPanel exchangeId="binance" />
        <div style={{ width: 1, background: 'var(--bg-border)' }} />
        <OrderBookPanel exchangeId="kraken" />
      </div>
    </div>
  );
}
