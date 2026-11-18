import type { CreateIndexesOptions, Db, IndexDirection, IndexSpecification } from 'mongodb';

const INDEX_CONFLICT_CODES = new Set([85, 86]); // IndexOptionsConflict, IndexKeySpecsConflict

function isIndexConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    INDEX_CONFLICT_CODES.has((error as { code?: number }).code ?? -1)
  );
}

/**
 * Create an index, repairing indexes left behind by older releases.
 *
 * MongoDB refuses to create an index when one with the same name (or key
 * pattern) already exists with different options, e.g. an early unique index
 * on `idempotencyKey` that predates the partial filter. In that case the stale
 * index is dropped and recreated with the current specification so startup can
 * complete instead of failing permanently.
 */
async function ensureIndex(
  db: Db,
  collection: string,
  keys: IndexSpecification,
  options: CreateIndexesOptions = {},
): Promise<void> {
  const coll = db.collection(collection);
  try {
    await coll.createIndex(keys, options);
    return;
  } catch (error) {
    if (!isIndexConflict(error)) throw error;
  }

  const existing = await coll.indexes();
  const desired = Object.entries(keys as Record<string, IndexDirection>);
  const conflicting = existing.find((index) => {
    const current = Object.entries(index.key as Record<string, IndexDirection>);
    return (
      current.length === desired.length &&
      desired.every(([field, direction]) => index.key[field] === direction)
    );
  });

  if (!conflicting) throw new Error(`Unable to resolve index conflict on ${collection}`);

  await coll.dropIndex(conflicting.name as string);
  await coll.createIndex(keys, options);
}

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    ensureIndex(db, 'users', { username: 1 }, { unique: true }),
    ensureIndex(db, 'sessions', { tokenHash: 1 }, { unique: true }),
    ensureIndex(db, 'sessions', { expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ensureIndex(db, 'quotes', { providerId: 1, instrument: 1 }, { unique: true }),
    ensureIndex(
      db,
      'candles',
      { providerId: 1, instrument: 1, timeframe: 1, time: 1 },
      { unique: true },
    ),
    ensureIndex(db, 'candles', { instrument: 1, timeframe: 1, time: -1 }),
    ensureIndex(db, 'news_items', { canonicalUrl: 1 }, { unique: true }),
    ensureIndex(db, 'news_items', { publishedAt: -1 }),
    ensureIndex(db, 'calendar_events', { source: 1, externalId: 1 }, { unique: true }),
    ensureIndex(db, 'calendar_events', { scheduledAt: 1 }),
    ensureIndex(db, 'analyses', { instrument: 1, createdAt: -1 }),
    ensureIndex(db, 'setups', { instrument: 1, status: 1 }),
    ensureIndex(
      db,
      'paper_orders',
      { idempotencyKey: 1 },
      {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      },
    ),
    ensureIndex(db, 'paper_orders', { status: 1, instrument: 1 }),
    ensureIndex(db, 'paper_orders', { createdAt: -1 }),
    ensureIndex(db, 'paper_positions', { status: 1, instrument: 1 }),
    ensureIndex(db, 'paper_positions', { openedAt: -1 }),
    ensureIndex(db, 'paper_trades', { closedAt: -1 }),
    ensureIndex(db, 'paper_trades', { instrument: 1, closedAt: -1 }),
    ensureIndex(db, 'journal_entries', { closedAt: -1 }),
    ensureIndex(db, 'tasks', { status: 1, dueAt: 1 }),
    ensureIndex(db, 'audit_logs', { createdAt: -1 }),
    ensureIndex(db, 'provider_health', { providerId: 1 }, { unique: true }),
    ensureIndex(db, 'settings', { key: 1 }, { unique: true }),
    ensureIndex(db, 'backtest_runs', { createdAt: -1 }),
    ensureIndex(db, 'backtest_runs', { runId: 1 }, { unique: true }),
    ensureIndex(db, 'backtest_runs', { inputHash: 1 }),
  ]);
}
