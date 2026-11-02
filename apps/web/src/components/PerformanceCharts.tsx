'use client';

import type { PaperAnalyticsResponse } from '@/lib/hooks';

export interface PerformanceChartsProps {
  analytics: PaperAnalyticsResponse | null;
  isLoading: boolean;
}

export function PerformanceCharts({ analytics, isLoading }: PerformanceChartsProps) {
  if (isLoading || !analytics) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Performance Overview</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Loading charts...</p>
          </div>
        </div>
      </div>
    );
  }

  const winningTrades = Math.round((analytics.winRate / 100) * analytics.closedTrades);
  const losingTrades = analytics.closedTrades - winningTrades;

  return (
    <div className="grid grid-2 gap-4">
      {/* Win/Loss Distribution */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Win/Loss Distribution</h3>
        </div>
        <div className="card-body">
          {analytics.closedTrades === 0 ? (
            <div className="empty-state">
              <p>No closed trades yet</p>
            </div>
          ) : (
            <div>
              <div className="stack gap-3">
                <div>
                  <div className="row-between" style={{ marginBottom: '6px' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      Winning Trades
                    </span>
                    <strong style={{ fontSize: '12.5px', color: 'var(--positive)' }}>
                      {winningTrades}
                    </strong>
                  </div>
                  <div
                    style={{
                      height: '24px',
                      backgroundColor: 'var(--border)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${(winningTrades / analytics.closedTrades) * 100}%`,
                        backgroundColor: 'var(--positive)',
                        transition: 'width 200ms ease',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="row-between" style={{ marginBottom: '6px' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      Losing Trades
                    </span>
                    <strong style={{ fontSize: '12.5px', color: 'var(--negative)' }}>
                      {losingTrades}
                    </strong>
                  </div>
                  <div
                    style={{
                      height: '24px',
                      backgroundColor: 'var(--border)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${(losingTrades / analytics.closedTrades) * 100}%`,
                        backgroundColor: 'var(--negative)',
                        transition: 'width 200ms ease',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Risk/Reward Summary */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Risk-Reward Analysis</h3>
        </div>
        <div className="card-body">
          {analytics.closedTrades === 0 ? (
            <div className="empty-state">
              <p>No closed trades yet</p>
            </div>
          ) : (
            <div className="stack gap-3">
              <div>
                <div className="row-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Profit Factor
                  </span>
                  <strong
                    style={{
                      fontSize: '12.5px',
                      color:
                        analytics.profitFactor > 1.5
                          ? 'var(--positive)'
                          : analytics.profitFactor > 1
                            ? 'var(--warning)'
                            : 'var(--negative)',
                    }}
                  >
                    {analytics.profitFactor.toFixed(2)}
                  </strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {analytics.profitFactor > 1
                    ? 'Profitable win/loss ratio'
                    : 'Losses exceed wins'}
                </div>
              </div>

              <div className="divider" style={{ margin: '8px 0' }} />

              <div>
                <div className="row-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Average Expectancy
                  </span>
                  <strong
                    style={{
                      fontSize: '12.5px',
                      color: analytics.expectancy > 0 ? 'var(--positive)' : 'var(--negative)',
                    }}
                  >
                    {analytics.expectancy > 0 ? '+' : ''}
                    ${Math.abs(analytics.expectancy).toLocaleString('en-US', {
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Average per trade basis
                </div>
              </div>

              <div className="divider" style={{ margin: '8px 0' }} />

              <div>
                <div className="row-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Max Drawdown
                  </span>
                  <strong style={{ fontSize: '12.5px', color: 'var(--negative)' }}>
                    {analytics.maxDD.toFixed(2)}%
                  </strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Maximum account decline
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
