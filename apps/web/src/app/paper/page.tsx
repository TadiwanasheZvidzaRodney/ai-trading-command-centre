'use client';

import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { EquityCurveChart } from '@/components/EquityCurveChart';
import { OpenOrdersList } from '@/components/OpenOrdersList';
import { OpenPositionsList } from '@/components/OpenPositionsList';
import { OrderEntryForm } from '@/components/OrderEntryForm';
import { PaperAccountHeader } from '@/components/PaperAccountHeader';
import {
  useKillSwitch,
  usePaperAccount,
  usePaperOrders,
  usePaperPositions,
} from '@/lib/hooks';

export default function PaperPage() {
  const account = usePaperAccount();
  const orders = usePaperOrders();
  const positions = usePaperPositions();
  const killSwitch = useKillSwitch();
  const [controlBusy, setControlBusy] = useState<'kill' | 'evaluate' | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [controlMessage, setControlMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    await Promise.all([
      account.mutate(),
      orders.mutate(),
      positions.mutate(),
      killSwitch.mutate(),
    ]);
  };

  const handleToggleKillSwitch = async () => {
    setControlBusy('kill');
    setControlError(null);
    setControlMessage(null);
    try {
      const next = !(killSwitch.data?.enabled ?? false);
      await api.post('/api/v1/risk/kill-switch', {
        enabled: next,
        reason: next ? 'Paused from paper trading dashboard' : '',
      });
      setControlMessage(next ? 'Trading halted. New orders will be rejected.' : 'Trading resumed.');
      await handleRefresh();
    } catch (err) {
      setControlError(err instanceof Error ? err.message : 'Failed to change kill switch');
    } finally {
      setControlBusy(null);
    }
  };

  const handleEvaluate = async () => {
    setControlBusy('evaluate');
    setControlError(null);
    setControlMessage(null);
    try {
      const result = await api.post<{ evaluated: number; closed: unknown[] }>(
        '/api/v1/paper/evaluate',
        {},
      );
      setControlMessage(
        result.closed.length > 0
          ? `Evaluated ${result.evaluated} position(s); ${result.closed.length} closed on stop/target.`
          : `Evaluated ${result.evaluated} position(s); none hit a stop or target.`,
      );
      await handleRefresh();
    } catch (err) {
      setControlError(err instanceof Error ? err.message : 'Failed to evaluate positions');
    } finally {
      setControlBusy(null);
    }
  };

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

      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={() => void handleRefresh()} disabled={isLoading}>
          <RefreshCw size={14} />
          Refresh
        </button>
        <button
          type="button"
          className={`btn ${killSwitch.data?.enabled ? 'btn-danger' : 'btn-ghost'}`}
          onClick={() => void handleToggleKillSwitch()}
          disabled={controlBusy !== null}
        >
          <ShieldAlert size={14} />
          {killSwitch.data?.enabled ? 'Resume trading' : 'Halt trading'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void handleEvaluate()}
          disabled={controlBusy !== null}
        >
          Evaluate stops &amp; targets
        </button>
        <span className="badge">
          Kill switch: {killSwitch.data?.enabled ? 'ON' : 'off'}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Auto-refreshes every 10 seconds</span>
      </div>

      {controlError && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>{controlError}</span>
        </div>
      )}

      {controlMessage && (
        <div className="banner info">
          <span>{controlMessage}</span>
        </div>
      )}

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
