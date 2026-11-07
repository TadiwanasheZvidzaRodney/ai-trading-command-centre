import { createEnv } from '@atc/config';
import type { CalendarService } from '@atc/economic-calendar';
import type { MarketDataService } from '@atc/market-data';
import type { Db } from 'mongodb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../server.js';

type Doc = Record<string, unknown>;

const baseEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  AUTH_MODE: 'disabled',
  LIVE_TRADING_ENABLED: 'false',
  ENABLE_SCHEDULER: 'false',
};

type Filter = Record<string, unknown>;

function matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
      const operator = expected as Record<string, unknown>;
      if ('$type' in operator) return typeof doc[key] === operator.$type;
      if ('$in' in operator) {
        return (operator.$in as unknown[]).includes(doc[key]);
      }
      if ('$ne' in operator) return doc[key] !== operator.$ne;
    }
    return doc[key] === expected;
  });
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function applyUpdate(doc: Doc, update: Doc): void {
  for (const [key, value] of Object.entries(update)) {
    if (key === '$set') {
      Object.assign(doc, value as Doc);
    } else if (key === '$unset') {
      for (const field of Object.keys(value as Doc)) delete doc[field];
    } else {
      doc[key] = value;
    }
  }
}

class FakeCollection {
  readonly docs: Doc[] = [];

  async findOne(filter: Filter = {}): Promise<Doc | null> {
    return this.docs.find((doc) => matches(doc, filter)) ?? null;
  }

  find(filter: Filter = {}) {
    const results = this.docs.filter((doc) => matches(doc, filter));
    let skipCount = 0;
    let limitCount = Number.POSITIVE_INFINITY;
    let sortSpec: Record<string, 1 | -1> = {};

    const cursor = {
      sort(spec: Record<string, 1 | -1>) {
        sortSpec = spec;
        return cursor;
      },
      skip(count: number) {
        skipCount = count;
        return cursor;
      },
      limit(count: number) {
        limitCount = count;
        return cursor;
      },
      async toArray(): Promise<Doc[]> {
        const ordered = [...results].sort((a, b) => {
          for (const [key, direction] of Object.entries(sortSpec)) {
            const comparison = compareValues(a[key], b[key]);
            if (comparison !== 0) return direction === -1 ? -comparison : comparison;
          }
          return 0;
        });
        return ordered.slice(skipCount, skipCount + limitCount).map((doc) => ({ ...doc }));
      },
      async count() {
        return results.length;
      },
    };
    return cursor;
  }

  async countDocuments(filter: Filter = {}): Promise<number> {
    return this.docs.filter((doc) => matches(doc, filter)).length;
  }

  async insertOne(doc: Doc): Promise<{ acknowledged: true; insertedId: string }> {
    this.docs.push({ ...doc });
    return { acknowledged: true, insertedId: String(doc.id ?? doc._id ?? 'id') };
  }

  async updateOne(
    filter: Filter,
    update: Doc,
    options: { upsert?: boolean } = {},
  ): Promise<{ acknowledged: true; matchedCount: number; modifiedCount: number }> {
    const doc = this.docs.find((candidate) => matches(candidate, filter));
    if (!doc) {
      if (!options.upsert) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      const inserted: Doc = {};
      for (const [key, value] of Object.entries(filter)) {
        if (typeof value !== 'object') inserted[key] = value;
      }
      applyUpdate(inserted, update);
      this.docs.push(inserted);
      return { acknowledged: true, matchedCount: 0, modifiedCount: 1 };
    }
    applyUpdate(doc, update);
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async findOneAndUpdate(
    filter: Filter,
    update: Doc,
  ): Promise<Doc | null> {
    const doc = this.docs.find((candidate) => matches(candidate, filter));
    if (!doc) return null;
    applyUpdate(doc, update);
    // MongoDB driver v7 returns the document directly for returnDocument: 'after'.
    return { ...doc };
  }

  async deleteMany(filter: Filter = {}): Promise<{ acknowledged: true; deletedCount: number }> {
    const remaining = this.docs.filter((doc) => !matches(doc, filter));
    const deletedCount = this.docs.length - remaining.length;
    this.docs.splice(0, this.docs.length, ...remaining);
    return { acknowledged: true, deletedCount };
  }
}

interface FakeDatabase {
  db: Db;
  collection(name: string): FakeCollection;
}

function createFakeDatabase(): FakeDatabase {
  const collections = new Map<string, FakeCollection>();
  return {
    db: {
      collection(name: string) {
        let collection = collections.get(name);
        if (!collection) {
          collection = new FakeCollection();
          collections.set(name, collection);
        }
        return collection;
      },
    } as unknown as Db,
    collection(name: string) {
      let collection = collections.get(name);
      if (!collection) {
        collection = new FakeCollection();
        collections.set(name, collection);
      }
      return collection;
    },
  };
}

function fakeMarketData(quote?: { bid: number; ask: number } | null): MarketDataService {
  return {
    getQuotes: vi.fn(async (instruments: readonly string[]) => {
      if (quote === null) {
        return { quotes: [], errors: [], fetchedAt: new Date().toISOString() };
      }
      const price = quote ?? { bid: 1.05, ask: 1.0501 };
      return {
        quotes: instruments.map((instrument) => ({
          instrument,
          bid: price.bid,
          ask: price.ask,
          mid: (price.bid + price.ask) / 2,
          spread: price.ask - price.bid,
          observedAt: new Date().toISOString(),
        })),
        errors: [],
        fetchedAt: new Date().toISOString(),
      };
    }),
  } as unknown as MarketDataService;
}

function fakeCalendar(): CalendarService {
  return {
    getCalendar: vi.fn(async () => ({ events: [] })),
  } as unknown as CalendarService;
}

interface Harness {
  app: Awaited<ReturnType<typeof buildServer>>;
  db: FakeDatabase;
  marketData: MarketDataService;
}

const servers: Array<{ close: () => Promise<void> }> = [];

async function makeServer(options: {
  marketData?: MarketDataService;
  env?: Record<string, string>;
} = {}): Promise<Harness> {
  const db = createFakeDatabase();
  const marketData = options.marketData ?? fakeMarketData();
  const app = await buildServer({
    env: createEnv({ ...baseEnv, ...options.env }),
    db: { db: db.db, ping: async () => true },
    logger: false,
    marketData,
    calendar: fakeCalendar(),
  });
  servers.push(app);
  return { app, db, marketData };
}

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }
});

const EUR_ORDER = {
  idempotencyKey: 'test-key-0001',
  instrument: 'EUR/USD',
  side: 'buy',
  type: 'market',
  entryPrice: 1.05,
  stopPrice: 1.04,
  targetPrice: 1.065,
};

describe('paper trading routes', () => {
  it('fills a market order immediately and records costs', async () => {
    const { app } = await makeServer();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: EUR_ORDER,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.duplicate).toBe(false);
    expect(body.data.status).toBe('filled');
    expect(body.data.filledPrice).toBeCloseTo(1.05012, 5);
    expect(body.data.commission).toBeCloseTo(0.7);
    expect(body.data.slippage).toBeCloseTo(0.2);
    expect(body.position).toMatchObject({
      instrument: 'EUR/USD',
      side: 'buy',
      quantity: 10_000,
      status: 'open',
    });
    expect(body.position.id).toBe(body.position.positionId);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns the original order for a duplicate idempotency key', async () => {
    const { app, db } = await makeServer();
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: EUR_ORDER,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: EUR_ORDER,
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().duplicate).toBe(true);
    expect(second.json().data.orderId).toBe(first.json().data.orderId);
    expect(db.collection('paper_orders').docs).toHaveLength(1);
    expect(db.collection('paper_positions').docs).toHaveLength(1);
  });

  it('fails closed when a live quote is unavailable', async () => {
    const { app } = await makeServer({ marketData: fakeMarketData(null) });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, idempotencyKey: 'no-quote-key' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('SPREAD_UNAVAILABLE');
  });

  it('enforces the kill switch server-side', async () => {
    const { app } = await makeServer();
    const enabled = await app.inject({
      method: 'POST',
      url: '/api/v1/risk/kill-switch',
      payload: { enabled: true, reason: 'manual halt' },
    });
    expect(enabled.statusCode).toBe(200);

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, idempotencyKey: 'kill-switch-key' },
    });
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json().error.code).toBe('KILL_SWITCH');
    expect(rejected.json().error.message).toContain('manual halt');

    const limits = await app.inject({ method: 'GET', url: '/api/v1/risk/limits' });
    expect(limits.json().data.killSwitchEnabled).toBe(true);
  });

  it('rejects a plan whose reward-to-risk is below the minimum', async () => {
    const { app } = await makeServer();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/risk/validate-plan',
      payload: {
        instrument: 'EUR/USD',
        side: 'buy',
        entryPrice: 1.05,
        stopPrice: 1.04,
        targetPrice: 1.055,
        quantity: 10_000,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.valid).toBe(false);
    expect(body.data.code).toBe('MIN_REWARD_RISK');
    expect(body.data.checks.some((check: { id: string }) => check.id === 'MIN_REWARD_RISK')).toBe(true);
  });

  it('keeps limit orders pending until they are filled explicitly', async () => {
    const { app, db } = await makeServer();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, type: 'limit', limitPrice: 1.049, idempotencyKey: 'limit-key-1' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.status).toBe('pending');
    expect(db.collection('paper_positions').docs).toHaveLength(0);

    const orderId = created.json().data.orderId;
    const fill = await app.inject({
      method: 'POST',
      url: `/api/v1/paper-orders/${orderId}/fill`,
      payload: { currentBid: 1.049, currentAsk: 1.0491 },
    });
    expect(fill.statusCode).toBe(200);
    expect(fill.json().data.filled).toBe(true);
    expect(db.collection('paper_positions').docs).toHaveLength(1);

    const refill = await app.inject({
      method: 'POST',
      url: `/api/v1/paper-orders/${orderId}/fill`,
      payload: { currentBid: 1.049, currentAsk: 1.0491 },
    });
    expect(refill.statusCode).toBe(409);
    expect(refill.json().error.code).toBe('ALREADY_FILLED');
  });

  it('cancels a pending order and refuses to cancel it twice', async () => {
    const { app } = await makeServer();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, type: 'limit', limitPrice: 1.045, idempotencyKey: 'cancel-key-1' },
    });
    const orderId = created.json().data.orderId;

    const cancelled = await app.inject({
      method: 'DELETE',
      url: `/api/v1/paper-orders/${orderId}`,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().data.cancelled).toBe(true);

    const again = await app.inject({
      method: 'DELETE',
      url: `/api/v1/paper-orders/${orderId}`,
    });
    expect(again.statusCode).toBe(400);
  });

  it('refuses to modify an order that is no longer pending', async () => {
    const { app } = await makeServer();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, idempotencyKey: 'modify-key-1' },
    });
    const orderId = created.json().data.orderId;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/paper-orders/${orderId}`,
      payload: { stopPrice: 1.045 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('closes a position, records a trade, and reconciles the account balance', async () => {
    const { app } = await makeServer();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: EUR_ORDER,
    });
    const positionId = created.json().position.positionId;

    const closed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/paper-positions/${positionId}/close`,
      payload: { closePrice: 1.06, reason: 'manual' },
    });
    expect(closed.statusCode).toBe(200);
    const closedBody = closed.json().data;
    expect(closedBody.closed).toBe(true);
    expect(closedBody.grossPnL).toBeCloseTo(98.8);
    expect(closedBody.costs).toBeCloseTo(1.8);
    expect(closedBody.realizedPnL).toBeCloseTo(97.0);
    expect(closedBody.rMultiple).toBeCloseTo(0.96);

    const trades = await app.inject({ method: 'GET', url: '/api/v1/paper-trades' });
    expect(trades.statusCode).toBe(200);
    expect(trades.json().data.trades).toHaveLength(1);
    expect(trades.json().data.trades[0].id).toBe(closedBody.tradeId);

    const account = await app.inject({ method: 'GET', url: '/api/v1/paper/account' });
    expect(account.json().data.realizedPnL).toBeCloseTo(97.0);
    expect(account.json().data.currentBalance).toBeCloseTo(10_097.0);
    expect(account.json().data.openPositions).toBe(0);
  });

  it('closes a position when the stop is touched during evaluation', async () => {
    const { app, db } = await makeServer();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, idempotencyKey: 'stop-key-1' },
    });
    expect(created.statusCode).toBe(201);

    const evaluated = await app.inject({
      method: 'POST',
      url: '/api/v1/paper/evaluate',
      payload: {
        quotes: [{ instrument: 'EUR/USD', bid: 1.0399, ask: 1.0401 }],
      },
    });
    expect(evaluated.statusCode).toBe(200);
    const body = evaluated.json().data;
    expect(body.evaluated).toBe(1);
    expect(body.closed).toHaveLength(1);
    expect(body.closed[0].reason).toBe('stop');
    expect(body.closed[0].realizedPnL).toBeLessThan(0);
    expect(db.collection('paper_positions').docs[0]!.status).toBe('closed');
  });

  it('marks open positions to market using live quotes', async () => {
    const { app } = await makeServer();
    await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, idempotencyKey: 'mtm-key-1' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/paper-positions' });
    expect(response.statusCode).toBe(200);
    const position = response.json().data.positions[0];
    expect(position.currentPrice).toBeCloseTo(1.05);
    expect(position.unrealizedPnL).toBeCloseTo(-1.2);
  });

  it('exposes risk limits including costs and leverage', async () => {
    const { app } = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/api/v1/risk/limits' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      perTradeRiskPct: 1,
      maxPositions: 3,
      minRR: 1.5,
      maxLeverage: 30,
      commissionPerLot: 7,
      slippagePips: 0.2,
      killSwitchEnabled: false,
    });
    expect(response.headers['cache-control']).toBe('public, max-age=60');
  });

  it('validates position sizing inputs', async () => {
    const { app } = await makeServer();
    const equal = await app.inject({
      method: 'POST',
      url: '/api/v1/risk/position-size',
      payload: {
        instrument: 'EUR/USD',
        accountBalance: 10_000,
        riskPct: 1,
        entryPrice: 1.05,
        stopPrice: 1.05,
        side: 'buy',
      },
    });
    expect(equal.statusCode).toBe(400);

    const wrongSide = await app.inject({
      method: 'POST',
      url: '/api/v1/risk/position-size',
      payload: {
        instrument: 'EUR/USD',
        accountBalance: 10_000,
        riskPct: 1,
        entryPrice: 1.05,
        stopPrice: 1.06,
        side: 'buy',
      },
    });
    expect(wrongSide.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/risk/position-size',
      payload: {
        instrument: 'EUR/USD',
        accountBalance: 10_000,
        riskPct: 1,
        entryPrice: 1.05,
        stopPrice: 1.04,
        side: 'buy',
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.contracts).toBe(0.1);
  });

  it('requires confirmation before resetting the paper account', async () => {
    const { app, db } = await makeServer();
    await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, idempotencyKey: 'reset-key-1' },
    });

    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/paper/reset',
      payload: {},
    });
    expect(missing.statusCode).toBe(400);

    const reset = await app.inject({
      method: 'POST',
      url: '/api/v1/paper/reset',
      payload: { confirm: true },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().data).toEqual({ reset: true, newBalance: 10_000 });
    expect(db.collection('paper_orders').docs).toHaveLength(0);
    expect(db.collection('paper_positions').docs).toHaveLength(0);
    expect(db.collection('paper_trades').docs).toHaveLength(0);
  });

  it('reports analytics that reconcile with recorded trades', async () => {
    const { app } = await makeServer();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/paper-orders',
      payload: { ...EUR_ORDER, idempotencyKey: 'analytics-key-1' },
    });
    const positionId = created.json().position.positionId;
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/paper-positions/${positionId}/close`,
      payload: { closePrice: 1.06, reason: 'manual' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/paper-analytics' });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.closedTrades).toBe(1);
    expect(body.totalTrades).toBe(1);
    expect(body.winRate).toBe(100);
    expect(body.totalRealizedPnL).toBeCloseTo(97.0);
    expect(body.accountBalance).toBeCloseTo(10_097.0);
  });
});
