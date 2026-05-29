import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore.js';
import type { PnlDataPoint } from '../store/useTradingStore.js';

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
        {label !== undefined ? formatTs(label) : '—'}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value.toFixed(4)}
        </div>
      ))}
    </div>
  );
}

export function Analytics() {
  const pnlHistory = useTradingStore((s) => s.pnlHistory);
  const metrics    = useTradingStore((s) => s.metrics);

  const lastProfit = pnlHistory.at(-1)?.cumulativeProfit ?? 0;
  const gradColor  = lastProfit >= 0 ? '#00e676' : '#ff1a75';

  const stats: { label: string; value: string; color: string }[] = [
    {
      label: 'Win Rate',
      value: `${(metrics?.winRate ?? 0).toFixed(1)}%`,
      color: 'var(--green-400)',
    },
    {
      label: 'Total Trades',
      value: String(metrics?.totalTrades ?? 0),
      color: 'var(--cyan-400)',
    },
    {
      label: 'Avg Profit',
      value: `$${(metrics?.avgProfitPerTrade ?? 0).toFixed(3)}`,
      color: 'var(--amber-400)',
    },
    {
      label: 'Rejected',
      value: String(metrics?.rejectedOpportunities ?? 0),
      color: 'var(--text-muted)',
    },
  ];

  return (
    <div
      id="analytics"
      className="card"
      style={{ gridColumn: '1', gridRow: '3', display: 'flex', flexDirection: 'column' }}
    >
      <div className="card-header">
        <span className="card-title">
          <BarChart2 size={13} />
          P&amp;L Analytics
        </span>
        <div style={{ display: 'flex', gap: 12 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {s.label}
              </div>
              <div className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 4px 4px 0', minHeight: 0 }}>
        {pnlHistory.length < 2 ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 6, color: 'var(--text-muted)', fontSize: 12,
          }}>
            <div className="spinner" style={{ width: 20, height: 20 }} />
            Waiting for trade data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pnlHistory as PnlDataPoint[]} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"   stopColor={gradColor} stopOpacity={0.3} />
                  <stop offset="95%"  stopColor={gradColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="rgba(0,180,255,0.05)"
                horizontal
                vertical={false}
              />
              <XAxis
                dataKey="ts"
                tickFormatter={formatTs}
                tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                minTickGap={60}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 2" />
              <Area
                type="monotone"
                dataKey="cumulativeProfit"
                name="Net Profit"
                stroke={gradColor}
                strokeWidth={2}
                fill="url(#pnlGradient)"
                dot={false}
                activeDot={{ r: 4, fill: gradColor, stroke: 'var(--bg-void)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
