// ─── Exchange Identity ─────────────────────────────────────────────────────
export type ExchangeId = 'binance' | 'kraken' | 'coinbase';

export interface ExchangeMeta {
  id: ExchangeId;
  name: string;
  /** Trading fee as decimal, e.g. 0.001 = 0.1% */
  takerFee: number;
  /** Estimated one-way network latency in ms (for simulation) */
  latencyMs: number;
}

// ─── Order Book ────────────────────────────────────────────────────────────
/** [price, quantity] tuple from exchange raw data */
export type PriceLevel = [number, number];

export interface OrderBook {
  exchange: ExchangeId;
  /** Best ask price (cheapest offer to sell) */
  bestAsk: number;
  /** Best ask size available at that price */
  bestAskSize: number;
  /** Best bid price (highest offer to buy) */
  bestBid: number;
  /** Best bid size available at that price */
  bestBidSize: number;
  /** Full ask levels [price, qty] sorted ascending */
  asks: PriceLevel[];
  /** Full bid levels [price, qty] sorted descending */
  bids: PriceLevel[];
  /** Exchange server timestamp (ms epoch) */
  serverTs: number;
  /** Local receive timestamp (ms epoch) */
  localTs: number;
}

// ─── Arbitrage Opportunity ─────────────────────────────────────────────────
export type OpportunityStatus =
  | 'detected'
  | 'evaluating'
  | 'executed'
  | 'rejected'
  | 'partial'
  | 'cancelled';

export interface SlippageResult {
  weightedAvgPrice: number;
  filledVolume: number;
  remainingVolume: number;
  partial: boolean;
}

export interface ArbitrageOpportunity {
  id: string;
  detectedAt: number;          // ms epoch
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  rawBuyPrice: number;         // best ask
  rawSellPrice: number;        // best bid
  grossSpread: number;         // rawSell - rawBuy
  grossSpreadPct: number;      // gross / rawBuy * 100
  /** Volume requested in BTC */
  volumeBtc: number;
  /** Volume actually filled after order book depth check */
  filledVolumeBtc: number;
  /** Weighted avg buy price after slippage */
  effectiveBuyPrice: number;
  /** Weighted avg sell price after slippage */
  effectiveSellPrice: number;
  buyFeeUsd: number;
  sellFeeUsd: number;
  netProfitUsd: number;
  netProfitPct: number;
  status: OpportunityStatus;
  /** Rejection reason if status === 'rejected' */
  rejectionReason?: string;
  executedAt?: number;         // ms epoch
}

// ─── Wallet & Balances ─────────────────────────────────────────────────────
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

// ─── Bot Configuration ─────────────────────────────────────────────────────
export interface BotConfig {
  enabled: boolean;
  /** Min net profit % to execute */
  minProfitPct: number;
  /** BTC per trade */
  tradeVolumeBtc: number;
  /** Simulated one-way execution latency in ms */
  simulatedLatencyMs: number;
  /** Max allowed drawdown % before circuit breaker triggers */
  maxDrawdownPct: number;
  /** Circuit breaker: consecutive loss threshold */
  maxConsecutiveLosses: number;
}

// ─── Circuit Breaker ───────────────────────────────────────────────────────
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

// ─── Performance Metrics ───────────────────────────────────────────────────
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
  /** Current total portfolio value in USDT equivalent */
  portfolioValueUsdt: number;
  /** Initial portfolio value for drawdown calculation */
  initialPortfolioValueUsdt: number;
  currentDrawdownPct: number;
}

// ─── WebSocket Messages (Server → Client) ─────────────────────────────────
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

export interface WsMessage<T> {
  type: WsMessageType;
  payload: T;
  ts: number;
}

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

// ─── Typed outbound WS payloads ────────────────────────────────────────────
export type OrderBookUpdateMsg = WsMessage<OrderBook>;
export type OpportunityMsg = WsMessage<ArbitrageOpportunity>;
export type WalletUpdateMsg = WsMessage<WalletState>;
export type MetricsUpdateMsg = WsMessage<PerformanceMetrics>;
export type CircuitBreakerMsg = WsMessage<CircuitBreakerState>;
export type ConnectionStatusMsg = WsMessage<ConnectionStatus>;
export type LogEntryMsg = WsMessage<LogEntry>;

export type AnyWsMessage =
  | OrderBookUpdateMsg
  | OpportunityMsg
  | WalletUpdateMsg
  | MetricsUpdateMsg
  | CircuitBreakerMsg
  | ConnectionStatusMsg
  | LogEntryMsg;
