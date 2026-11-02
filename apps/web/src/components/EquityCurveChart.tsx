'use client';

import type { PaperAccountResponse } from '@/lib/hooks';

export interface EquityCurveChartProps {
  account: PaperAccountResponse | null;
  isLoading: boolean;
}

export function EquityCurveChart({ account, isLoading }: EquityCurveChartProps) {
  if (isLoading || !account) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Equity Trend</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Loading chart...</p>
          </div>
        </div>
      </div>
    );
  }

  const gainPct = ((account.currentBalance - account.startingBalance) / account.startingBalance) * 100;

  // Simple ASCII representation
  const balanceChange = account.currentBalance - account.startingBalance;
  const isPositive = balanceChange >= 0;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Equity Trend</h3>
        <span className={`badge ${isPositive ? 'ok' : 'error'}`}>
          {isPositive ? '📈' : '📉'} {isPositive ? '+' : ''}
          {gainPct.toFixed(2)}%
        </span>
      </div>
      <div className="card-body">
        <div className="stack gap-3">
          <div style={{ fontSize: '13px' }}>
            <div className="row-between" style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Starting Balance</span>
              <strong style={{ color: 'var(--text)' }}>
                ${account.startingBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="row-between" style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Current Balance</span>
              <strong style={{ color: 'var(--accent)' }}>
                ${account.currentBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="row-between">
              <span style={{ color: 'var(--text-muted)' }}>Change</span>
              <strong style={{ color: isPositive ? 'var(--positive)' : 'var(--negative)' }}>
                {isPositive ? '+' : ''}
                ${Math.abs(balanceChange).toLocaleString('en-US', { maximumFractionDigits: 2 })} ({gainPct.toFixed(2)}%)
              </strong>
            </div>
          </div>

          {/* Visual progress bar */}
          <div style={{ marginTop: '10px' }}>
            <div
              style={{
                height: '8px',
                backgroundColor: 'var(--border)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(Math.abs(gainPct) * 2, 100)}%`,
                  backgroundColor: isPositive ? 'var(--positive)' : 'var(--negative)',
                  transition: 'width 200ms ease',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
            ℹ️ Full equity curve with trade-by-trade P&L will be available in Phase 8
          </div>
        </div>
      </div>
    </div>
  );
}
