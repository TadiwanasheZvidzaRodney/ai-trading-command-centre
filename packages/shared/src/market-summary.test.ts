import { describe, expect, it } from 'vitest';
import { summarizeCandles } from './market-summary';
import type { Candle } from './types';

function series(count: number, start = 100, step = 1, volume: number | null = 1000): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = start + index * step;
    return {
      time: Date.UTC(2026, 0, 1 + index),
      open: close - step / 2,
      high: close + 2,
      low: close - 2,
      close,
      volume,
    };
  });
}

describe('summarizeCandles', () => {
  it('returns null for an empty series instead of inventing values', () => {
    expect(summarizeCandles([])).toBeNull();
  });

  it('derives change, range, averages and trend from the supplied candles', () => {
    const summary = summarizeCandles(series(60), [
      { after: 1, before: 2, missing: 1, expected: true },
      { after: 3, before: 4, missing: 1, expected: false },
    ]);
    expect(summary).not.toBeNull();
    expect(summary).toMatchObject({
      candleCount: 60,
      lastClose: 159,
      firstClose: 100,
      change: 59,
      changePct: 59,
      periodHigh: 161,
      periodLow: 98,
      averageRange: 4,
      averageVolume: 1000,
      volumeAvailable: true,
      trend: 'uptrend',
      gapCount: 2,
      expectedGapCount: 1,
    });
    expect(summary?.sma20).toBeCloseTo(149.5, 6);
    expect(summary?.sma50).toBeCloseTo(134.5, 6);
    expect(summary?.asOf).toBe(new Date(Date.UTC(2026, 0, 60)).toISOString());
  });

  it('does not fabricate volume when the provider omits it', () => {
    const summary = summarizeCandles(series(30, 100, 1, null));
    expect(summary?.volumeAvailable).toBe(false);
    expect(summary?.averageVolume).toBeNull();
  });

  it('marks trend as unknown when there are too few candles for a moving average', () => {
    const summary = summarizeCandles(series(10));
    expect(summary?.sma20).toBeNull();
    expect(summary?.sma50).toBeNull();
    expect(summary?.trend).toBe('unknown');
  });

  it('classifies a flat series as a range', () => {
    const summary = summarizeCandles(series(60, 100, 0));
    expect(summary?.trend).toBe('range');
    expect(summary?.change).toBe(0);
    expect(summary?.changePct).toBe(0);
  });

  it('sorts unordered candles before calculating', () => {
    const candles = series(30);
    const summary = summarizeCandles([...candles].reverse());
    expect(summary?.firstClose).toBe(100);
    expect(summary?.lastClose).toBe(129);
    expect(summary?.asOf).toBe(new Date(Date.UTC(2026, 0, 30)).toISOString());
  });
});
