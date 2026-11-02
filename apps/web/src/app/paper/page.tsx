'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';
import { EquityCurveChart } from '@/components/EquityCurveChart';
import { OpenOrdersList } from '@/components/OpenOrdersList';
import { OpenPositionsList } from '@/components/OpenPositionsList';
import { OrderEntryForm } from '@/components/OrderEntryForm';
import { PaperAccountHeader } from '@/components/PaperAccountHeader';
import { usePaperAccount, usePaperOrders, usePaperPositions } from '@/lib/hooks';

export default function PaperPage() {
  const account = usePaperAccount();
  const orders = usePaperOrders();
  const positions = usePaperPositions();

  const handleRefresh = useCallback(async () => {
    await Promise.all([account.mutate(), orders.mutate(), positions.mutate()]);
  }, [account, orders, positions]);

  const accountBalance = account.data?.currentBalance ?? 10000;
  const isLoading = account.isLoading || orders.isLoading || positions.isLoading;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 7 · Paper Trading</span>
          <h2>Manage paper trading positions and real-time P&L.</h2>
          <p>
            View your account summary, open positions, and pending orders. Monitor unrealized P&L in real-time
            with live position quotes. Create new orders directly or from the Trade Planner.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge">Position management</span>
          <span className="badge">Real-time P&L</span>
          <span className="badge">Order execution</span>
        </div>
      </section>

      {(account.error || orders.error || positions.error) && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>
            {account.error?.message || orders.error?.message || positions.error?.message || 'Error loading data'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', alignItems: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={() => void handleRefresh()} disabled={isLoading}>
          <RefreshCw size={14} />
          Refresh
        </button>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Auto-refreshes every 10 seconds</span>
      </div>

      {/* Account Summary */}
      <PaperAccountHeader account={account.data ?? null} isLoading={account.isLoading} />

      {/* Equity Chart */}
      <EquityCurveChart account={account.data ?? null} isLoading={account.isLoading} />

      {/* Create Order */}
      <OrderEntryForm accountBalance={accountBalance} onOrderCreated={handleRefresh} />

      {/* Open Positions */}
      <OpenPositionsList
        positions={positions.data?.positions ?? null}
        isLoading={positions.isLoading}
        onClose={handleRefresh}
        error={positions.error}
      />

      {/* Open Orders */}
      <OpenOrdersList
        orders={orders.data?.orders ?? null}
        isLoading={orders.isLoading}
        onRefresh={handleRefresh}
        error={orders.error}
      />
    </div>
  );
}
