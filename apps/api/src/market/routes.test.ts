import { createEnv } from '@atc/config';
import type { CandleSeries, InstrumentSymbol, Quote } from '@atc/shared';
import { MarketDataUnavailableError, type MarketDataService } from '@atc/market-data';
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

const bcryptLikeHash = `$2b$12$${'a'.repeat(53)}`;

const quote: Quote = {
  instrument: 'XAU/USD',
  bid: 4014.494,
  ask: 4015.156,
  mid: 4014.825,
  spread: 0.662,
  provider: {
    id: 'swissquote',
    displayName: 'Swissquote public quotes',
    quality: 'reference',
  },
  observedAt: '2026-10-27T12:00:00.000Z',
  fetchedAt: '2026-10-27T12:00:01.000Z',
  ageSeconds: 1,
  stale: false,
  quality: 'reference',
  proxy: false,
};

const series: CandleSeries = {
  instrument: 'XAU/USD',
  timeframe: '1d',
  provider: {
    id: 'yahoo',
    displayName: 'Yahoo Finance chart (reference)',
    quality: 'reference',
  },
  candles: [
    {
      time: Date.UTC(2026, 9, 26),
      open: 4000,
      high: 4020,
      low: 3990,
      close: 4010,
      volume: 100,
    },
  ],
  fetchedAt: '2026-10-27T12:00:01.000Z',
  from: '2026-10-26T00:00:00.000Z',
  to: '2026-10-26T00:00:00.000Z',
  quality: 'proxy',
  proxy: true,
  proxyFor: 'XAU/USD',
  duplicatesRemoved: 0,
  gaps: [],
  notes: ['COMEX gold futures (GC=F) proxy. Not spot XAU/USD.'],
};

function stubDb(): DatabaseLike {
  return {
    db: null as Db | null,
    ping: async () => true,
  };
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
    getQuotes: vi.fn(async (instruments: InstrumentSymbol[]) => ({
      quotes: instruments.map((instrument) => ({ ...quote, instrument, cached: false })),
      errors: [],
      fetchedAt: '2026-10-27T12:00:01.000Z',
    })),
    getQuote: vi.fn(async () => ({ ...quote, cached: false })),
    getCandles: vi.fn(async () => ({ series, cached: false })),
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

describe('market data API', () => {
  it('lists instruments with the gold proxy explicitly labelled', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({ method: 'GET', url: '/api/v1/instruments' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.instruments).toHaveLength(3);
    expect(
      body.instruments.find((item: { symbol: string }) => item.symbol === 'XAU/USD'),
    ).toMatchObject({ candleProxySymbol: 'GC=F' });
    expect(body.providers.quote.id).toBe('swissquote');
    expect(body.providers.candle.id).toBe('yahoo');
  });

  it('returns quotes with provider, timestamp, age and cache state', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market/quotes?symbols=XAU/USD,EUR/USD',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.quotes).toHaveLength(2);
    expect(body.quotes[0]).toMatchObject({
      instrument: 'XAU/USD',
      provider: { id: 'swissquote' },
      observedAt: '2026-10-27T12:00:00.000Z',
      ageSeconds: 1,
      quality: 'reference',
      cached: false,
    });
  });

  it('rejects unsupported instruments', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market/quotes?symbols=AUD/USD',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 503 when every quote fails, without fabricating a price', async () => {
    const app = await makeServer(
      fakeService({
        getQuotes: vi.fn(async () => ({
          quotes: [],
          errors: [
            {
              instrument: 'XAU/USD',
              code: 'PROVIDER_UNAVAILABLE',
              message: 'Provider is down',
            },
          ],
          fetchedAt: '2026-10-27T12:00:01.000Z',
        })),
      }),
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market/quotes',
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('MARKET_DATA_UNAVAILABLE');
  });

  it('maps a provider failure to a structured 503', async () => {
    const app = await makeServer(
      fakeService({
        getQuote: vi.fn(async () => {
          throw new MarketDataUnavailableError('Provider is down', {
            providerId: 'swissquote',
            instrument: 'XAU/USD',
          });
        }),
      }),
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market/quotes/XAU/USD',
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({
      code: 'MARKET_DATA_UNAVAILABLE',
      details: { providerId: 'swissquote' },
    });
  });

  it('returns candle series with proxy metadata', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market/candles/XAU/USD?timeframe=1d&limit=100',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.series).toMatchObject({
      instrument: 'XAU/USD',
      timeframe: '1d',
      proxy: true,
      proxyFor: 'XAU/USD',
      quality: 'proxy',
    });
    expect(body.series.notes.join(' ')).toContain('COMEX');
    expect(body.cached).toBe(false);
  });

  it('validates candle timeframes', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market/candles/XAU/USD?timeframe=2h',
    });
    expect(response.statusCode).toBe(400);
  });

  it('combines live market provider health with other provider categories', async () => {
    const app = await makeServer(fakeService());
    const response = await app.inject({ method: 'GET', url: '/health/providers' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.providers).toHaveLength(5);
    expect(body.providers[0]).toMatchObject({
      providerId: 'swissquote',
      status: 'ok',
    });
    expect(body.providers.map((item: { category: string }) => item.category)).toEqual([
      'market-data',
      'news',
      'calendar',
      'analytics',
      'ai',
    ]);
  });

  it('protects market routes when session auth is enabled', async () => {
    const app = await makeServer(fakeService(), {
      AUTH_MODE: 'session',
      AUTH_USERNAME: 'owner',
      AUTH_PASSWORD_HASH: bcryptLikeHash,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/market/quotes',
    });
    expect(response.statusCode).toBe(401);
  });
});
