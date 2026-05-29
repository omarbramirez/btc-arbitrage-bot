import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  OrderBook,
  ArbitrageOpportunity,
  WalletState,
  PerformanceMetrics,
  CircuitBreakerState,
  BotConfig,
  LogEntry,
  ConnectionStatus,
  ExchangeId,
  WsMessage,
  WsMessageType,
} from '../types/index.js';

// ─── P&L History point for Recharts ───────────────────────────────────────
export interface PnlDataPoint {
  ts: number;
  portfolioValue: number;
  cumulativeProfit: number;
}

// ─── Connection State ──────────────────────────────────────────────────────
export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ─── Store Shape ───────────────────────────────────────────────────────────
interface TradingState {
  // WebSocket
  wsStatus: WsConnectionStatus;
  exchangeStatus: Record<ExchangeId, ConnectionStatus>;

  // Market data
  orderBooks: Partial<Record<ExchangeId, OrderBook>>;

  // Arbitrage
  opportunities: ArbitrageOpportunity[];        // Last 200 detected
  executedTrades: ArbitrageOpportunity[];       // Executed/partial only
  latestOpportunity: ArbitrageOpportunity | null;

  // Bot
  config: BotConfig;
  wallet: WalletState | null;
  metrics: PerformanceMetrics | null;
  circuitBreaker: CircuitBreakerState | null;

  // Logs
  logs: LogEntry[];   // Last 500 entries

  // Analytics
  pnlHistory: PnlDataPoint[];

  // Actions
  setWsStatus: (status: WsConnectionStatus) => void;
  setExchangeStatus: (status: ConnectionStatus) => void;
  setOrderBook: (book: OrderBook) => void;
  addOpportunity: (opp: ArbitrageOpportunity) => void;
  updateOpportunity: (opp: ArbitrageOpportunity) => void;
  setWallet: (wallet: WalletState) => void;
  setMetrics: (metrics: PerformanceMetrics) => void;
  setCircuitBreaker: (state: CircuitBreakerState) => void;
  addLog: (entry: LogEntry) => void;
  updateConfig: (partial: Partial<BotConfig>) => void;
}

const DEFAULT_CONFIG: BotConfig = {
  enabled: false,
  minProfitPct: 0.05,
  tradeVolumeBtc: 0.1,
  simulatedLatencyMs: 50,
  maxDrawdownPct: 5,
  maxConsecutiveLosses: 3,
};

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector((set) => ({
    // Initial state
    wsStatus: 'disconnected',
    exchangeStatus: {} as Record<ExchangeId, ConnectionStatus>,
    orderBooks: {},
    opportunities: [],
    executedTrades: [],
    latestOpportunity: null,
    config: DEFAULT_CONFIG,
    wallet: null,
    metrics: null,
    circuitBreaker: null,
    logs: [],
    pnlHistory: [],

    // Actions
    setWsStatus: (status) => set({ wsStatus: status }),

    setExchangeStatus: (status) =>
      set((s) => ({
        exchangeStatus: { ...s.exchangeStatus, [status.exchange]: status },
      })),

    setOrderBook: (book) =>
      set((s) => ({
        orderBooks: { ...s.orderBooks, [book.exchange]: book },
      })),

    addOpportunity: (opp) =>
      set((s) => ({
        opportunities: [opp, ...s.opportunities].slice(0, 200),
        latestOpportunity: opp,
      })),

    updateOpportunity: (opp) =>
      set((s) => {
        const index = s.opportunities.findIndex((o) => o.id === opp.id);
        const updated =
          index !== -1
            ? [
                ...s.opportunities.slice(0, index),
                opp,
                ...s.opportunities.slice(index + 1),
              ]
            : s.opportunities;

        const isExecuted = opp.status === 'executed' || opp.status === 'partial';

        return {
          opportunities: updated,
          executedTrades: isExecuted
            ? [opp, ...s.executedTrades].slice(0, 100)
            : s.executedTrades,
        };
      }),

    setWallet: (wallet) => set({ wallet }),

    setMetrics: (metrics) =>
      set((s) => {
        const point: PnlDataPoint = {
          ts: Date.now(),
          portfolioValue: metrics.portfolioValueUsdt,
          cumulativeProfit: metrics.totalProfitUsd,
        };
        return {
          metrics,
          pnlHistory: [...s.pnlHistory, point].slice(-300),
        };
      }),

    setCircuitBreaker: (circuitBreaker) => set({ circuitBreaker }),

    addLog: (entry) =>
      set((s) => ({ logs: [entry, ...s.logs].slice(0, 500) })),

    updateConfig: (partial) =>
      set((s) => ({ config: { ...s.config, ...partial } })),
  }))
);

// ─── WebSocket Client ──────────────────────────────────────────────────────
const WS_URL = import.meta.env['VITE_WS_URL'] as string | undefined ?? 'ws://localhost:3001';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 15;

function dispatchMessage(msg: WsMessage<unknown>): void {
  const store = useTradingStore.getState();

  switch (msg.type as WsMessageType) {
    case 'orderbook_update':
      store.setOrderBook(msg.payload as Parameters<typeof store.setOrderBook>[0]);
      break;
    case 'opportunity_detected':
      store.addOpportunity(msg.payload as ArbitrageOpportunity);
      break;
    case 'opportunity_executed':
    case 'opportunity_rejected':
      store.updateOpportunity(msg.payload as ArbitrageOpportunity);
      break;
    case 'wallet_update':
      store.setWallet(msg.payload as WalletState);
      break;
    case 'metrics_update':
      store.setMetrics(msg.payload as PerformanceMetrics);
      break;
    case 'circuit_breaker':
      store.setCircuitBreaker(msg.payload as CircuitBreakerState);
      break;
    case 'connection_status':
      store.setExchangeStatus(msg.payload as ConnectionStatus);
      break;
    case 'log_entry':
      store.addLog(msg.payload as LogEntry);
      break;
  }
}

export function connectWebSocket(): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  useTradingStore.getState().setWsStatus('connecting');

  ws = new WebSocket(WS_URL);

  ws.addEventListener('open', () => {
    reconnectAttempts = 0;
    useTradingStore.getState().setWsStatus('connected');
  });

  ws.addEventListener('message', (event: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(event.data) as WsMessage<unknown>;
      dispatchMessage(msg);
    } catch {
      // ignore malformed frames
    }
  });

  ws.addEventListener('close', () => {
    useTradingStore.getState().setWsStatus('disconnected');
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    useTradingStore.getState().setWsStatus('error');
  });
}

function scheduleReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    connectWebSocket();
  }, delay);
}

export function sendWsMessage(msg: Record<string, unknown>): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function disconnectWebSocket(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
}
