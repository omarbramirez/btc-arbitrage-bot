// ─── Shared domain types (mirroring backend) ────────────────────────────
// Keep in sync with backend/src/types/index.ts

export type ExchangeId = 'binance' | 'kraken' | 'coinbase';

export type PriceLevel = [number, number];

export interface OrderBook {
  exchange: ExchangeId;
  bestAsk: number;
  bestAskSize: number;
  bestBid: number;
  bestBidSize: number;
  asks: PriceLevel[];
  bids: PriceLevel[];
  serverTs: number;
  localTs: number;
}

export type OpportunityStatus =
  | 'detected'
  | 'evaluating'
  | 'executed'
  | 'rejected'
  | 'partial'
  | 'cancelled';

export interface ArbitrageOpportunity {
  id: string;
  detectedAt: number;
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  rawBuyPrice: number;
  rawSellPrice: number;
  grossSpread: number;
  grossSpreadPct: number;
  volumeBtc: number;
  filledVolumeBtc: number;
  effectiveBuyPrice: number;
  effectiveSellPrice: number;
  buyFeeUsd: number;
  sellFeeUsd: number;
  netProfitUsd: number;
  netProfitPct: number;
  status: OpportunityStatus;
  rejectionReason?: string;
  executedAt?: number;
}

export interface WalletBalance {
  exchange: ExchangeId;
  usdt: number;
  btc: number;
}

export interface WalletState {
  binance: WalletBalance;
  kraken: WalletBalance;
  coinbase: WalletBalance;
}

export interface BotConfig {
  enabled: boolean;
  minProfitPct: number;
  tradeVolumeBtc: number;
  simulatedLatencyMs: number;
  maxDrawdownPct: number;
  maxConsecutiveLosses: number;
}

export type CircuitBreakerReason =
  | 'max_drawdown'
  | 'consecutive_losses'
  | 'manual_stop'
  | 'execution_timeout';

export interface CircuitBreakerState {
  triggered: boolean;
  reason?: CircuitBreakerReason;
  triggeredAt?: number;
  consecutiveLosses: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  partialTrades: number;
  rejectedOpportunities: number;
  totalProfitUsd: number;
  totalFeesUsd: number;
  winRate: number;
  avgProfitPerTrade: number;
  maxSingleProfit: number;
  maxSingleLoss: number;
  portfolioValueUsdt: number;
  initialPortfolioValueUsdt: number;
  currentDrawdownPct: number;
}

export type WsMessageType =
  | 'orderbook_update'
  | 'opportunity_detected'
  | 'opportunity_executed'
  | 'opportunity_rejected'
  | 'wallet_update'
  | 'metrics_update'
  | 'circuit_breaker'
  | 'connection_status'
  | 'log_entry';

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

export interface ConnectionStatus {
  exchange: ExchangeId;
  connected: boolean;
  reconnectAttempts: number;
  lastMessageTs: number | null;
}

export interface WsMessage<T> {
  type: WsMessageType;
  payload: T;
  ts: number;
}
