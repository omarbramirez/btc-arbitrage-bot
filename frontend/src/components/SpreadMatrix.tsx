import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore.js';
import type { OrderBook } from '../types/index.js';

const EXCHANGE_NAMES = {
  binance: 'Binance',
  kraken: 'Kraken',
  coinbase: 'Coinbase',
} as const;

const EXCHANGE_COLORS = {
  binance: '#F0B90B',
  kraken: '#5741D9',
  coinbase: '#0052FF',
} as const;

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ExchangeCard({ book }: { book: OrderBook }) {
  const spread = book.bestBid - book.bestAsk;
  const spreadPct = book.bestAsk > 0 ? (spread / book.bestAsk) * 100 : 0;
  const color = EXCHANGE_COLORS[book.exchange];

  return (
    <div
      id={`exchange-card-${book.exchange}`}
      style={{
        flex: 1,
        background: 'var(--bg-card)',
        border: '1px solid var(--glass-border)',
        borderTop: `2px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 0%, ${color}08, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
          {EXCHANGE_NAMES[book.exchange]}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          BTC/USDT
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Best Bid */}
        <div style={{ background: 'rgba(0,230,118,0.04)', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(0,230,118,0.1)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={9} color="var(--green-400)" />
            BEST BID
          </div>
          <div className="price-value price-md profit">
            ${formatPrice(book.bestBid)}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {book.bestBidSize.toFixed(4)} BTC
          </div>
        </div>

        {/* Best Ask */}
        <div style={{ background: 'rgba(255,26,117,0.04)', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(255,26,117,0.1)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingDown size={9} color="var(--red-400)" />
            BEST ASK
          </div>
          <div className="price-value price-md loss">
            ${formatPrice(book.bestAsk)}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {book.bestAskSize.toFixed(4)} BTC
          </div>
        </div>
      </div>

      {/* Inner spread */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
        <span style={{ color: 'var(--text-muted)' }}>Inner Spread</span>
        <span className="font-mono" style={{ color: spread > 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
          ${formatPrice(Math.abs(spread))} ({spreadPct.toFixed(4)}%)
        </span>
      </div>
    </div>
  );
}

function ArbitrageIndicator() {
  const books     = useTradingStore((s) => s.orderBooks);
  const latestOpp = useTradingStore((s) => s.latestOpportunity);

  const binance = books['binance'];
  const kraken  = books['kraken'];

  if (!binance || !kraken) return null;

  // Cross-exchange spread: Kraken bid vs Binance ask
  const crossSpread1 = kraken.bestBid - binance.bestAsk;
  const crossSpread2 = binance.bestBid - kraken.bestAsk;
  const bestSpread = Math.max(crossSpread1, crossSpread2);
  const isPositive = bestSpread > 0;

  const lastOppIsRecent = latestOpp && Date.now() - latestOpp.detectedAt < 5000;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      padding: '12px',
      minWidth: 130,
    }}>
      <ArrowRight
        size={20}
        style={{ color: isPositive ? 'var(--green-400)' : 'var(--text-muted)',
          filter: isPositive ? 'drop-shadow(0 0 6px var(--green-400))' : 'none',
        }}
      />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>CROSS SPREAD</div>
        <div
          className="price-value"
          style={{
            fontSize: 16,
            color: isPositive ? 'var(--green-400)' : 'var(--red-400)',
            textShadow: isPositive ? '0 0 12px var(--green-400)' : 'none',
          }}
        >
          {isPositive ? '+' : ''}{formatPrice(bestSpread)}
        </div>
      </div>
      {lastOppIsRecent && latestOpp.netProfitUsd > 0 && (
        <div className="badge badge-green">
          +${latestOpp.netProfitUsd.toFixed(2)} NET
        </div>
      )}
    </div>
  );
}

export function SpreadMatrix() {
  const books = useTradingStore((s) => s.orderBooks);

  const binanceBook = books['binance'];
  const krakenBook  = books['kraken'];

  if (!binanceBook && !krakenBook) {
    return (
      <div className="card" style={{ gridColumn: '1', gridRow: '1' }}>
        <div className="card-header">
          <span className="card-title">Spread Matrix</span>
        </div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
          <div className="spinner" style={{ width: 24, height: 24 }} />
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Connecting to exchanges…</div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="spread-matrix"
      className="card"
      style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column' }}
    >
      <div className="card-header">
        <span className="card-title">
          <span className="pulse-dot cyan" />
          Live Spread Matrix
        </span>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {new Date().toLocaleTimeString()}
        </div>
      </div>
      <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', overflow: 'hidden' }}>
        {binanceBook && <ExchangeCard book={binanceBook} />}
        <ArbitrageIndicator />
        {krakenBook && <ExchangeCard book={krakenBook} />}
      </div>
    </div>
  );
}
