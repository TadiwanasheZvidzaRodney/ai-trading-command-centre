import type { Db } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { ensureIndexes } from './indexes.js';

interface FakeIndex {
  name: string;
  key: Record<string, number>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  expireAfterSeconds?: number;
}

interface FakeIndexOptions {
  name?: string;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  expireAfterSeconds?: number;
}

function autoName(key: Record<string, number>): string {
  return Object.entries(key)
    .map(([field, direction]) => `${field}_${direction}`)
    .join('_');
}

function sameKey(a: Record<string, number>, b: Record<string, number>): boolean {
  const entries = Object.entries(a);
  return entries.length === Object.keys(b).length && entries.every(([f, d]) => b[f] === d);
}

function sameOptions(a: FakeIndex, b: FakeIndex): boolean {
  return (
    Boolean(a.unique) === Boolean(b.unique) &&
    (a.expireAfterSeconds ?? null) === (b.expireAfterSeconds ?? null) &&
    JSON.stringify(a.partialFilterExpression ?? null) ===
      JSON.stringify(b.partialFilterExpression ?? null)
  );
}

/** Minimal in-memory stand-in that reproduces MongoDB index conflict codes. */
function fakeDb(): Db {
  const collections = new Map<string, FakeIndex[]>();
  const indexesFor = (name: string): FakeIndex[] => {
    let list = collections.get(name);
    if (!list) {
      list = [{ name: '_id_', key: { _id: 1 } }];
      collections.set(name, list);
    }
    return list;
  };

  const collection = (collectionName: string) => ({
    async createIndex(key: Record<string, number>, options: FakeIndexOptions = {}) {
      const list = indexesFor(collectionName);
      const desired: FakeIndex = {
        name: options.name ?? autoName(key),
        key,
        unique: options.unique,
        partialFilterExpression: options.partialFilterExpression,
        expireAfterSeconds: options.expireAfterSeconds,
      };

      const byName = list.find((index) => index.name === desired.name);
      if (byName) {
        if (!sameKey(byName.key, key) || !sameOptions(byName, desired)) {
          throw Object.assign(new Error('IndexKeySpecsConflict'), { code: 86 });
        }
        return desired.name;
      }
      if (list.some((index) => sameKey(index.key, key))) {
        throw Object.assign(new Error('IndexOptionsConflict'), { code: 85 });
      }

      list.push(desired);
      return desired.name;
    },
    async dropIndex(name: string) {
      const list = indexesFor(collectionName);
      const at = list.findIndex((index) => index.name === name);
      if (at === -1) throw Object.assign(new Error('IndexNotFound'), { code: 27 });
      list.splice(at, 1);
      return { ok: 1 };
    },
    async indexes() {
      return indexesFor(collectionName).map((index) => ({ ...index }));
    },
  });

  return { collection } as unknown as Db;
}

describe('ensureIndexes', () => {
  it('repairs a legacy unique index that predates the partial filter', async () => {
    const db = fakeDb();
    await db.collection('paper_orders').createIndex({ idempotencyKey: 1 }, { unique: true });

    await expect(ensureIndexes(db)).resolves.toBeUndefined();

    const repaired = (await db.collection('paper_orders').indexes()).find(
      (index) => index.name === 'idempotencyKey_1',
    );
    expect(repaired?.unique).toBe(true);
    expect(repaired?.partialFilterExpression).toEqual({
      idempotencyKey: { $type: 'string' },
    });
  });

  it('is idempotent across repeated startups', async () => {
    const db = fakeDb();
    await ensureIndexes(db);
    await expect(ensureIndexes(db)).resolves.toBeUndefined();

    const indexes = await db.collection('paper_orders').indexes();
    expect(indexes.filter((index) => index.name === 'idempotencyKey_1')).toHaveLength(1);
  });

  it('leaves unrelated indexes in place', async () => {
    const db = fakeDb();
    await ensureIndexes(db);

    const indexes = await db.collection('backtest_runs').indexes();
    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining(['runId_1', 'inputHash_1', 'createdAt_-1']),
    );
  });
});
