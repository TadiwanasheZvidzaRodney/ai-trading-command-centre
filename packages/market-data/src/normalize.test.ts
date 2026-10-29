import type { Candle, ProviderInfo } from '@atc/shared';
import { describe, expect, it } from 'vitest';
import {
  aggregateCandles,
  createCandleSeries,
  createQuote,
  detectGaps,
  refreshQuoteAge,
  spansWeekend,
} from './normalize.js';

const provider: ProviderInfo = {
  id: 'test',
  displayName: 'Test provider',
  quality: 'reference',
};

const fetchedAt = new Date('2026-10-27T12:00:00.000Z');

describe('quote normalisation', () => {
  it('computes mid, spread, age and quality from a valid bid/ask', () => {
    const quote = createQuote({
      instrument: 'EUR/USD',
      bid: 1.1,
      ask: 1.1002,
      provider,
      observedAt: '2026-10-27T11:59:30.000Z',
      fetchedAt,
    });
    expect(quote.mid).toBe(1.1001);
    expect(quote.spread).toBeCloseTo(0.0002, 8);
    expect(quote.ageSeconds).toBe(30);
    expect(quote.stale).toBe(false);
    expect(quote.quality).toBe('reference');
  });

  it('rejects an inverted market', () => {
    expect(() =>
      createQuote({
        instrument: 'EUR/USD',
        bid: 1.2,
        ask: 1.1,
        provider,
        observedAt: fetchedAt,
        fetchedAt,
      }),
    ).toThrow(/ask below the bid/i);
  });

  it('rejects a one-sided quote and a future timestamp', () => {
    expect(() =>
      createQuote({
        instrument: 'EUR/USD',
        bid: 1.1,
        ask: null,
        provider,
        observedAt: fetchedAt,
        fetchedAt,
      }),
    ).toThrow(/one side/i);

    expect(() =>
      createQuote({
        instrument: 'EUR/USD',
        bid: 1.1,
        ask: 1.1002,
        provider,
        observedAt: '2026-10-27T13:00:00.000Z',
        fetchedAt,
      }),
    ).toThrow(/future/i);
  });

  it('refreshes age and stale status from the observation time', () => {
    const quote = createQuote({
      instrument: 'EUR/USD',
      bid: 1.1,
      ask: 1.1002,
      provider,
      observedAt: fetchedAt,
      fetchedAt,
    });
    const refreshed = refreshQuoteAge(
      quote,
      new Date('2026-10-27T12:05:00.000Z'),
    );
    expect(refreshed.ageSeconds).toBe(300);
    expect(refreshed.stale).toBe(true);
  });
});

describe('candle normalisation', () => {
  it('detects weekend gaps but not ordinary missing bars', () => {
    const friday = Date.UTC(2026, 9, 23, 21);
    const sunday = Date.UTC(2026, 9, 25, 21);
    const gaps = detectGaps(
      [
        { time: friday, open: 1, high: 2, low: 1, close: 2, volume: null },
        { time: sunday, open: 1, high: 2, low: 1, close: 2, volume: null },
      ],
      60 * 60 * 1000,
    );
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ missing: 47, expected: true });

    const intraday = detectGaps(
      [
        { time: Date.UTC(2026, 9, 20, 12), open: 1, high: 2, low: 1, close: 2, volume: null },
        { time: Date.UTC(2026, 9, 20, 14), open: 1, high: 2, low: 1, close: 2, volume: null },
      ],
      60 * 60 * 1000,
    );
    expect(intraday[0]).toMatchObject({ missing: 1, expected: false });
  });

  it('recognises weekend spans and rejects very long unexplained gaps', () => {
    expect(
      spansWeekend(Date.UTC(2026, 9, 23, 21), Date.UTC(2026, 9, 25, 21)),
    ).toBe(true);
    expect(
      spansWeekend(Date.UTC(2026, 9, 20, 12), Date.UTC(2026, 9, 20, 14)),
    ).toBe(false);
    expect(
      spansWeekend(Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 1)),
    ).toBe(false);
  });

  it('aggregates 1h candles into a 4h candle', () => {
    const start = Date.UTC(2026, 9, 27, 0);
    const hourly: Candle[] = [0, 1, 2, 3].map((hour) => ({
      time: start + hour * 60 * 60 * 1000,
      open: 100 + hour,
      high: 102 + hour,
      low: 99 + hour,
      close: 101 + hour,
      volume: hour + 1,
    }));
    const aggregated = aggregateCandles(hourly, 60 * 60 * 1000, 4 * 60 * 60 * 1000);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]).toEqual({
      time: start,
      open: 100,
      high: 105,
      low: 99,
      close: 104,
      volume: 10,
    });
  });

  it('removes duplicates and invalid OHLC rows', () => {
    const series = createCandleSeries({
      instrument: 'EUR/USD',
      timeframe: '1h',
      provider,
      raw: [
        { time: Date.UTC(2026, 9, 27, 2), open: 1.1, high: 1.2, low: 1.0, close: 1.15, volume: null },
        { time: Date.UTC(2026, 9, 27, 1), open: 1.1, high: 1.2, low: 1.0, close: 1.15, volume: null },
        { time: Date.UTC(2026, 9, 27, 2), open: 1.1, high: 1.2, low: 1.0, close: 1.16, volume: null },
        { time: Date.UTC(2026, 9, 27, 3), open: 1.1, high: 1.0, low: 1.2, close: 1.15, volume: null },
      ],
      fetchedAt,
      quality: 'reference',
      proxy: false,
    });

    expect(series.candles).toHaveLength(2);
    expect(series.candles[0]?.time).toBe(Date.UTC(2026, 9, 27, 1));
    expect(series.candles[1]?.close).toBe(1.16);
    expect(series.duplicatesRemoved).toBe(1);
    expect(series.notes.join(' ')).toContain('invalid candle');
    expect(series.notes.join(' ')).toContain('duplicate candle');
  });
});
