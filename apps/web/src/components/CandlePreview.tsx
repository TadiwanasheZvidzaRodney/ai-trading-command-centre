import type { Candle, CandleSeries } from '@atc/shared';

const WIDTH = 900;
const HEIGHT = 320;
const PADDING = { top: 18, right: 18, bottom: 30, left: 70 };

function formatCandleTime(time: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(time));
}

function formatPrice(value: number, precision: number): string {
  return value.toFixed(precision);
}

export function CandlePreview({
  series,
  pricePrecision,
}: {
  series: CandleSeries;
  pricePrecision: number;
}) {
  const candles: Candle[] = series.candles.slice(-60);
  const first = candles.at(0);
  const last = candles.at(-1);
  if (!first || !last) {
    return (
      <div className="empty-state">
        <h3>No candles available</h3>
        <p>The provider returned an empty series. No synthetic candles were generated.</p>
      </div>
    );
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const lowest = Math.min(...candles.map((candle) => candle.low));
  const highest = Math.max(...candles.map((candle) => candle.high));
  const range = highest - lowest || 1;
  const y = (value: number) => PADDING.top + ((highest - value) / range) * plotHeight;
  const slot = plotWidth / candles.length;
  const bodyWidth = Math.max(2, Math.min(12, slot * 0.62));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => lowest + range * fraction);

  return (
    <div className="candle-preview">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${series.instrument} ${series.timeframe} candlestick preview from ${formatCandleTime(first.time)} to ${formatCandleTime(last.time)} UTC`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              className="candle-grid"
            />
            <text
              x={PADDING.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="candle-axis"
            >
              {formatPrice(tick, pricePrecision)}
            </text>
          </g>
        ))}

        {candles.map((candle, index) => {
          const x = PADDING.left + slot * index + slot / 2;
          const positive = candle.close >= candle.open;
          const color = positive ? 'var(--positive)' : 'var(--negative)';
          const bodyTop = y(Math.max(candle.open, candle.close));
          const bodyBottom = y(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);
          return (
            <g key={candle.time}>
              <line
                x1={x}
                x2={x}
                y1={y(candle.high)}
                y2={y(candle.low)}
                stroke={color}
                strokeWidth={1.2}
              />
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={color}
                rx={1}
              />
            </g>
          );
        })}

        <text x={PADDING.left} y={HEIGHT - 9} className="candle-axis">
          {formatCandleTime(first.time)} UTC
        </text>
        <text
          x={WIDTH - PADDING.right}
          y={HEIGHT - 9}
          textAnchor="end"
          className="candle-axis"
        >
          {formatCandleTime(last.time)} UTC
        </text>
      </svg>
      <p className="candle-legend">
        Last {candles.length} candles · {series.timeframe} · UTC buckets · final candle may be
        incomplete while the market is open.
      </p>
    </div>
  );
}
