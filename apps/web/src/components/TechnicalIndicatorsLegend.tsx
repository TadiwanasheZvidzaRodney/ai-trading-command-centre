'use client';

import type { TechnicalIndicators } from '@atc/technical-analysis';
import { formatIndicator, formatPercent } from '@/lib/format';

export function TechnicalIndicatorsLegend({ 
  data 
}: { 
  data: (TechnicalIndicators & { timestamp?: string | number }) | null 
}) {
  if (!data) return null;

  const current = data.indicators;
  const candles = data.indicators.sma_20.length;
  const lastIdx = candles - 1;

  const sma20 = current.sma_20[lastIdx];
  const sma50 = current.sma_50[lastIdx];
  const ema9 = current.ema_9[lastIdx];
  const rsi = current.rsi_14[lastIdx];
  const macd = current.macd[lastIdx];
  const atr = current.atr_14[lastIdx];
  const bbands = current.bbands_20_2[lastIdx];
  const stoch = current.stochastic_14_3_3[lastIdx];

  return (
    <div className="indicator-legend">
      <div className="legend-row">
        <div className="legend-item">
          <span className="legend-label">SMA 20</span>
          <span className="legend-value mono" style={{ color: '#3b82f6' }}>
            {formatIndicator(sma20, 4)}
          </span>
        </div>
        <div className="legend-item">
          <span className="legend-label">SMA 50</span>
          <span className="legend-value mono" style={{ color: '#f97316' }}>
            {formatIndicator(sma50, 4)}
          </span>
        </div>
        <div className="legend-item">
          <span className="legend-label">EMA 9</span>
          <span className="legend-value mono" style={{ color: '#22c55e' }}>
            {formatIndicator(ema9?.value, 4)}
          </span>
        </div>
      </div>

      <div className="legend-row">
        <div className="legend-item">
          <span className="legend-label">RSI 14</span>
          <span
            className="legend-value mono"
            style={{
              color:
                rsi === null || rsi === undefined
                  ? '#8b9aab'
                  : rsi > 70
                    ? '#ef4444'
                    : rsi < 30
                      ? '#22c55e'
                      : '#fbbf24',
            }}
          >
            {formatIndicator(rsi, 2)}
          </span>
        </div>
        <div className="legend-item">
          <span className="legend-label">MACD</span>
          <span
            className="legend-value mono"
            style={{
              color:
                macd === null || macd === undefined
                  ? '#8b9aab'
                  : macd.histogram > 0
                    ? '#22c55e'
                    : '#ef4444',
            }}
          >
            {formatIndicator(macd?.macd, 4)}
          </span>
        </div>
        <div className="legend-item">
          <span className="legend-label">ATR 14</span>
          <span className="legend-value mono">{formatIndicator(atr, 4)}</span>
        </div>
      </div>

      <div className="legend-row">
        <div className="legend-item">
          <span className="legend-label">Bollinger Bands</span>
          <span className="legend-value mono">
            {bbands
              ? `${formatIndicator(bbands.lower, 4)} - ${formatIndicator(bbands.upper, 4)}`
              : '—'}
          </span>
        </div>
        <div className="legend-item">
          <span className="legend-label">%B</span>
          <span className="legend-value mono">{formatPercent(bbands?.percent_b)}</span>
        </div>
        <div className="legend-item">
          <span className="legend-label">Stochastic K/D</span>
          <span className="legend-value mono">
            {stoch ? `${formatIndicator(stoch.k, 1)} / ${formatIndicator(stoch.d, 1)}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
