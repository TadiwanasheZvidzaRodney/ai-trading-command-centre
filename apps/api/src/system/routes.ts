import type { Env } from '@atc/config';
import type { FastifyInstance } from 'fastify';

const VERSION = '0.1.0';

export async function registerSystemRoutes(
  app: FastifyInstance,
  options: { env: Env },
): Promise<void> {
  const { env } = options;

  app.get('/api/v1/system/info', async () => ({
    name: 'AI Trading Command Centre',
    version: VERSION,
    environment: env.NODE_ENV,
    authMode: env.AUTH_MODE,
    tradingMode: env.TRADING_MODE,
    liveTradingEnabled: false,
    timezone: env.DEFAULT_TIMEZONE,
    schedulerEnabled: env.ENABLE_SCHEDULER,
    providers: {
      quote: env.MARKET_DATA_QUOTE_PROVIDER,
      candle: env.MARKET_DATA_CANDLE_PROVIDER,
      news: env.NEWS_PROVIDER,
      calendar: env.CALENDAR_PROVIDER,
      ai: env.AI_PROVIDER,
    },
  }));
}
