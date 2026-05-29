import { randomUUID } from 'crypto';
import type {
  OrderBook,
  ExchangeId,
  ArbitrageOpportunity,
  BotConfig,
  WalletState,
  PerformanceMetrics,
  CircuitBreakerState,
  CircuitBreakerReason,
} from '../types/index.js';
import { calculateSlippage, calcNetProfit } from './slippage.js';
import { logger } from '../utils/logger.js';

type OpportunityHandler = (opp: ArbitrageOpportunity) => void;
type MetricsHandler = (metrics: PerformanceMetrics) => void;
type WalletHandler = (wallet: WalletState) => void;
type CircuitBreakerHandler = (state: CircuitBreakerState) => void;

export const EXCHANGE_FEES: Record<ExchangeId, number> = {
  binance: 0.001,   // 0.10% taker
  kraken: 0.0026,   // 0.26% taker
  coinbase: 0.006,  // 0.60% taker
};

const INITIAL_WALLET: WalletState = {
  binance: { exchange: 'binance', usdt: 10_000, btc: 0.5 },
  kraken:  { exchange: 'kraken',  usdt: 10_000, btc: 0.5 },
};

/**
 * Core arbitrage detection and simulation engine.
 *
 * On every order book update it evaluates all exchange pairs for:
 * 1. Gross spread > 0
 * 2. Sufficient order book depth (partial fill allowed)
 * 3. Net profit > minProfitPct after fees and slippage
 * 4. Sufficient wallet balance on both sides
 *
 * Circuit breakers halt auto-execution on:
 * - Drawdown > config.maxDrawdownPct
 * - Consecutive losses >= config.maxConsecutiveLosses
 */
export class ArbitrageEngine {
  private readonly books: Map<ExchangeId, OrderBook> = new Map();

  private wallet: WalletState = JSON.parse(
    JSON.stringify(INITIAL_WALLET)
  ) as WalletState;

  private metrics: PerformanceMetrics = {
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    partialTrades: 0,
    rejectedOpportunities: 0,
    totalProfitUsd: 0,
    totalFeesUsd: 0,
    winRate: 0,
    avgProfitPerTrade: 0,
    maxSingleProfit: 0,
    maxSingleLoss: 0,
    portfolioValueUsdt: 20_000,
    initialPortfolioValueUsdt: 20_000,
    currentDrawdownPct: 0,
  };

  private circuitBreaker: CircuitBreakerState = {
    triggered: false,
    consecutiveLosses: 0,
  };

  private config: BotConfig = {
    enabled: false,
    minProfitPct: 0.05,
    tradeVolumeBtc: 0.1,
    simulatedLatencyMs: 50,
    maxDrawdownPct: 5,
    maxConsecutiveLosses: 3,
  };

  private readonly opportunityHandlers: OpportunityHandler[] = [];
  private readonly metricsHandlers: MetricsHandler[] = [];
  private readonly walletHandlers: WalletHandler[] = [];
  private readonly circuitBreakerHandlers: CircuitBreakerHandler[] = [];

  // ── Registration ───────────────────────────────────────────────────────
  onOpportunity(h: OpportunityHandler): void { this.opportunityHandlers.push(h); }
  onMetrics(h: MetricsHandler): void { this.metricsHandlers.push(h); }
  onWallet(h: WalletHandler): void { this.walletHandlers.push(h); }
  onCircuitBreaker(h: CircuitBreakerHandler): void { this.circuitBreakerHandlers.push(h); }

  // ── Config ─────────────────────────────────────────────────────────────
  updateConfig(partial: Partial<BotConfig>): void {
    this.config = { ...this.config, ...partial };
    logger.info('[Engine] Config updated', {
      ...this.config,
    } as Record<string, unknown>);
  }

  getConfig(): BotConfig { return { ...this.config }; }
  getWallet(): WalletState { return JSON.parse(JSON.stringify(this.wallet)) as WalletState; }
  getMetrics(): PerformanceMetrics { return { ...this.metrics }; }
  getCircuitBreaker(): CircuitBreakerState { return { ...this.circuitBreaker }; }

  resetCircuitBreaker(): void {
    this.circuitBreaker = { triggered: false, consecutiveLosses: 0 };
    logger.success('[Engine] Circuit breaker reset manually.');
    this.emitCircuitBreaker();
  }

  // ── Main Entry: Process incoming order book ────────────────────────────
  processOrderBook(book: OrderBook): void {
    this.books.set(book.exchange, book);

    const exchanges = [...this.books.keys()];
    // Only start evaluating once we have data from ≥2 exchanges
    if (exchanges.length < 2) return;

    // Evaluate all exchange pairs
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = 0; j < exchanges.length; j++) {
        if (i === j) continue;
        const buyEx = exchanges[i]!;
        const sellEx = exchanges[j]!;
        this.evaluate(buyEx, sellEx);
      }
    }
  }

  // ── Core Evaluation Logic ──────────────────────────────────────────────
  private evaluate(buyExchange: ExchangeId, sellExchange: ExchangeId): void {
    const buyBook = this.books.get(buyExchange);
    const sellBook = this.books.get(sellExchange);
    if (!buyBook || !sellBook) return;

    const rawBuyPrice = buyBook.bestAsk;
    const rawSellPrice = sellBook.bestBid;
    const grossSpread = rawSellPrice - rawBuyPrice;

    // No raw spread — skip immediately
    if (grossSpread <= 0) return;

    const grossSpreadPct = (grossSpread / rawBuyPrice) * 100;
    const volumeBtc = this.config.tradeVolumeBtc;

    // Slippage simulation using order book depth
    const buySlip = calculateSlippage(buyBook.asks, volumeBtc);
    const sellSlip = calculateSlippage(sellBook.bids, volumeBtc);

    // Use minimum filled volume (both sides must match)
    const filledVolumeBtc = Math.min(buySlip.filledVolume, sellSlip.filledVolume);

    if (filledVolumeBtc < 1e-6) {
      logger.debug('[Engine] Insufficient liquidity — skipping.', {
        buyExchange,
        sellExchange,
      });
      return;
    }

    const buyFeeRate  = EXCHANGE_FEES[buyExchange];
    const sellFeeRate = EXCHANGE_FEES[sellExchange];

    const { buyFeeUsd, sellFeeUsd, netProfitUsd, netProfitPct } = calcNetProfit(
      buySlip.weightedAvgPrice,
      sellSlip.weightedAvgPrice,
      filledVolumeBtc,
      buyFeeRate,
      sellFeeRate,
    );

    const partial = buySlip.partial || sellSlip.partial;

    const opp: ArbitrageOpportunity = {
      id: randomUUID(),
      detectedAt: Date.now(),
      buyExchange,
      sellExchange,
      rawBuyPrice,
      rawSellPrice,
      grossSpread,
      grossSpreadPct,
      volumeBtc,
      filledVolumeBtc,
      effectiveBuyPrice: buySlip.weightedAvgPrice,
      effectiveSellPrice: sellSlip.weightedAvgPrice,
      buyFeeUsd,
      sellFeeUsd,
      netProfitUsd,
      netProfitPct,
      status: 'detected',
    };

    // Always emit detected opportunity regardless of config.enabled
    this.opportunityHandlers.forEach((h) => h({ ...opp }));

    // Decide whether to execute
    if (!this.config.enabled) {
      opp.status = 'rejected';
      opp.rejectionReason = 'Bot is disabled';
      this.metrics.rejectedOpportunities++;
      this.emitMetrics();
      return;
    }

    if (this.circuitBreaker.triggered) {
      opp.status = 'rejected';
      opp.rejectionReason = `Circuit breaker: ${this.circuitBreaker.reason ?? 'unknown'}`;
      this.metrics.rejectedOpportunities++;
      this.emitMetrics();
      return;
    }

    if (netProfitPct < this.config.minProfitPct) {
      opp.status = 'rejected';
      opp.rejectionReason = `Net profit ${netProfitPct.toFixed(4)}% < threshold ${this.config.minProfitPct}%`;
      this.metrics.rejectedOpportunities++;
      this.emitMetrics();
      return;
    }

    // Check wallet balance
    const buyWallet  = this.wallet[buyExchange];
    const sellWallet = this.wallet[sellExchange];
    const requiredUsdt = buySlip.weightedAvgPrice * filledVolumeBtc * (1 + buyFeeRate);

    if (buyWallet.usdt < requiredUsdt) {
      opp.status = 'rejected';
      opp.rejectionReason = `Insufficient USDT on ${buyExchange} (need $${requiredUsdt.toFixed(2)}, have $${buyWallet.usdt.toFixed(2)})`;
      this.metrics.rejectedOpportunities++;
      this.emitMetrics();
      return;
    }

    if (sellWallet.btc < filledVolumeBtc) {
      opp.status = 'rejected';
      opp.rejectionReason = `Insufficient BTC on ${sellExchange} (need ${filledVolumeBtc.toFixed(6)}, have ${sellWallet.btc.toFixed(6)})`;
      this.metrics.rejectedOpportunities++;
      this.emitMetrics();
      return;
    }

    // Simulate execution delay
    setTimeout(() => {
      this.simulateExecution(opp, partial);
    }, this.config.simulatedLatencyMs);
  }

  // ── Simulated Order Execution ──────────────────────────────────────────
  private simulateExecution(
    opp: ArbitrageOpportunity,
    partial: boolean
  ): void {
    const { buyExchange, sellExchange, filledVolumeBtc, effectiveBuyPrice, buyFeeUsd, sellFeeUsd, netProfitUsd } = opp;

    const buyWallet  = this.wallet[buyExchange];
    const sellWallet = this.wallet[sellExchange];
    const buyFeeRate = EXCHANGE_FEES[buyExchange];

    const totalBuyCost = effectiveBuyPrice * filledVolumeBtc * (1 + buyFeeRate);

    // Update wallets
    buyWallet.usdt  -= totalBuyCost;
    buyWallet.btc   += filledVolumeBtc;
    sellWallet.btc  -= filledVolumeBtc;
    sellWallet.usdt += (opp.effectiveSellPrice * filledVolumeBtc) - sellFeeUsd;

    opp.status = partial ? 'partial' : 'executed';
    opp.executedAt = Date.now();

    // Update metrics
    this.metrics.totalTrades++;
    this.metrics.totalProfitUsd += netProfitUsd;
    this.metrics.totalFeesUsd   += buyFeeUsd + sellFeeUsd;

    if (netProfitUsd >= 0) {
      this.metrics.successfulTrades++;
      this.circuitBreaker.consecutiveLosses = 0;
      this.metrics.maxSingleProfit = Math.max(this.metrics.maxSingleProfit, netProfitUsd);
      logger.success(`[Engine] ✓ Arbitrage executed +$${netProfitUsd.toFixed(4)}`, {
        buy: buyExchange,
        sell: sellExchange,
        volume: filledVolumeBtc,
      });
    } else {
      this.metrics.failedTrades++;
      this.circuitBreaker.consecutiveLosses++;
      this.metrics.maxSingleLoss = Math.min(this.metrics.maxSingleLoss, netProfitUsd);
      logger.warn(`[Engine] ✗ Trade resulted in loss: $${netProfitUsd.toFixed(4)}`, {
        consecutiveLosses: this.circuitBreaker.consecutiveLosses,
      });
    }

    if (partial) this.metrics.partialTrades++;

    this.metrics.winRate =
      this.metrics.totalTrades > 0
        ? (this.metrics.successfulTrades / this.metrics.totalTrades) * 100
        : 0;

    this.metrics.avgProfitPerTrade =
      this.metrics.totalTrades > 0
        ? this.metrics.totalProfitUsd / this.metrics.totalTrades
        : 0;

    this.updatePortfolioValue();
    this.checkCircuitBreakers();

    this.opportunityHandlers.forEach((h) => h({ ...opp }));
    this.emitMetrics();
    this.emitWallet();
  }

  // ── Portfolio Value & Drawdown ─────────────────────────────────────────
  private updatePortfolioValue(): void {
    // Approximate BTC→USDT using current binance book price
    const binanceBook = this.books.get('binance');
    const btcPriceUsdt = binanceBook?.bestBid ?? 0;

    const btcTotal =
      this.wallet.binance.btc + this.wallet.kraken.btc;
    const usdtTotal =
      this.wallet.binance.usdt + this.wallet.kraken.usdt;

    this.metrics.portfolioValueUsdt = usdtTotal + btcTotal * btcPriceUsdt;

    const drawdown =
      ((this.metrics.initialPortfolioValueUsdt - this.metrics.portfolioValueUsdt) /
        this.metrics.initialPortfolioValueUsdt) *
      100;

    this.metrics.currentDrawdownPct = Math.max(0, drawdown);
  }

  // ── Circuit Breakers ───────────────────────────────────────────────────
  private checkCircuitBreakers(): void {
    if (this.circuitBreaker.triggered) return;

    let triggered = false;
    let reason: CircuitBreakerReason | undefined;

    if (this.metrics.currentDrawdownPct >= this.config.maxDrawdownPct) {
      triggered = true;
      reason = 'max_drawdown';
      logger.error(`[Engine] 🔴 Circuit breaker: Max drawdown ${this.metrics.currentDrawdownPct.toFixed(2)}% exceeded.`);
    }

    if (this.circuitBreaker.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      triggered = true;
      reason = 'consecutive_losses';
      logger.error(`[Engine] 🔴 Circuit breaker: ${this.circuitBreaker.consecutiveLosses} consecutive losses.`);
    }

    if (triggered) {
      this.circuitBreaker = {
        triggered: true,
        reason,
        triggeredAt: Date.now(),
        consecutiveLosses: this.circuitBreaker.consecutiveLosses,
      };
      this.config.enabled = false;
      this.emitCircuitBreaker();
    }
  }

  // ── Emitters ───────────────────────────────────────────────────────────
  private emitMetrics(): void {
    this.metricsHandlers.forEach((h) => h({ ...this.metrics }));
  }

  private emitWallet(): void {
    this.walletHandlers.forEach((h) =>
      h(JSON.parse(JSON.stringify(this.wallet)) as WalletState)
    );
  }

  private emitCircuitBreaker(): void {
    this.circuitBreakerHandlers.forEach((h) => h({ ...this.circuitBreaker }));
  }
}
