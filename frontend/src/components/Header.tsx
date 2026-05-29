import { Activity, Wifi, WifiOff, AlertOctagon, Loader } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore.js';

export function Header() {
  const wsStatus    = useTradingStore((s) => s.wsStatus);
  const exchStatus  = useTradingStore((s) => s.exchangeStatus);
  const cb          = useTradingStore((s) => s.circuitBreaker);
  const botEnabled  = useTradingStore((s) => s.config.enabled);

  const binance = exchStatus['binance'];
  const kraken  = exchStatus['kraken'];

  return (
    <header id="app-header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      background: 'rgba(6, 13, 20, 0.95)',
      borderBottom: '1px solid var(--glass-border)',
      backdropFilter: 'blur(12px)',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--cyan-500), var(--cyan-300))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px var(--cyan-glow)',
        }}>
          <Activity size={18} color="#020408" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            ArbitrageOS
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            BTC Real-Time Engine
          </div>
        </div>
      </div>

      {/* Status cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Circuit Breaker */}
        {cb?.triggered && (
          <div className="badge badge-red" style={{ animation: 'pulse-red 1s infinite' }}>
            <AlertOctagon size={10} />
            Circuit Breaker
          </div>
        )}

        {/* Bot status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <span className={`pulse-dot ${botEnabled ? 'green' : 'off'}`} />
          <span style={{ color: botEnabled ? 'var(--green-400)' : 'var(--text-muted)' }}>
            {botEnabled ? 'BOT ACTIVE' : 'BOT OFF'}
          </span>
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--bg-border)' }} />

        {/* Exchange connections */}
        <ExchangeStatus label="Binance" connected={binance?.connected ?? false} />
        <ExchangeStatus label="Kraken"  connected={kraken?.connected  ?? false} />

        <div style={{ width: 1, height: 20, background: 'var(--bg-border)' }} />

        {/* WS Backend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          {wsStatus === 'connecting' && <><div className="spinner" style={{ width: 10, height: 10 }} /><span style={{ color: 'var(--amber-400)' }}>Connecting…</span></>}
          {wsStatus === 'connected'  && <><Wifi size={12} color="var(--green-400)" /><span style={{ color: 'var(--green-400)' }}>Server</span></>}
          {wsStatus === 'disconnected' && <><WifiOff size={12} color="var(--red-400)" /><span style={{ color: 'var(--red-400)' }}>Offline</span></>}
          {wsStatus === 'error'      && <><WifiOff size={12} color="var(--red-400)" /><span style={{ color: 'var(--red-400)' }}>Error</span></>}
        </div>
      </div>
    </header>
  );
}

function ExchangeStatus({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
      <span className={`pulse-dot ${connected ? 'cyan' : 'off'}`} style={{ width: 5, height: 5 }} />
      <span style={{ color: connected ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>
        {label}
      </span>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBotLoader() {
  return null as typeof Loader | null;
}
