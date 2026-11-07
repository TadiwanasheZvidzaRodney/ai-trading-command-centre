import type { MarketDataService } from '@atc/market-data';
import type { Candle } from '@atc/shared';
import { createEnv } from '@atc/config';
import type { Db } from 'mongodb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../server.js';

type Doc = Record<string, unknown>;
const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

const baseEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  AUTH_MODE: 'disabled',
  LIVE_TRADING_ENABLED: 'false',
  ENABLE_SCHEDULER: 'false',
};

class FakeCollection {
  readonly docs: Doc[] = [];

  async findOne(filter: Doc = {}): Promise<Doc | null> {
    return this.docs.find((doc) => Object.entries(filter).every(([key, value]) => doc[key] === value)) ?? null;
  }

  find(filter: Doc = {}) {
    const results = this.docs.filter((doc) =>
      Object.entries(filter).every(([key, value]) => doc[key] === value),
    );
    let sortSpec: Record<string, 1 | -1> = {};
    let limitCount = Number.POSITIVE_INFINITY;
    const cursor = {
      sort(spec: Record<string, 1 | -1>) {
        sortSpec = spec;
        return cursor;
      },
      limit(count: number) {
        limitCount = count;
        return cursor;
      },
      async toArray(): Promise<Doc[]> {
        const ordered = [...results].sort((a, b) => {
          for (const [key, direction] of Object.entries(sortSpec)) {
            const left = String(a[key]);
            const right = String(b[key]);
            if (left === right) continue;
            return (left < right ? -1 : 1) * (direction === -1 ? -1 : 1);
          }
          return 0;
        });
        return ordered.slice(0, limitCount).map((doc) => ({ ...doc }));
      },
    };
    return cursor;
  }

  async insertOne(doc: Doc): Promise<{ acknowledged: true; insertedId: string }> {
    this.docs.push({ ...doc });
    return { acknowledged: true, insertedId: String(doc.runId ?? doc.id ?? 'id') };
  }
}

function fakeDatabase(): { db: Db; collection(name: string): FakeCollection } {
  const collections = new Map<string, FakeCollection>();
  const get = (name: string): FakeCollection => {
    let collection = collections.get(name);
    if (!collection) {
      collection = new FakeCollection();
      collections.set(name, collection);
    }
    return collection;
  };
  return {
    db: { collection: get } as unknown as Db,
    collection: get,
  };
}

function candles(count = 140): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 2000 + index * 0.5 + Math.sin(index / 5) * 12;
    return {
      time: START + index * DAY,
      open: close - 1,
      high: close + 4,
      low: close - 4,
      close,
      volume: null,
    };
  });
}

function fakeMarketData(series: Candle[] = candles()): MarketDataService {
  return {
    getCandles: vi.fn(async () => ({
      series: {
        instrument: 'XAU/USD',
        timeframe: '1d',
        provider: {
          id: 'fake',
          displayName: 'Fake candles',
          quality: 'reference',
        },
        candles: series,
        fetchedAt: new Date().toISOString(),
        from: new Date(series[0]?.time ?? START).toISOString(),
        to: new Date(series[series.length - 1]?.time ?? START).toISOString(),
        quality: 'reference',
        proxy: false,
        duplicatesRemoved: 0,
        gaps: [],
        notes: [],
      },
      cached: false,
    })),
    getQuotes: vi.fn(async () => ({ quotes: [], errors: [], fetchedAt: new Date().toISOString() })),
  } as unknown as MarketDataService;
}

const servers: Array<{ close: () => Promise<void> }> = [];

async function makeServer(marketData = fakeMarketData()) {
  const database = fakeDatabase();
  const app = await buildServer({
    env: createEnv(baseEnv),
    db: { db: database.db, ping: async () => true },
    logger: false,
    marketData,
  });
  servers.push(app);
  return { app, database };
}

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }
});

const request = {
  instrument: 'XAU/USD',
  timeframe: '1d',
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-04-01T00:00:00.000Z',
  strategyId: 'ema-trend',
  initialEquity: 10_000,
  riskPerTradePct: 1,
  spreadPips: 2,
  commissionPerLot: 7,
  slippagePips: 0.2,
  maxHoldBars: 20,
};

describe('backtest API', () => {
  it('lists the built-in strategies', async () => {
    const { app } = await makeServer();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/backtests/strategies',
    });

    expect(response.statusCode).toBe(200);
    const ids = response.json().data.strategies.map((strategy: { id: string }) => strategy.id);
    expect(ids).toEqual(['ema-trend', 'rsi-reversion', 'breakout-20']);
  });

  it('runs a backtest, persists it, and makes it retrievable', async () => {
    const { app, database } = await makeServer();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/backtests',
      payload: request,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json().data;
    expect(body.runId).toMatch(/^run_/);
    expect(body.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.strategy.id).toBe('ema-trend');
    expect(body.candleCount).toBe(91);
    expect(body.split.development.from).toBe('2026-01-01T00:00:00.000Z');
    expect(body.verdict).toBe('insufficient-evidence');
    expect(database.collection('backtest_runs').docs).toHaveLength(1);

    const fetched = await app.inject({
      method: 'GET',
      url: `/api/v1/backtests/${body.runId}`,
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().data.inputHash).toBe(body.inputHash);

    const list = await app.inject({ method: 'GET', url: '/api/v1/backtests' });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.runs).toHaveLength(1);
    expect(list.json().data.runs[0].runId).toBe(body.runId);
  });

  it('produces the same input hash for the same stored configuration', async () => {
    const { app } = await makeServer();
    const first = await app.inject({ method: 'POST', url: '/api/v1/backtests', payload: request });
    const second = await app.inject({ method: 'POST', url: '/api/v1/backtests', payload: request });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().data.inputHash).toBe(first.json().data.inputHash);
    expect(second.json().data.id).toBe(first.json().data.id);
    expect(second.json().data.runId).not.toBe(first.json().data.runId);
  });

  it('rejects unknown strategies', async () => {
    const { app } = await makeServer();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/backtests',
      payload: { ...request, strategyId: 'not-a-strategy' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('UNKNOWN_STRATEGY');
  });

  it('returns 503 when no candle history is available', async () => {
    const { app } = await makeServer(fakeMarketData([]));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/backtests',
      payload: request,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('NO_CANDLE_DATA');
  });

  it('returns 404 for an unknown stored run', async () => {
    const { app } = await makeServer();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/backtests/run_missing',
    });
    expect(response.statusCode).toBe(404);
  });
});
