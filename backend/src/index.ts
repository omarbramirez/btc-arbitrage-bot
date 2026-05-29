import express, { type Request, type Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { BinanceService } from './services/binanceService.js';
import { KrakenService } from './services/krakenService.js';
import { ArbitrageEngine } from './engine/arbitrageEngine.js';
import { logger } from './utils/logger.js';
import type {
  AnyWsMessage,
  BotConfig,
  LogEntry,
} from './types/index.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const ALLOWED_ORIGIN = process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: false }));
app.use(express.json());

const httpServer = createServer(app);

// ─── WebSocket Server for frontend clients ───────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

function broadcast(msg: AnyWsMessage): void {
  const json = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// ─── Engine Setup ─────────────────────────────────────────────────────────
const engine = new ArbitrageEngine();

engine.onOpportunity((opp) => {
  broadcast({ type: 'opportunity_detected', payload: opp, ts: Date.now() });
  if (opp.status === 'executed' || opp.status === 'partial') {
    broadcast({ type: 'opportunity_executed', payload: opp, ts: Date.now() });
  }
  if (opp.status === 'rejected') {
    broadcast({ type: 'opportunity_rejected', payload: opp, ts: Date.now() });
  }
});

engine.onMetrics((metrics) => {
  broadcast({ type: 'metrics_update', payload: metrics, ts: Date.now() });
});

engine.onWallet((wallet) => {
  broadcast({ type: 'wallet_update', payload: wallet, ts: Date.now() });
});

engine.onCircuitBreaker((state) => {
  broadcast({ type: 'circuit_breaker', payload: state, ts: Date.now() });
});

// ─── Logger → WebSocket bridge ────────────────────────────────────────────
logger.addHandler((entry: LogEntry) => {
  broadcast({ type: 'log_entry', payload: entry, ts: Date.now() });
});

// ─── Exchange Services ────────────────────────────────────────────────────
const binance = new BinanceService();
const kraken  = new KrakenService();

binance.onOrderBook((book) => {
  broadcast({ type: 'orderbook_update', payload: book, ts: Date.now() });
  engine.processOrderBook(book);
});

kraken.onOrderBook((book) => {
  broadcast({ type: 'orderbook_update', payload: book, ts: Date.now() });
  engine.processOrderBook(book);
});

binance.onStatusChange((status) => {
  broadcast({ type: 'connection_status', payload: status, ts: Date.now() });
});

kraken.onStatusChange((status) => {
  broadcast({ type: 'connection_status', payload: status, ts: Date.now() });
});

// ─── REST API ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: Date.now() });
});

app.get('/api/config', (_req: Request, res: Response) => {
  res.json(engine.getConfig());
});

app.patch('/api/config', (req: Request, res: Response) => {
  const partial = req.body as Partial<BotConfig>;
  engine.updateConfig(partial);
  res.json(engine.getConfig());
});

app.get('/api/wallet', (_req: Request, res: Response) => {
  res.json(engine.getWallet());
});

app.get('/api/metrics', (_req: Request, res: Response) => {
  res.json(engine.getMetrics());
});

app.post('/api/circuit-breaker/reset', (_req: Request, res: Response) => {
  engine.resetCircuitBreaker();
  res.json({ reset: true, ts: Date.now() });
});

// ─── WebSocket client messages ────────────────────────────────────────────
interface ConfigUpdateMessage {
  type: 'config_update';
  payload: Partial<BotConfig>;
}

interface CircuitBreakerResetMessage {
  type: 'circuit_breaker_reset';
}

type ClientMessage = ConfigUpdateMessage | CircuitBreakerResetMessage;

wss.on('connection', (ws: WebSocket) => {
  logger.info('[WS] Frontend client connected');

  // Send current state on connect
  ws.send(JSON.stringify({ type: 'wallet_update',  payload: engine.getWallet(),       ts: Date.now() }));
  ws.send(JSON.stringify({ type: 'metrics_update', payload: engine.getMetrics(),      ts: Date.now() }));
  ws.send(JSON.stringify({ type: 'circuit_breaker', payload: engine.getCircuitBreaker(), ts: Date.now() }));

  ws.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as ClientMessage;
      if (msg.type === 'config_update') {
        engine.updateConfig(msg.payload);
        broadcast({ type: 'log_entry', payload: {
          id: crypto.randomUUID(),
          ts: Date.now(),
          level: 'info',
          message: `Config updated via WebSocket`,
          data: msg.payload as Record<string, unknown>,
        }, ts: Date.now() });
      }
      if (msg.type === 'circuit_breaker_reset') {
        engine.resetCircuitBreaker();
      }
    } catch (err) {
      logger.warn('[WS] Invalid client message', { error: String(err) });
    }
  });

  ws.on('close', () => {
    logger.info('[WS] Frontend client disconnected');
  });
});

// ─── Start everything ─────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.success(`[Server] Listening on http://localhost:${PORT}`);
  logger.info('[Server] Starting exchange WebSocket connections…');
  binance.start();
  kraken.start();
  logger.success('[Server] All services started ✓');
});

// ─── Graceful shutdown ─────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('[Server] SIGTERM received — shutting down gracefully…');
  binance.destroy();
  kraken.destroy();
  httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('[Server] SIGINT received — shutting down…');
  binance.destroy();
  kraken.destroy();
  httpServer.close(() => process.exit(0));
});