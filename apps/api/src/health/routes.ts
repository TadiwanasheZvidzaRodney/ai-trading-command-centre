import type { Env } from '@atc/config';
import type { ProviderHealth } from '@atc/shared';
import { nowIso } from '@atc/shared';
import type { FastifyInstance } from 'fastify';
import type { DatabaseLike } from '../db/mongo.js';

const VERSION = '0.1.0';

function providerHealth(env: Env): ProviderHealth[] {
  const quoteConfigured =
    env.MARKET_DATA_QUOTE_PROVIDER === 'swissquote' ||
    (env.MARKET_DATA_QUOTE_PROVIDER === 'twelvedata' &&
      Boolean(env.MARKET_DATA_TWELVE_DATA_API_KEY)) ||
    (env.MARKET_DATA_QUOTE_PROVIDER === 'oanda' &&
      Boolean(env.MARKET_DATA_OANDA_API_TOKEN && env.MARKET_DATA_OANDA_ACCOUNT_ID));

  const candleConfigured =
    env.MARKET_DATA_CANDLE_PROVIDER === 'yahoo' ||
    (env.MARKET_DATA_CANDLE_PROVIDER === 'twelvedata' &&
      Boolean(env.MARKET_DATA_TWELVE_DATA_API_KEY)) ||
    (env.MARKET_DATA_CANDLE_PROVIDER === 'oanda' &&
      Boolean(env.MARKET_DATA_OANDA_API_TOKEN && env.MARKET_DATA_OANDA_ACCOUNT_ID));

  return [
    {
      providerId: env.MARKET_DATA_QUOTE_PROVIDER,
      displayName:
        env.MARKET_DATA_QUOTE_PROVIDER === 'swissquote'
          ? 'Swissquote public quotes'
          : env.MARKET_DATA_QUOTE_PROVIDER === 'twelvedata'
            ? 'Twelve Data'
            : 'OANDA practice',
      category: 'market-data',
      status: quoteConfigured ? 'degraded' : 'not_configured',
      configured: quoteConfigured,
      quality: 'reference',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      latencyMs: null,
      message: quoteConfigured
        ? 'Configured; live health sampling starts with the market-data module.'
        : 'Provider credentials are not configured.',
    },
    {
      providerId: env.MARKET_DATA_CANDLE_PROVIDER,
      displayName:
        env.MARKET_DATA_CANDLE_PROVIDER === 'yahoo'
          ? 'Yahoo Finance chart (reference)'
          : env.MARKET_DATA_CANDLE_PROVIDER === 'twelvedata'
            ? 'Twelve Data'
            : 'OANDA practice',
      category: 'market-data',
      status: candleConfigured ? 'degraded' : 'not_configured',
      configured: candleConfigured,
      quality: 'reference',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      latencyMs: null,
      message: candleConfigured
        ? 'Configured; live health sampling starts with the market-data module.'
        : 'Provider credentials are not configured.',
    },
    {
      providerId: env.NEWS_PROVIDER,
      displayName: 'Public RSS news',
      category: 'news',
      status: env.NEWS_RSS_FEEDS.length > 0 ? 'degraded' : 'not_configured',
      configured: env.NEWS_RSS_FEEDS.length > 0,
      quality: 'reference',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      latencyMs: null,
      message:
        env.NEWS_RSS_FEEDS.length > 0
          ? `${env.NEWS_RSS_FEEDS.length} feed(s) configured; ingestion health starts with the news module.`
          : 'No RSS feeds configured.',
    },
    {
      providerId: env.CALENDAR_PROVIDER,
      displayName: 'Forex Factory community calendar',
      category: 'calendar',
      status: 'degraded',
      configured: true,
      quality: 'reference',
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      latencyMs: null,
      message: 'Configured; ingestion health starts with the calendar module.',
    },
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

export async function registerHealthRoutes(
  app: FastifyInstance,
  options: { env: Env; db: DatabaseLike },
): Promise<void> {
  const { env, db } = options;

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
    providers: providerHealth(env),
    timestamp: nowIso(),
  }));
}
