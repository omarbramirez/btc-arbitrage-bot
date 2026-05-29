import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore.js';
import type { ExchangeId } from '../types/index.js';

const EXCHANGE_NAMES: Record<ExchangeId, string> = {
  binance: 'Binance',
  kraken: 'Kraken',
  coinbase: 'Coinbase',
};

const EXCHANGE_COLORS: Record<ExchangeId, string> = {
  binance: '#F0B90B',
  kraken: '#5741D9',
  coinbase: '#0052FF',
};

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function WalletCard({ exchangeId }: { exchangeId: ExchangeId }) {
  const wallet  = useTradingStore((s) => s.wallet);
  const balance = wallet?.[exchangeId];
  const color   = EXCHANGE_COLORS[exchangeId];

  if (!balance) return null;

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--glass-border)',
      borderLeft: `3px solid ${color}`,
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
          {EXCHANGE_NAMES[exchangeId]}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>BTC/USDT wallet</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>USDT</div>
          <div className="price-value" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
            ${formatUsd(balance.usdt)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>BTC</div>
          <div className="price-value" style={{ fontSize: 15, color: 'var(--amber-400)' }}>
            {balance.btc.toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WalletPanel() {
  const metrics = useTradingStore((s) => s.metrics);

  const totalProfit   = metrics?.totalProfitUsd ?? 0;
  const totalFees     = metrics?.totalFeesUsd ?? 0;
  const portfolioVal  = metrics?.portfolioValueUsdt ?? 20_000;
  const initialVal    = metrics?.initialPortfolioValueUsdt ?? 20_000;
  const drawdown      = metrics?.currentDrawdownPct ?? 0;
  const pnlChange     = portfolioVal - initialVal;
  const isProfit      = pnlChange >= 0;

  return (
    <div
      id="wallet-panel"
      className="card"
      style={{ gridColumn: '2', gridRow: '3', display: 'flex', flexDirection: 'column' }}
    >
      <div className="card-header">
        <span className="card-title">
          <Wallet size={13} />
          Wallets &amp; P&amp;L
        </span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
        {/* Portfolio summary */}
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
        }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>PORTFOLIO</div>
            <div className="price-value" style={{ fontSize: 14, color: 'var(--cyan-400)' }}>
              ${formatUsd(portfolioVal)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>NET P&amp;L</div>
            <div className="price-value" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
              {isProfit
                ? <TrendingUp size={12} color="var(--green-400)" />
                : <TrendingDown size={12} color="var(--red-400)" />}
              <span style={{ color: isProfit ? 'var(--green-400)' : 'var(--red-400)' }}>
                {isProfit ? '+' : ''}{formatUsd(pnlChange)}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>DRAWDOWN</div>
            <div className="price-value" style={{ fontSize: 14, color: drawdown > 3 ? 'var(--red-400)' : 'var(--text-secondary)' }}>
              {drawdown.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Wallets */}
        <WalletCard exchangeId="binance" />
        <WalletCard exchangeId="kraken" />

        {/* Fee summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '0 2px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Gross Profit</span>
          <span className="font-mono" style={{ color: 'var(--green-400)' }}>
            +${formatUsd(totalProfit + totalFees)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '0 2px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Total Fees Paid</span>
          <span className="font-mono" style={{ color: 'var(--red-400)' }}>
            -${formatUsd(totalFees)}
          </span>
        </div>
        <div className="glow-divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '0 2px' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Net Profit</span>
          <span className="font-mono" style={{ color: totalProfit >= 0 ? 'var(--green-400)' : 'var(--red-400)', fontWeight: 700 }}>
            {totalProfit >= 0 ? '+' : ''}{formatUsd(totalProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}
