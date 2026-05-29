import WebSocket from 'ws';
import type {
  OrderBook,
  ExchangeId,
  PriceLevel,
  ConnectionStatus,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

type OrderBookHandler = (book: OrderBook) => void;
type StatusHandler = (status: ConnectionStatus) => void;

interface BinanceBookTickerMsg {
  u: number;    // order book updateId
  s: string;    // symbol
  b: string;    // best bid price
  B: string;    // best bid qty
  a: string;    // best ask price
  A: string;    // best ask qty
}

interface BinanceDepthSnapshotLevel {
  0: string; // price
  1: string; // quantity
}

interface BinanceDepthMsg {
  lastUpdateId: number;
  bids: BinanceDepthSnapshotLevel[];
  asks: BinanceDepthSnapshotLevel[];
}

const EXCHANGE_ID: ExchangeId = 'binance';
const BOOK_TICKER_URL = 'wss://stream.binance.com:9443/ws/btcusdt@bookTicker';
const DEPTH_URL = 'wss://stream.binance.com:9443/ws/btcusdt@depth20@100ms';
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Binance WebSocket service.
 * Opens two streams:
 *  - bookTicker: ultra-low latency best bid/ask
 *  - depth20:    top 20 order book levels for slippage calculation
 */
export class BinanceService {
  private tickerWs: WebSocket | null = null;
  private depthWs: WebSocket | null = null;
  private reconnectAttempts = 0;
  private destroyed = false;

  private bestBid = 0;
  private bestBidSize = 0;
  private bestAsk = 0;
  private bestAskSize = 0;
  private bids: PriceLevel[] = [];
  private asks: PriceLevel[] = [];

  private readonly bookHandlers: OrderBookHandler[] = [];
  private readonly statusHandlers: StatusHandler[] = [];

  onOrderBook(handler: OrderBookHandler): void {
    this.bookHandlers.push(handler);
  }

  onStatusChange(handler: StatusHandler): void {
    this.statusHandlers.push(handler);
  }

  start(): void {
    this.connectTicker();
    this.connectDepth();
  }

  destroy(): void {
    this.destroyed = true;
    this.tickerWs?.terminate();
    this.depthWs?.terminate();
  }

  // ── Ticker Stream ──────────────────────────────────────────────────────
  private connectTicker(): void {
    if (this.destroyed) return;

    logger.info('[Binance] Connecting bookTicker stream…');
    this.tickerWs = new WebSocket(BOOK_TICKER_URL);

    this.tickerWs.on('open', () => {
      logger.success('[Binance] bookTicker connected ✓');
      this.reconnectAttempts = 0;
      this.emitStatus(true);
    });

    this.tickerWs.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as BinanceBookTickerMsg;
        this.bestBid = parseFloat(msg.b);
        this.bestBidSize = parseFloat(msg.B);
        this.bestAsk = parseFloat(msg.a);
        this.bestAskSize = parseFloat(msg.A);
        this.emitOrderBook(msg.u);
      } catch (err) {
        logger.warn('[Binance] Failed to parse bookTicker message', {
          error: String(err),
        });
      }
    });

    this.tickerWs.on('close', () => {
      logger.warn('[Binance] bookTicker closed — scheduling reconnect…');
      this.emitStatus(false);
      this.scheduleReconnect('ticker');
    });

    this.tickerWs.on('error', (err: Error) => {
      logger.error('[Binance] bookTicker error', { message: err.message });
    });
  }

  // ── Depth Stream ───────────────────────────────────────────────────────
  private connectDepth(): void {
    if (this.destroyed) return;

    logger.info('[Binance] Connecting depth20 stream…');
    this.depthWs = new WebSocket(DEPTH_URL);

    this.depthWs.on('open', () => {
      logger.success('[Binance] depth20 connected ✓');
    });

    this.depthWs.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as BinanceDepthMsg;
        this.bids = msg.bids.map(
          (l): PriceLevel => [parseFloat(l[0]), parseFloat(l[1])]
        );
        this.asks = msg.asks.map(
          (l): PriceLevel => [parseFloat(l[0]), parseFloat(l[1])]
        );
      } catch (err) {
        logger.warn('[Binance] Failed to parse depth message', {
          error: String(err),
        });
      }
    });

    this.depthWs.on('close', () => {
      logger.warn('[Binance] depth20 closed — scheduling reconnect…');
      this.scheduleReconnect('depth');
    });

    this.depthWs.on('error', (err: Error) => {
      logger.error('[Binance] depth20 error', { message: err.message });
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  private emitOrderBook(updateId: number): void {
    if (this.bestBid === 0 || this.bestAsk === 0) return;
    const book: OrderBook = {
      exchange: EXCHANGE_ID,
      bestAsk: this.bestAsk,
      bestAskSize: this.bestAskSize,
      bestBid: this.bestBid,
      bestBidSize: this.bestBidSize,
      asks: [...this.asks],
      bids: [...this.bids],
      serverTs: updateId,       // Binance uses updateId, not timestamp in bookTicker
      localTs: Date.now(),
    };
    this.bookHandlers.forEach((h) => h(book));
  }

  private emitStatus(connected: boolean): void {
    const status: ConnectionStatus = {
      exchange: EXCHANGE_ID,
      connected,
      reconnectAttempts: this.reconnectAttempts,
      lastMessageTs: connected ? Date.now() : null,
    };
    this.statusHandlers.forEach((h) => h(status));
  }

  private scheduleReconnect(stream: 'ticker' | 'depth'): void {
    if (this.destroyed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('[Binance] Max reconnect attempts reached — giving up.', {
        stream,
      });
      return;
    }
    const delay = RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts;
    this.reconnectAttempts++;
    logger.info(`[Binance] Reconnecting ${stream} in ${delay}ms…`, {
      attempt: this.reconnectAttempts,
    });
    setTimeout(() => {
      if (stream === 'ticker') this.connectTicker();
      else this.connectDepth();
    }, delay);
  }
}
