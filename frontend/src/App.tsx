import { useEffect } from 'react';
import { Header } from './components/Header.js';
import { SpreadMatrix } from './components/SpreadMatrix.js';
import { OrderBook } from './components/OrderBook.js';
import { BotConsole } from './components/BotConsole.js';
import { WalletPanel } from './components/WalletPanel.js';
import { Analytics } from './components/Analytics.js';
import { TerminalLog } from './components/TerminalLog.js';
import { connectWebSocket, disconnectWebSocket } from './store/useTradingStore.js';
import './index.css';

export default function App() {
  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, []);

  return (
    <div className="app-layout">
      <Header />

      {/* Main dashboard grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gridTemplateRows: '230px 1fr 180px 120px',
        gap: '6px',
        padding: '6px',
        overflow: 'hidden',
        height: '100%',
      }}>
        {/* Row 1, Col 1: Spread Matrix */}
        <div style={{ gridColumn: 1, gridRow: 1, minHeight: 0, overflow: 'hidden' }}>
          <SpreadMatrix />
        </div>

        {/* Row 1-2, Col 2: Bot Console */}
        <div style={{ gridColumn: 2, gridRow: '1 / 3', minHeight: 0, overflow: 'hidden' }}>
          <BotConsole />
        </div>

        {/* Row 2, Col 1: Order Books */}
        <div style={{ gridColumn: 1, gridRow: 2, minHeight: 0, overflow: 'hidden' }}>
          <OrderBook />
        </div>

        {/* Row 3, Col 1: Analytics */}
        <div style={{ gridColumn: 1, gridRow: 3, minHeight: 0, overflow: 'hidden' }}>
          <Analytics />
        </div>

        {/* Row 3, Col 2: Wallet Panel */}
        <div style={{ gridColumn: 2, gridRow: '3 / 5', minHeight: 0, overflow: 'hidden' }}>
          <WalletPanel />
        </div>

        {/* Row 4, Col 1: Terminal */}
        <div style={{ gridColumn: 1, gridRow: 4, minHeight: 0, overflow: 'hidden' }}>
          <TerminalLog />
        </div>
      </div>
    </div>
  );
}
