import type { Candle, CandleGap, MarketSummary, Trend } from './types';

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function simpleMovingAverage(candles: Candle[], period: number): number | null {
  if (candles.length < period) return null;
  return average(candles.slice(-period).map((candle) => candle.close));
}

function classifyTrend(
  lastClose: number,
  sma20: number | null,
  sma50: number | null,
): Trend {
  if (sma20 === null) return 'unknown';
  if (sma50 === null) {
    if (lastClose > sma20) return 'uptrend';
    if (lastClose < sma20) return 'downtrend';
    return 'range';
  }
  if (lastClose > sma20 && sma20 > sma50) return 'uptrend';
  if (lastClose < sma20 && sma20 < sma50) return 'downtrend';
  return 'range';
}

/**
 * Summarise a candle series without inventing values.
 * Returns null for an empty series. Volume is only averaged over candles that
 * actually report volume; providers that omit volume leave it null.
 */
export function summarizeCandles(
  candles: Candle[],
  gaps: CandleGap[] = [],
): MarketSummary | null {
  if (candles.length === 0) return null;
  const ordered = [...candles].sort((left, right) => left.time - right.time);
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const volumes = ordered
    .map((candle) => candle.volume)
    .filter((volume): volume is number => volume !== null);
  const sma20 = simpleMovingAverage(ordered, 20);
  const sma50 = simpleMovingAverage(ordered, 50);
  const change = last.close - first.close;

  return {
    candleCount: ordered.length,
    lastClose: last.close,
    firstClose: first.close,
    change,
    changePct: first.close === 0 ? 0 : (change / first.close) * 100,
    periodHigh: Math.max(...ordered.map((candle) => candle.high)),
    periodLow: Math.min(...ordered.map((candle) => candle.low)),
    averageRange:
      average(ordered.map((candle) => candle.high - candle.low)) ?? 0,
    averageVolume: average(volumes),
    volumeAvailable: volumes.length > 0,
    sma20,
    sma50,
    trend: classifyTrend(last.close, sma20, sma50),
    gapCount: gaps.length,
    expectedGapCount: gaps.filter((gap) => gap.expected).length,
    asOf: new Date(last.time).toISOString(),
  };
}
