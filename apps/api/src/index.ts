import { loadEnv } from '@atc/config';
import { seedAuthUser } from './auth/service.js';
import { ensureIndexes } from './db/indexes.js';
import { MongoConnection } from './db/mongo.js';
import { createLogger } from './logger.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const port = env.PORT ?? env.API_PORT;

  const mongo = new MongoConnection(env.MONGODB_URI, env.MONGODB_DB);

  try {
    await mongo.connect();
    await ensureIndexes(mongo.db);
    await seedAuthUser(env, mongo.db);
    logger.info(
      { database: env.MONGODB_DB, host: new URL(env.MONGODB_URI).host },
      'Database connected',
    );
  } catch (error) {
    logger.error(
      { err: error },
      'Database initialisation failed. Is MongoDB running? Try: npm run db:up',
    );
    process.exitCode = 1;
    return;
  }

  const app = await buildServer({ env, db: mongo });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    try {
      await app.close();
      await mongo.close();
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
    }
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    await app.listen({ host: env.API_HOST, port });
    logger.info(
      {
        port,
        authMode: env.AUTH_MODE,
        tradingMode: env.TRADING_MODE,
        scheduler: env.ENABLE_SCHEDULER,
      },
      'API listening',
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to start API');
    await mongo.close();
    process.exit(1);
  }
}

void main();
