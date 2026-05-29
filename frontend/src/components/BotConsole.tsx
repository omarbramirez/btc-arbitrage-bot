import { useState } from 'react';
import { Settings, Zap, Shield, Clock, TrendingUp, RotateCcw } from 'lucide-react';
import { useTradingStore, sendWsMessage } from '../store/useTradingStore.js';

function ConfigRow({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(0,180,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 11 }}>
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

export function BotConsole() {
  const config         = useTradingStore((s) => s.config);
  const circuitBreaker = useTradingStore((s) => s.circuitBreaker);
  const updateConfig   = useTradingStore((s) => s.updateConfig);

  const [localConfig, setLocalConfig] = useState(config);

  const handleToggle = () => {
    const next = { ...localConfig, enabled: !localConfig.enabled };
    setLocalConfig(next);
    updateConfig(next);
    sendWsMessage({ type: 'config_update', payload: next });
  };

  const handleChange = <K extends keyof typeof localConfig>(
    key: K,
    value: typeof localConfig[K]
  ) => {
    const next = { ...localConfig, [key]: value };
    setLocalConfig(next);
    updateConfig(next);
    sendWsMessage({ type: 'config_update', payload: next });
  };

  const handleCircuitBreakerReset = () => {
    sendWsMessage({ type: 'circuit_breaker_reset' });
  };

  return (
    <div
      id="bot-console"
      className="card"
      style={{ gridColumn: '2', gridRow: '1 / 3', display: 'flex', flexDirection: 'column' }}
    >
      <div className="card-header">
        <span className="card-title">
          <Settings size={13} />
          Bot Console
        </span>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '12px' }}>

        {/* ── Master Toggle ── */}
        <div style={{
          background: localConfig.enabled ? 'rgba(0,230,118,0.06)' : 'var(--bg-elevated)',
          border: `1px solid ${localConfig.enabled ? 'rgba(0,230,118,0.2)' : 'var(--glass-border)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.3s',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: localConfig.enabled ? 'var(--green-400)' : 'var(--text-primary)' }}>
              {localConfig.enabled ? '⚡ BOT ACTIVE' : '⏸ BOT STOPPED'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Auto-trade execution
            </div>
          </div>
          <label id="bot-toggle" className="toggle">
            <input type="checkbox" checked={localConfig.enabled} onChange={handleToggle} />
            <div className="toggle-track" />
          </label>
        </div>

        {/* ── Circuit Breaker Status ── */}
        {circuitBreaker?.triggered && (
          <div style={{
            background: 'var(--red-900)',
            border: '1px solid rgba(255,26,117,0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-400)' }}>
                🔴 Circuit Breaker Triggered
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {circuitBreaker.reason?.replace(/_/g, ' ') ?? 'unknown'}
              </div>
            </div>
            <button
              id="reset-circuit-breaker"
              className="btn btn-ghost btn-sm"
              onClick={handleCircuitBreakerReset}
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red-400)', borderColor: 'rgba(255,26,117,0.3)' }}
            >
              <RotateCcw size={10} />
              Reset
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Min profit */}
          <ConfigRow label="Min Profit %" icon={<TrendingUp size={11} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="min-profit-range"
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={localConfig.minProfitPct}
                onChange={(e) => handleChange('minProfitPct', parseFloat(e.target.value))}
                style={{ width: 80 }}
              />
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--cyan-400)', minWidth: 40, textAlign: 'right' }}>
                {localConfig.minProfitPct.toFixed(2)}%
              </span>
            </div>
          </ConfigRow>

          {/* Trade volume */}
          <ConfigRow label="Volume (BTC)" icon={<Zap size={11} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="trade-volume-range"
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={localConfig.tradeVolumeBtc}
                onChange={(e) => handleChange('tradeVolumeBtc', parseFloat(e.target.value))}
                style={{ width: 80 }}
              />
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--cyan-400)', minWidth: 40, textAlign: 'right' }}>
                {localConfig.tradeVolumeBtc.toFixed(2)}
              </span>
            </div>
          </ConfigRow>

          {/* Simulated latency */}
          <ConfigRow label="Latency (ms)" icon={<Clock size={11} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="latency-range"
                type="range"
                min={0}
                max={500}
                step={10}
                value={localConfig.simulatedLatencyMs}
                onChange={(e) => handleChange('simulatedLatencyMs', parseInt(e.target.value, 10))}
                style={{ width: 80 }}
              />
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--amber-400)', minWidth: 40, textAlign: 'right' }}>
                {localConfig.simulatedLatencyMs}ms
              </span>
            </div>
          </ConfigRow>

          {/* Max drawdown */}
          <ConfigRow label="Max Drawdown" icon={<Shield size={11} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="drawdown-range"
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={localConfig.maxDrawdownPct}
                onChange={(e) => handleChange('maxDrawdownPct', parseFloat(e.target.value))}
                style={{ width: 80 }}
              />
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--red-400)', minWidth: 40, textAlign: 'right' }}>
                {localConfig.maxDrawdownPct.toFixed(1)}%
              </span>
            </div>
          </ConfigRow>

          {/* Consecutive losses */}
          <ConfigRow label="Loss Breaker" icon={<Shield size={11} />}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="consecutive-losses-range"
                type="range"
                min={1}
                max={10}
                step={1}
                value={localConfig.maxConsecutiveLosses}
                onChange={(e) => handleChange('maxConsecutiveLosses', parseInt(e.target.value, 10))}
                style={{ width: 80 }}
              />
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--red-400)', minWidth: 40, textAlign: 'right' }}>
                {localConfig.maxConsecutiveLosses}x
              </span>
            </div>
          </ConfigRow>
        </div>

        {/* ── Exchange Fees (read-only display) ── */}
        <div style={{ marginTop: 12 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Exchange Fees (Taker)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([['Binance', '0.10%'], ['Kraken', '0.26%']] as [string, string][]).map(([ex, fee]) => (
              <div key={ex} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>{ex}</span>
                <span className="font-mono" style={{ color: 'var(--amber-400)' }}>{fee}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Panic Button ── */}
        <button
          id="panic-button"
          className="btn btn-danger"
          onClick={() => {
            handleChange('enabled', false);
            sendWsMessage({ type: 'config_update', payload: { ...localConfig, enabled: false } });
          }}
          style={{ marginTop: 'auto', width: '100%', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', paddingTop: 10, paddingBottom: 10 }}
        >
          🛑 EMERGENCY STOP
        </button>
      </div>
    </div>
  );
}
