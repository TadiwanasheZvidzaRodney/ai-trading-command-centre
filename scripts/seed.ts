import { loadEnv, riskConfigFromEnv } from '@atc/config';
import { INSTRUMENT_LIST } from '@atc/shared';
import { MongoClient } from 'mongodb';
import { ensureIndexes } from '../apps/api/src/db/indexes.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 5_000 });

  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB);
    await ensureIndexes(db);

    const now = new Date();
    await db.collection('instruments').bulkWrite(
      INSTRUMENT_LIST.map((instrument) => ({
        updateOne: {
          filter: { symbol: instrument.symbol },
          update: { $set: { ...instrument, updatedAt: now } },
          upsert: true,
        },
      })),
    );

    await db.collection('settings').updateOne(
      { key: 'risk' },
      {
        $setOnInsert: {
          key: 'risk',
          value: riskConfigFromEnv(env),
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );

    await db.collection('settings').updateOne(
      { key: 'preferences' },
      {
        $setOnInsert: {
          key: 'preferences',
          value: { timezone: env.DEFAULT_TIMEZONE },
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );

    console.log(
      `Seeded ${INSTRUMENT_LIST.length} instruments and default settings in ${env.MONGODB_DB}.`,
    );
  } finally {
    await client.close();
  }
}

void main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
