import { describe, expect, it, vi } from 'vitest';
import eurUsdDaily from '../fixtures/yahoo-eurusd-1d.json';
import eurUsdHourly from '../fixtures/yahoo-eurusd-1h.json';
import goldDaily from '../fixtures/yahoo-gc-1d.json';
import { ProviderResponseError } from '../errors.js';
import { jsonResponse, providerContext } from '../test-helpers.js';
import { YahooCandleProvider } from './yahoo.js';

const FOUR_HOURS = 4 * 60 * 60 * 1000;

describe('Yahoo candle adapter', () => {
  it('normalises daily forex candles, sorts them and flags weekend gaps', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(eurUsdDaily));
    const provider = new YahooCandleProvider();
    const series = await provider.fetchCandles(
      'EUR/USD',
      '1d',
      100,
      providerContext(fetchImpl as unknown as typeof fetch),
    );

    expect(series.instrument).toBe('EUR/USD');
    expect(series.timeframe).toBe('1d');
    expect(series.provider.id).toBe('yahoo');
    expect(series.quality).toBe('reference');
    expect(series.proxy).toBe(false);
    expect(series.candles).toHaveLength(5);
    expect(series.candles[0]?.time).toBe(1792537200 * 1000);
    expect(series.candles.at(-1)?.time).toBe(1793059200 * 1000);
    expect(series.candles.every((candle) => candle.volume === null)).toBe(true);
    expect(series.gaps).toHaveLength(1);
    expect(series.gaps[0]).toMatchObject({ missing: 2, expected: true });
    expect(series.notes.join(' ')).toContain('final candle may be incomplete');
  });

  it('labels GC=F as a COMEX gold futures proxy, not spot XAU/USD', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(goldDaily));
    const provider = new YahooCandleProvider();
    const series = await provider.fetchCandles(
      'XAU/USD',
      '1d',
      100,
      providerContext(fetchImpl as unknown as typeof fetch),
    );

    expect(series.instrument).toBe('XAU/USD');
    expect(series.proxy).toBe(true);
    expect(series.proxyFor).toBe('XAU/USD');
    expect(series.quality).toBe('proxy');
    expect(series.provider.quality).toBe('reference');
    expect(series.notes.join(' ')).toContain('COMEX gold futures (GC=F) proxy');
    expect(series.notes.join(' ')).toContain('Not spot XAU/USD');
    expect(series.candles[0]?.volume).toBe(214607);
  });

  it('aggregates Yahoo 1h candles into UTC 4h buckets', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(eurUsdHourly));
    const provider = new YahooCandleProvider();
    const series = await provider.fetchCandles(
      'EUR/USD',
      '4h',
      100,
      providerContext(fetchImpl as unknown as typeof fetch),
    );

    expect(series.timeframe).toBe('4h');
    expect(series.candles.length).toBeGreaterThan(10);
    expect(series.candles.every((candle) => candle.time % FOUR_HOURS === 0)).toBe(true);
    expect(series.notes.join(' ')).toContain('aggregated from Yahoo 1h candles');
    for (const candle of series.candles) {
      expect(candle.high).toBeGreaterThanOrEqual(candle.open);
      expect(candle.high).toBeGreaterThanOrEqual(candle.close);
      expect(candle.low).toBeLessThanOrEqual(candle.open);
      expect(candle.low).toBeLessThanOrEqual(candle.close);
    }
  });

  it('respects the requested candle limit', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(eurUsdDaily));
    const provider = new YahooCandleProvider();
    const series = await provider.fetchCandles(
      'EUR/USD',
      '1d',
      2,
      providerContext(fetchImpl as unknown as typeof fetch),
    );
    expect(series.candles).toHaveLength(2);
  });

  it('surfaces a provider error instead of returning an empty series', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ chart: { result: [], error: { description: 'No data found' } } }),
    );
    const provider = new YahooCandleProvider();
    await expect(
      provider.fetchCandles(
        'GBP/USD',
        '1d',
        100,
        providerContext(fetchImpl as unknown as typeof fetch),
      ),
    ).rejects.toBeInstanceOf(ProviderResponseError);
  });
});
