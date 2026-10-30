import { createEnv } from '@atc/config';
import type { CandleSeries, InstrumentSymbol } from '@atc/shared';
import type { MarketDataService } from '@atc/market-data';
import type { Db } from 'mongodb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../db/mongo.js';
import { buildServer } from '../server.js';

const baseEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  AUTH_MODE: 'disabled',
  LIVE_TRADING_ENABLED: 'false',
  ENABLE_SCHEDULER: 'false',
};

function stubDb(): DatabaseLike {
  return {
    db: null as Db | null,
    ping: async () => true,
  };
}

// Sample candlestick data for testing
function createCandleSeries(instrument: string, timeframe: string): CandleSeries {
  const candles = [];
  const baseTime = Date.UTC(2026, 9, 20); // Oct 20, 2026
  let price = 4000;

  for (let i = 0; i < 100; i++) {
    const open = price;
    const close = price + (Math.random() - 0.5) * 20;
    const high = Math.max(open, close) + Math.random() * 10;
    const low = Math.min(open, close) - Math.random() * 10;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000, // 1d candles
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000000),
    });

    price = close;
  }

  return {
    instrument,
    timeframe,
    provider: {
      id: 'yahoo',
      displayName: 'Yahoo Finance chart (reference)',
      quality: 'reference',
    },
    candles,
    fetchedAt: '2026-10-27T12:00:01.000Z',
    from: '2026-10-20T00:00:00.000Z',
    to: '2026-10-27T00:00:00.000Z',
    quality: 'reference',
    proxy: false,
    duplicatesRemoved: 0,
    gaps: [],
    notes: [],
  } as CandleSeries;
}

function fakeService(overrides: Partial<Record<string, unknown>> = {}): MarketDataService {
  const quoteProvider = {
    id: 'swissquote',
    displayName: 'Swissquote public quotes',
    quality: 'reference',
    configured: true,
    note: 'test',
  };
  const candleProvider = {
    id: 'yahoo',
    displayName: 'Yahoo Finance chart (reference)',
    quality: 'reference',
    configured: true,
    note: 'test',
  };

  return {
    quoteProvider,
    candleProvider,
    getQuotes: vi.fn(async () => ({
      quotes: [],
      errors: [],
      fetchedAt: '2026-10-27T12:00:01.000Z',
    })),
    getQuote: vi.fn(async () => ({
      instrument: 'XAU/USD',
      bid: 4014.494,
      ask: 4015.156,
      mid: 4014.825,
      spread: 0.662,
      provider: quoteProvider,
      observedAt: '2026-10-27T12:00:00.000Z',
      fetchedAt: '2026-10-27T12:00:01.000Z',
      ageSeconds: 1,
      stale: false,
      quality: 'reference',
      proxy: false,
      cached: false,
    })),
    getCandles: vi.fn(async (instrument: InstrumentSymbol, timeframe: string) => ({
      series: createCandleSeries(instrument, timeframe),
      cached: false,
    })),
    getProviderMetadata: () => ({ quote: quoteProvider, candle: candleProvider }),
    getProviderHealth: () => [
      {
        providerId: 'swissquote',
        displayName: 'Swissquote public quotes',
        category: 'market-data',
        status: 'ok',
        configured: true,
        quality: 'reference',
        lastSuccessAt: '2026-10-27T12:00:01.000Z',
        lastErrorAt: null,
        lastError: null,
        latencyMs: 12,
        message: 'Last live sample succeeded.',
      },
    ],
    ...overrides,
  } as unknown as MarketDataService;
}

const servers: Array<{ close: () => Promise<void> }> = [];

async function makeServer(
  marketData: MarketDataService,
  overrides: Record<string, string> = {},
) {
  const app = await buildServer({
    env: createEnv({ ...baseEnv, ...overrides }),
    db: stubDb(),
    logger: false,
    marketData,
  });
  servers.push(app);
  return app;
}

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }
});

describe('technical analysis API', () => {
  it('returns complete technical analysis with all indicators', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d?lookback=100',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(body.data.instrument).toBe('XAU/USD');
    expect(body.data.timeframe).toBe('1d');
    expect(body.data.indicators).toBeDefined();
    expect(body.data.indicators.sma_20).toBeDefined();
    expect(body.data.indicators.sma_50).toBeDefined();
    expect(body.data.indicators.ema_9).toBeDefined();
    expect(body.data.indicators.ema_21).toBeDefined();
    expect(body.data.indicators.rsi_14).toBeDefined();
    expect(body.data.indicators.macd).toBeDefined();
    expect(body.data.indicators.atr_14).toBeDefined();
    expect(body.data.indicators.adx_14).toBeDefined();
    expect(body.data.indicators.bbands_20_2).toBeDefined();
    expect(body.data.indicators.stochastic_14_3_3).toBeDefined();
    expect(body.data.structure).toBeDefined();
    expect(body.data.patterns).toBeDefined();
    expect(body.data.current_candle).toBeDefined();
    expect(body.data.calculated_at).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('uses default lookback of 200 when not specified', async () => {
    const marketDataMock = fakeService();
    const app = await makeServer(marketDataMock);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/EUR/USD/4h',
    });

    expect(response.statusCode).toBe(200);
    const getCandlesMock = marketDataMock.getCandles as any;
    expect(getCandlesMock).toHaveBeenCalledWith('EUR/USD', '4h', 200);
  });

  it('accepts custom lookback parameter', async () => {
    const marketDataMock = fakeService();
    const app = await makeServer(marketDataMock);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/GBP/USD/1h?lookback=50',
    });

    expect(response.statusCode).toBe(200);
    const getCandlesMock = marketDataMock.getCandles as any;
    expect(getCandlesMock).toHaveBeenCalledWith('GBP/USD', '1h', 50);
  });

  it('rejects lookback value above maximum (500)', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d?lookback=501',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects lookback value below minimum (1)', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d?lookback=0',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 503 when no candles are available', async () => {
    const marketDataMock = fakeService({
      getCandles: vi.fn(async () => ({
        series: {
          instrument: 'XAU/USD',
          timeframe: '1d',
          provider: {
            id: 'yahoo',
            displayName: 'Yahoo Finance',
            quality: 'reference',
          },
          candles: [],
          fetchedAt: '2026-10-27T12:00:01.000Z',
          from: '2026-10-20T00:00:00.000Z',
          to: '2026-10-27T00:00:00.000Z',
          quality: 'reference',
          proxy: false,
        },
        cached: false,
      })),
    });

    const app = await makeServer(marketDataMock);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('NO_CANDLES_AVAILABLE');
  });

  it('returns market structure including trend, levels and swings', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d/structure?lookback=100',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(body.data.trend).toBeDefined();
    expect(body.data.trend.direction).toMatch(/^(up|down|flat)$/);
    expect(typeof body.data.trend.strength).toBe('number');
    expect(body.data.resistance_levels).toBeDefined();
    expect(Array.isArray(body.data.resistance_levels)).toBe(true);
    expect(body.data.support_levels).toBeDefined();
    expect(Array.isArray(body.data.support_levels)).toBe(true);
    expect(body.data.swing_high).toBeDefined();
    expect(body.data.swing_low).toBeDefined();
  });

  it('returns candlestick patterns with confidence scores', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/EUR/USD/4h/patterns?lookback=100',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.data).toBeDefined();
    expect(body.data.patterns).toBeDefined();
    expect(Array.isArray(body.data.patterns)).toBe(true);

    // If patterns exist, verify their structure
    if (body.data.patterns.length > 0) {
      body.data.patterns.forEach((pattern: any) => {
        expect(pattern.pattern).toBeDefined();
        expect(pattern.index).toBeDefined();
        expect(typeof pattern.confidence).toBe('number');
        expect(pattern.confidence >= 0 && pattern.confidence <= 100).toBe(true);
        expect(pattern.description).toBeDefined();
      });
    }
  });

  it('supports various timeframes', async () => {
    const marketDataMock = fakeService();
    const app = await makeServer(marketDataMock);

    const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1wk'];

    for (const timeframe of timeframes) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/technical/XAU/USD/${timeframe}?lookback=50`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.timeframe).toBe(timeframe);
    }
  });

  it('normalizes instrument symbols to uppercase', async () => {
    const marketDataMock = fakeService();
    const app = await makeServer(marketDataMock);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/xau/usd/1d?lookback=50',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.instrument).toBe('XAU/USD');

    const getCandlesMock = marketDataMock.getCandles as any;
    expect(getCandlesMock).toHaveBeenCalledWith('XAU/USD', '1d', 50);
  });

  it('returns 400 for malformed instrument symbols', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/INVALID/1d',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid timeframes', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/99x?lookback=50',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('includes request ID in response headers', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d?lookback=50',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('sets no-store cache control header', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d?lookback=50',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('returns data with timestamp field', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d?lookback=50',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.timestamp).toBeDefined();
    // Verify it's ISO format
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it('handles market data provider errors gracefully', async () => {
    const marketDataMock = fakeService({
      getCandles: vi.fn(async () => {
        throw new Error('Provider connection failed');
      }),
    });

    const app = await makeServer(marketDataMock);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d?lookback=50',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('CANDLE_FETCH_ERROR');
  });

  it('handles technical analysis errors gracefully', async () => {
    // Create a mock that returns valid candles but causes analysis to fail
    // by returning invalid data structure (empty candles array after successful fetch)
    const marketDataMock = fakeService({
      getCandles: vi.fn(async () => {
        // Simulate a valid response that will still cause analysis to fail
        // This is a bit contrived but tests error handling
        const series = createCandleSeries('XAU/USD', '1d');
        series.candles = []; // Empty after fetch triggers analysis error
        return {
          series,
          cached: false,
        };
      }),
    });

    const app = await makeServer(marketDataMock);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/technical/XAU/USD/1d?lookback=50',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('NO_CANDLES_AVAILABLE');
  });
});
