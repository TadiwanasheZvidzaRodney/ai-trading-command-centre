import type { Db } from 'mongodb';

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection('users').createIndex({ username: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('quotes').createIndex({ providerId: 1, instrument: 1 }, { unique: true }),
    db
      .collection('candles')
      .createIndex(
        { providerId: 1, instrument: 1, timeframe: 1, time: 1 },
        { unique: true },
      ),
    db.collection('candles').createIndex({ instrument: 1, timeframe: 1, time: -1 }),
    db.collection('news_items').createIndex({ canonicalUrl: 1 }, { unique: true }),
    db.collection('news_items').createIndex({ publishedAt: -1 }),
    db.collection('calendar_events').createIndex(
      { source: 1, externalId: 1 },
      { unique: true },
    ),
    db.collection('calendar_events').createIndex({ scheduledAt: 1 }),
    db.collection('analyses').createIndex({ instrument: 1, createdAt: -1 }),
    db.collection('setups').createIndex({ instrument: 1, status: 1 }),
    db.collection('paper_orders').createIndex({ idempotencyKey: 1 }, { unique: true }),
    db.collection('paper_orders').createIndex({ status: 1, instrument: 1 }),
    db.collection('paper_orders').createIndex({ createdAt: -1 }),
    db.collection('paper_positions').createIndex({ status: 1, instrument: 1 }),
    db.collection('paper_positions').createIndex({ openedAt: -1 }),
    db.collection('paper_trades').createIndex({ closedAt: -1 }),
    db.collection('paper_trades').createIndex({ instrument: 1, closedAt: -1 }),
    db.collection('journal_entries').createIndex({ closedAt: -1 }),
    db.collection('tasks').createIndex({ status: 1, dueAt: 1 }),
    db.collection('audit_logs').createIndex({ createdAt: -1 }),
    db.collection('provider_health').createIndex({ providerId: 1 }, { unique: true }),
    db.collection('settings').createIndex({ key: 1 }, { unique: true }),
    db.collection('backtest_runs').createIndex({ createdAt: -1 }),
  ]);
}
