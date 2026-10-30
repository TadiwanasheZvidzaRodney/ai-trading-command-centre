import { createEnv } from '@atc/config';
import type { CalendarFeed, NewsFeed } from '@atc/shared';
import type { CalendarService } from '@atc/economic-calendar';
import type { NewsService } from '@atc/news';
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

function stubDb(): DatabaseLike {
  return { db: null as Db | null, ping: async () => true };
}

const newsFeed: NewsFeed = {
  items: [
    {
      id: 'news_1',
      title: 'Fed holds rates steady',
      summary: 'The Federal Reserve kept rates unchanged.',
      url: 'https://example.com/fed',
      source: 'example.com',
      publishedAt: '2026-10-29T12:00:00.000Z',
      fetchedAt: '2026-10-29T12:01:00.000Z',
      currencies: ['USD'],
      instruments: ['XAU/USD', 'EUR/USD', 'GBP/USD'],
      relevance: 60,
      tags: ['fed', 'rates'],
    },
  ],
  provider: {
    id: 'rss',
    displayName: 'Public RSS news',
    quality: 'reference',
    url: 'https://www.fxstreet.com/rss/news',
  },
  sources: [
    {
      id: 'example.com',
      url: 'https://example.com/rss',
      status: 'ok',
      itemCount: 1,
      skippedCount: 0,
      latencyMs: 12,
      error: null,
    },
  ],
  fetchedAt: '2026-10-29T12:01:00.000Z',
  cached: false,
  duplicatesRemoved: 0,
  skippedCount: 0,
  error: null,
  notes: ['Headlines and links only.'],
};

const calendarFeed: CalendarFeed = {
  events: [
    {
      id: 'cal_1',
      externalId: 'external-1',
      title: 'Federal Funds Rate',
      currency: 'USD',
      country: 'USD',
      impact: 'high',
      scheduledAt: '2026-10-28T18:00:00.000Z',
      forecast: '4.00%',
      previous: '4.25%',
      actual: null,
      source: 'forexfactory',
      sourceUrl: 'https://www.forexfactory.com/calendar',
      fetchedAt: '2026-10-29T12:01:00.000Z',
      instruments: ['XAU/USD', 'EUR/USD', 'GBP/USD'],
      note: 'Community mirror.',
    },
  ],
  provider: {
    id: 'forexfactory',
    displayName: 'Forex Factory community calendar',
    quality: 'reference',
    url: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  },
  weekStart: '2026-10-25T00:00:00.000Z',
  weekEnd: '2026-11-01T00:00:00.000Z',
  fetchedAt: '2026-10-29T12:01:00.000Z',
  cached: false,
  skippedCount: 0,
  error: null,
  notes: ['Current week only.'],
};

function fakeNews(overrides: Partial<Record<string, unknown>> = {}): NewsService {
  return {
    getNews: vi.fn(async () => newsFeed),
    getProviderHealth: () => [
      {
        providerId: 'rss',
        displayName: 'Public RSS news',
        category: 'news',
        status: 'ok',
        configured: true,
        quality: 'reference',
        lastSuccessAt: '2026-10-29T12:01:00.000Z',
        lastErrorAt: null,
        lastError: null,
        latencyMs: 12,
        message: 'Feeds fetched.',
      },
    ],
    ...overrides,
  } as unknown as NewsService;
}

function fakeCalendar(overrides: Partial<Record<string, unknown>> = {}): CalendarService {
  return {
    getCalendar: vi.fn(async () => calendarFeed),
    getProviderHealth: () => [
      {
        providerId: 'forexfactory',
        displayName: 'Forex Factory community calendar',
        category: 'calendar',
        status: 'ok',
        configured: true,
        quality: 'reference',
        lastSuccessAt: '2026-10-29T12:01:00.000Z',
        lastErrorAt: null,
        lastError: null,
        latencyMs: 22,
        message: 'Calendar fetched.',
      },
    ],
    ...overrides,
  } as unknown as CalendarService;
}

const servers: Array<{ close: () => Promise<void> }> = [];

async function makeServer(
  news: NewsService = fakeNews(),
  calendar: CalendarService = fakeCalendar(),
  overrides: Record<string, string> = {},
) {
  const app = await buildServer({
    env: createEnv({ ...baseEnv, ...overrides }),
    db: stubDb(),
    logger: false,
    news,
    calendar,
  });
  servers.push(app);
  return app;
}

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }
});

describe('news API', () => {
  it('returns source-linked headlines with provenance and freshness', async () => {
    const app = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/api/v1/news' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      title: 'Fed holds rates steady',
      url: 'https://example.com/fed',
      source: 'example.com',
      publishedAt: '2026-10-29T12:00:00.000Z',
      relevance: 60,
    });
    expect(body.provider).toMatchObject({ id: 'rss', quality: 'reference' });
    expect(body.sources[0]).toMatchObject({ id: 'example.com', status: 'ok' });
    expect(body.timestamp).toBeTruthy();
  });

  it('passes validated filters to the news service', async () => {
    const getNews = vi.fn(async () => newsFeed);
    const app = await makeServer(fakeNews({ getNews }));
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/news?instrument=XAU/USD&limit=10',
    });
    expect(response.statusCode).toBe(200);
    expect(getNews).toHaveBeenCalledWith({ instrument: 'XAU/USD', limit: 10 });
  });

  it('rejects unsupported instruments and limits', async () => {
    const app = await makeServer();
    const badInstrument = await app.inject({
      method: 'GET',
      url: '/api/v1/news?instrument=AUD/USD',
    });
    expect(badInstrument.statusCode).toBe(400);
    expect(badInstrument.json().error.code).toBe('VALIDATION_ERROR');

    const badLimit = await app.inject({ method: 'GET', url: '/api/v1/news?limit=0' });
    expect(badLimit.statusCode).toBe(400);
  });

  it('forces a refresh on POST', async () => {
    const getNews = vi.fn(async () => newsFeed);
    const app = await makeServer(fakeNews({ getNews }));
    const response = await app.inject({ method: 'POST', url: '/api/v1/news/refresh' });
    expect(response.statusCode).toBe(200);
    expect(getNews).toHaveBeenCalledWith({ force: true });
  });

  it('protects news routes when session auth is enabled', async () => {
    const app = await makeServer(fakeNews(), fakeCalendar(), {
      AUTH_MODE: 'session',
      AUTH_USERNAME: 'owner',
      AUTH_PASSWORD_HASH: bcryptLikeHash,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/news' });
    expect(response.statusCode).toBe(401);
  });
});

describe('calendar API', () => {
  it('returns UTC-normalised events with the source week window', async () => {
    const app = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/api/v1/calendar' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.weekStart).toBe('2026-10-25T00:00:00.000Z');
    expect(body.weekEnd).toBe('2026-11-01T00:00:00.000Z');
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      title: 'Federal Funds Rate',
      impact: 'high',
      scheduledAt: '2026-10-28T18:00:00.000Z',
      currency: 'USD',
    });
    expect(body.provider).toMatchObject({ id: 'forexfactory' });
  });

  it('passes validated calendar filters to the service', async () => {
    const getCalendar = vi.fn(async () => calendarFeed);
    const app = await makeServer(fakeNews(), fakeCalendar({ getCalendar }));
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/calendar?impact=high&instrument=EUR/USD&limit=25',
    });
    expect(response.statusCode).toBe(200);
    expect(getCalendar).toHaveBeenCalledWith({
      impact: 'high',
      instrument: 'EUR/USD',
      limit: 25,
    });
  });

  it('rejects invalid impact filters and timestamps', async () => {
    const app = await makeServer();
    const badImpact = await app.inject({
      method: 'GET',
      url: '/api/v1/calendar?impact=critical',
    });
    expect(badImpact.statusCode).toBe(400);
    expect(badImpact.json().error.code).toBe('VALIDATION_ERROR');

    const badDate = await app.inject({
      method: 'GET',
      url: '/api/v1/calendar?from=not-a-date',
    });
    expect(badDate.statusCode).toBe(400);
  });

  it('forces a refresh on POST', async () => {
    const getCalendar = vi.fn(async () => calendarFeed);
    const app = await makeServer(fakeNews(), fakeCalendar({ getCalendar }));
    const response = await app.inject({ method: 'POST', url: '/api/v1/calendar/refresh' });
    expect(response.statusCode).toBe(200);
    expect(getCalendar).toHaveBeenCalledWith({ force: true });
  });

  it('protects calendar routes when session auth is enabled', async () => {
    const app = await makeServer(fakeNews(), fakeCalendar(), {
      AUTH_MODE: 'session',
      AUTH_USERNAME: 'owner',
      AUTH_PASSWORD_HASH: bcryptLikeHash,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/calendar' });
    expect(response.statusCode).toBe(401);
  });

  it('reports live news and calendar health alongside market and AI providers', async () => {
    const app = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/health/providers' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const news = body.providers.find(
      (provider: { category: string }) => provider.category === 'news',
    );
    const calendar = body.providers.find(
      (provider: { category: string }) => provider.category === 'calendar',
    );
    expect(news).toMatchObject({ providerId: 'rss', status: 'ok' });
    expect(calendar).toMatchObject({ providerId: 'forexfactory', status: 'ok' });
  });
});
