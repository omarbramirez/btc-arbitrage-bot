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

// ── Kraken v2 WebSocket typed payloads ────────────────────────────────────

interface KrakenSubscribeMsg {
  method: 'subscribe';
  params: {
    channel: 'ticker' | 'book';
    symbol: string[];
    depth?: number;
  };
}

interface KrakenTickerData {
  symbol: string;
  bid: number;
  bid_qty: number;
  ask: number;
  ask_qty: number;
  last: number;
  volume: number;
  timestamp: string;
}

interface KrakenTickerMsg {
  channel: 'ticker';
  type: 'snapshot' | 'update';
  data: KrakenTickerData[];
}

interface KrakenBookLevel {
  price: number;
  qty: number;
}

interface KrakenBookData {
  symbol: string;
  bids: KrakenBookLevel[];
  asks: KrakenBookLevel[];
  checksum?: number;
  timestamp?: string;
}

interface KrakenBookMsg {
  channel: 'book';
  type: 'snapshot' | 'update';
  data: KrakenBookData[];
}

interface KrakenHeartbeat {
  channel: 'heartbeat';
  data: Record<string, never>;
}

interface KrakenStatusMsg {
  channel: 'status';
  data: { api_version: string; connection_id: number; system: string; version: string }[];
}

type KrakenInboundMsg =
  | KrakenTickerMsg
  | KrakenBookMsg
  | KrakenHeartbeat
  | KrakenStatusMsg;

// ─────────────────────────────────────────────────────────────────────────────

const EXCHANGE_ID: ExchangeId = 'kraken';
const KRAKEN_WS_URL = 'wss://ws.kraken.com/v2';
const SYMBOL = 'BTC/USDT';
const BOOK_DEPTH = 25;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Kraken WebSocket v2 service.
 * Subscribes to the `ticker` (best bid/ask) and `book` (depth) channels.
 */
export class KrakenService {
  private ws: WebSocket | null = null;
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
    this.connect();
  }

  destroy(): void {
    this.destroyed = true;
    this.ws?.terminate();
  }

  // ─────────────────────────────────────────────────────────────────────────
  private connect(): void {
    if (this.destroyed) return;

    logger.info('[Kraken] Connecting WebSocket v2…');
    this.ws = new WebSocket(KRAKEN_WS_URL);

    this.ws.on('open', () => {
      logger.success('[Kraken] Connected ✓ — subscribing to ticker & book…');
      this.reconnectAttempts = 0;
      this.emitStatus(true);

      const tickerSub: KrakenSubscribeMsg = {
        method: 'subscribe',
        params: { channel: 'ticker', symbol: [SYMBOL] },
      };
      const bookSub: KrakenSubscribeMsg = {
        method: 'subscribe',
        params: { channel: 'book', symbol: [SYMBOL], depth: BOOK_DEPTH },
      };

      this.ws?.send(JSON.stringify(tickerSub));
      this.ws?.send(JSON.stringify(bookSub));
    });

    this.ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as KrakenInboundMsg;
        this.handleMessage(msg);
      } catch (err) {
        logger.warn('[Kraken] Failed to parse message', { error: String(err) });
      }
    });

    this.ws.on('close', () => {
      logger.warn('[Kraken] Connection closed — scheduling reconnect…');
      this.emitStatus(false);
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      logger.error('[Kraken] WebSocket error', { message: err.message });
    });
  }

  private handleMessage(msg: KrakenInboundMsg): void {
    if (msg.channel === 'heartbeat' || msg.channel === 'status') return;

    if (msg.channel === 'ticker') {
      const data = msg.data[0];
      if (!data) return;
      this.bestBid = data.bid;
      this.bestBidSize = data.bid_qty;
      this.bestAsk = data.ask;
      this.bestAskSize = data.ask_qty;
      this.emitOrderBook(new Date(data.timestamp ?? Date.now()).getTime());
    }

    if (msg.channel === 'book') {
      const data = msg.data[0];
      if (!data) return;

      if (msg.type === 'snapshot') {
        this.bids = data.bids.map((l): PriceLevel => [l.price, l.qty]);
        this.asks = data.asks.map((l): PriceLevel => [l.price, l.qty]);
      } else {
        // Apply delta updates
        this.applyBookDelta('bids', data.bids);
        this.applyBookDelta('asks', data.asks);
      }
    }
  }

  private applyBookDelta(
    side: 'bids' | 'asks',
    updates: KrakenBookLevel[]
  ): void {
    const levels = side === 'bids' ? this.bids : this.asks;

    for (const update of updates) {
      const idx = levels.findIndex(([p]) => p === update.price);
      if (update.qty === 0) {
        // Remove level
        if (idx !== -1) levels.splice(idx, 1);
      } else if (idx !== -1) {
        // Update existing
        levels[idx] = [update.price, update.qty];
      } else {
        // Add new
        levels.push([update.price, update.qty]);
      }
    }

    // Keep sorted: bids descending, asks ascending
    if (side === 'bids') {
      this.bids.sort((a, b) => b[0] - a[0]);
    } else {
      this.asks.sort((a, b) => a[0] - b[0]);
    }
  }

  private emitOrderBook(serverTs: number): void {
    if (this.bestBid === 0 || this.bestAsk === 0) return;
    const book: OrderBook = {
      exchange: EXCHANGE_ID,
      bestAsk: this.bestAsk,
      bestAskSize: this.bestAskSize,
      bestBid: this.bestBid,
      bestBidSize: this.bestBidSize,
      asks: [...this.asks],
      bids: [...this.bids],
      serverTs,
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

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('[Kraken] Max reconnect attempts reached — giving up.');
      return;
    }
    const delay = RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts;
    this.reconnectAttempts++;
    logger.info(`[Kraken] Reconnecting in ${delay}ms…`, {
      attempt: this.reconnectAttempts,
    });
    setTimeout(() => this.connect(), delay);
  }
}
