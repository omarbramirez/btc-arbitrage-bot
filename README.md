# ArbitrageOS — BTC Real-Time Arbitrage Engine

> Sistema de detección y simulación de arbitraje de Bitcoin de alta frecuencia con conexión WebSocket directa a Binance y Kraken.

## 🏗️ Arquitectura

```
btc-arbitrage-bot/
├── backend/          # Node.js + Express 5 + WebSocket server
│   └── src/
│       ├── types/          # Contratos de dominio compartidos (sin any)
│       ├── utils/          # Logger estructurado con handlers plug-in
│       ├── services/       # BinanceService, KrakenService (WS nativo)
│       ├── engine/         # ArbitrageEngine + slippage.ts
│       └── index.ts        # HTTP+WS server, REST API, orquestador
└── frontend/         # Vite 8 + React 19 + TypeScript strict
    └── src/
        ├── types/          # Mirror de tipos del backend
        ├── store/          # Zustand store + WebSocket client
        └── components/     # Header, SpreadMatrix, OrderBook, BotConsole,
                            # WalletPanel, Analytics, TerminalLog
```

## ⚡ Stack Tecnológico

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Backend runtime | Node.js 22 + tsx | Nativo, async, TypeScript directo |
| HTTP Server | Express 5 | Non-deprecated, tipos limpios |
| WebSocket server | `ws` v8 | Low-level, sin overhead |
| Exchange feeds | Binance `bookTicker` + `depth20@100ms` | Latencia <10ms |
| Exchange feeds | Kraken WS v2 `ticker` + `book` | Oficial, delta updates |
| Frontend bundler | Vite 8 | HMR instantáneo |
| UI framework | React 19 | Concurrent mode, sin wrapper |
| Estado | Zustand 5 + subscribeWithSelector | Sin re-renders innecesarios |
| Charts | Recharts 2 | React-native, SVG |
| Icons | Lucide React | TypeScript nativo |
| CSS | Vanilla CSS + Custom Properties | Sin dependencias |

## 🚀 Quick Start

### Backend
```bash
cd backend
npm install
npm run dev        # Escucha en :3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Escucha en :5173
```

## 🔌 API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/config` | Configuración actual del bot |
| PATCH | `/api/config` | Actualizar configuración |
| GET | `/api/wallet` | Balances de wallets |
| GET | `/api/metrics` | Métricas de performance |
| POST | `/api/circuit-breaker/reset` | Reset del circuit breaker |

## 🔌 WebSocket API (ws://localhost:3001)

### Server → Client Messages

| type | payload |
|------|---------|
| `orderbook_update` | `OrderBook` |
| `opportunity_detected` | `ArbitrageOpportunity` |
| `opportunity_executed` | `ArbitrageOpportunity` |
| `opportunity_rejected` | `ArbitrageOpportunity` |
| `wallet_update` | `WalletState` |
| `metrics_update` | `PerformanceMetrics` |
| `circuit_breaker` | `CircuitBreakerState` |
| `connection_status` | `ConnectionStatus` |
| `log_entry` | `LogEntry` |

### Client → Server Messages

```json
{ "type": "config_update", "payload": { "enabled": true, "minProfitPct": 0.05 } }
{ "type": "circuit_breaker_reset" }
```

## 📐 Lógica de Arbitraje

1. **Detección**: `Bid_B - Ask_A > 0` → oportunidad bruta detectada
2. **Slippage VWAP**: Consume niveles del order book hasta llenar `tradeVolumeBtc`
3. **Costo neto**: `(Ask_vwap × vol × (1 + feeA)) - (Bid_vwap × vol × (1 - feeB))`
4. **Filtros**: netProfit% ≥ minProfitPct && balance suficiente && circuit breaker no activo
5. **Ejecución**: Delay simulado de `simulatedLatencyMs`, luego actualiza wallets

## 🛡️ Circuit Breakers

| Trigger | Condición |
|---------|-----------|
| `max_drawdown` | Portfolio cae > `maxDrawdownPct`% del valor inicial |
| `consecutive_losses` | `maxConsecutiveLosses` trades negativos consecutivos |
| `manual_stop` | Botón de pánico / toggle desactivado |

## 🌐 Despliegue

- **Backend**: Railway o Render (Dockerfile opcional)
- **Frontend**: Vercel (build: `npm run build`)
- Setear `VITE_WS_URL=wss://tu-backend.railway.app` en Vercel
