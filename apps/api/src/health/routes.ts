import type { Env } from '@atc/config';
import type { CalendarService } from '@atc/economic-calendar';
import type { MarketDataService } from '@atc/market-data';
import type { NewsService } from '@atc/news';
import type { ProviderHealth } from '@atc/shared';
import { nowIso } from '@atc/shared';
import type { FastifyInstance } from 'fastify';
import type { DatabaseLike } from '../db/mongo.js';

const VERSION = '0.1.0';

function aiProviderHealth(env: Env): ProviderHealth[] {
  return [
    {
      providerId: env.AI_PROVIDER,
      displayName:
        env.AI_PROVIDER === 'disabled'
          ? 'AI narrative disabled'
          : env.AI_PROVIDER === 'ollama'
            ? 'Ollama (local)'
            : env.AI_PROVIDER === 'gemini'
              ? 'Google Gemini'
              : 'OpenAI-compatible endpoint',
      category: 'ai',
      status: env.AI_PROVIDER === 'disabled' ? 'not_configured' : 'degraded',
      configured: env.AI_PROVIDER !== 'disabled',
      quality: 'reference',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      latencyMs: null,
      message:
        env.AI_PROVIDER === 'disabled'
          ? 'AI narrative is disabled. Deterministic evidence reports remain available.'
          : 'Configured; model health starts with the AI module.',
    },
  ];
}

function technicalAnalysisProviderHealth(): ProviderHealth[] {
  return [
    {
      providerId: 'technical-analysis',
      displayName: 'Technical Analysis Service',
      category: 'analytics',
      status: 'ok',
      configured: true,
      quality: 'reference',
      lastSuccessAt: nowIso(),
      lastErrorAt: null,
      lastError: null,
      latencyMs: null,
      message: 'Technical analysis service operational',
    },
  ];
}

export async function registerHealthRoutes(
  app: FastifyInstance,
  options: {
    env: Env;
    db: DatabaseLike;
    marketData: MarketDataService;
    news: NewsService;
    calendar: CalendarService;
  },
): Promise<void> {
  const { env, db, marketData, news, calendar } = options;

  app.get('/health/live', async () => ({
    status: 'ok',
    service: 'atc-api',
    version: VERSION,
    timestamp: nowIso(),
  }));

  app.get('/health/ready', async (_request, reply) => {
    const databaseOk = await db.ping();
    if (!databaseOk) reply.code(503);
    return {
      status: databaseOk ? 'ok' : 'degraded',
      service: 'atc-api',
      version: VERSION,
      checks: { database: databaseOk ? 'ok' : 'error' },
      timestamp: nowIso(),
    };
  });

  app.get('/health', async (_request, reply) => {
    const started = performance.now();
    const databaseOk = await db.ping();
    const latencyMs = Math.round((performance.now() - started) * 10) / 10;
    if (!databaseOk) reply.code(503);
    return {
      status: databaseOk ? 'ok' : 'degraded',
      service: 'atc-api',
      version: VERSION,
      timestamp: nowIso(),
      uptimeSeconds: Math.round(process.uptime()),
      tradingMode: env.TRADING_MODE,
      liveTradingEnabled: false,
      authMode: env.AUTH_MODE,
      checks: {
        database: {
          status: databaseOk ? 'ok' : 'error',
          latencyMs,
        },
      },
    };
  });

  app.get('/health/providers', async () => ({
    providers: [
      ...marketData.getProviderHealth(),
      ...news.getProviderHealth(),
      ...calendar.getProviderHealth(),
      ...technicalAnalysisProviderHealth(),
      ...aiProviderHealth(env),
    ],
    timestamp: nowIso(),
  }));
}
