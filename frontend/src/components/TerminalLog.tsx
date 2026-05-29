import { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore.js';
import type { LogLevel } from '../types/index.js';

const LOG_COLORS: Record<LogLevel, string> = {
  info:    'var(--text-secondary)',
  warn:    'var(--amber-400)',
  error:   'var(--red-400)',
  success: 'var(--green-400)',
  debug:   'var(--text-muted)',
};

const LOG_PREFIXES: Record<LogLevel, string> = {
  info:    '●',
  warn:    '▲',
  error:   '✕',
  success: '✓',
  debug:   '○',
};

function formatTs(ts: number): string {
  return new Date(ts).toISOString().slice(11, 23); // HH:mm:ss.mmm
}

export function TerminalLog() {
  const logs        = useTradingStore((s) => s.logs);
  const bottomRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div
      id="terminal-log"
      style={{
        gridColumn: '1 / 3',
        background: '#030b11',
        borderTop: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 12px',
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid var(--glass-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <Terminal size={11} color="var(--cyan-400)" />
          System Terminal
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-disabled)' }}>
          {logs.length} events
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {logs.length === 0 && (
          <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11 }}>
            Waiting for server events…
          </div>
        )}
        {[...logs].reverse().map((log) => (
          <div
            key={log.id}
            className="slide-in"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '2px 12px',
              fontSize: 11,
              lineHeight: 1.5,
              borderBottom: '1px solid rgba(0,180,255,0.02)',
            }}
          >
            <span style={{ color: 'var(--text-disabled)', flexShrink: 0, fontSize: 10 }}>
              {formatTs(log.ts)}
            </span>
            <span style={{ color: LOG_COLORS[log.level], flexShrink: 0 }}>
              {LOG_PREFIXES[log.level]}
            </span>
            <span style={{ color: LOG_COLORS[log.level], flex: 1 }}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
