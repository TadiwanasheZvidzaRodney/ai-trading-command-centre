'use client';

import type { PaperAnalyticsResponse } from '@/lib/hooks';

export interface AnalyticsMetricsProps {
  analytics: PaperAnalyticsResponse | null;
  isLoading: boolean;
}

export function AnalyticsMetrics({ analytics, isLoading }: AnalyticsMetricsProps) {
  if (isLoading || !analytics) {
    return (
      <div className="grid grid-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card stat">
            <span className="spinner" />
          </div>
        ))}
      </div>
    );
  }

  const profitFactorClass = analytics.profitFactor > 1 ? 'positive' : analytics.profitFactor > 0.5 ? 'warning' : 'negative';
  const winRateClass = analytics.winRate > 50 ? 'positive' : analytics.winRate > 40 ? 'warning' : 'negative';
  const pnlClass = analytics.totalRealizedPnL >= 0 ? 'positive' : 'negative';
  const expectancyClass = analytics.expectancy > 0 ? 'positive' : 'negative';

  return (
    <div className="grid grid-3 gap-4">
      <div className="card">
        <div className="stat">
          <div className="stat-label">Total Trades</div>
          <div className="stat-value">{analytics.closedTrades}</div>
          <div className="stat-hint">{analytics.openTrades} open</div>
        </div>
      </div>

      <div className="card">
        <div className="stat">
          <div className="stat-label">Win Rate</div>
          <div className={`stat-value ${winRateClass}`}>{analytics.winRate.toFixed(1)}%</div>
          <div className="stat-hint">Based on {analytics.closedTrades} trades</div>
        </div>
      </div>

      <div className="card">
        <div className="stat">
          <div className="stat-label">Profit Factor</div>
          <div className={`stat-value ${profitFactorClass}`}>{analytics.profitFactor.toFixed(2)}</div>
          <div className="stat-hint">Wins / Losses ratio</div>
        </div>
      </div>

      <div className="card">
        <div className="stat">
          <div className="stat-label">Expectancy</div>
          <div className={`stat-value ${expectancyClass}`}>
            ${Math.abs(analytics.expectancy).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </div>
          <div className="stat-hint">Avg P&L per trade</div>
        </div>
      </div>

      <div className="card">
        <div className="stat">
          <div className="stat-label">Max Drawdown</div>
          <div className="stat-value negative">{analytics.maxDD.toFixed(2)}%</div>
          <div className="stat-hint">Peak to trough decline</div>
        </div>
      </div>

      <div className="card">
        <div className="stat">
          <div className="stat-label">Total Realized P&L</div>
          <div className={`stat-value ${pnlClass}`}>
            {analytics.totalRealizedPnL >= 0 ? '+' : ''}
            ${Math.abs(analytics.totalRealizedPnL).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </div>
          <div className="stat-hint">Current balance: ${analytics.accountBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>
  );
}
