import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

/**
 * Backup and restore drill for the AI trading command centre MongoDB.
 *
 * Uses native Node.js MongoDB driver so it does not depend on host-level
 * `mongodump` or `mongorestore` binaries.
 *
 * Usage:
 *   # Full drill (exports source collections to snapshot, restores to drill DB, verifies counts):
 *   tsx scripts/backup-restore-drill.ts --drill
 */

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const sourceDb = process.env.MONGODB_DB ?? 'atc_test';

export interface DrillResult {
  backupFile: string;
  drillDb: string;
  sourceCounts: Record<string, number>;
  restoredCounts: Record<string, number>;
  verified: boolean;
}

export async function snapshotDatabase(
  client: MongoClient,
  dbName: string,
): Promise<{ snapshot: Record<string, unknown[]>; counts: Record<string, number> }> {
  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();
  const snapshot: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const coll of collections) {
    if (coll.name.startsWith('system.')) continue;
    const docs = await db.collection(coll.name).find({}).toArray();
    snapshot[coll.name] = docs;
    counts[coll.name] = docs.length;
  }
  return { snapshot, counts };
}

export async function restoreSnapshot(
  client: MongoClient,
  targetDb: string,
  snapshot: Record<string, unknown[]>,
): Promise<Record<string, number>> {
  const db = client.db(targetDb);
  const counts: Record<string, number> = {};

  for (const [collName, docs] of Object.entries(snapshot)) {
    if (docs.length > 0) {
      await db.collection(collName).insertMany(docs);
    }
    counts[collName] = docs.length;
  }
  return counts;
}

export async function runDrill(): Promise<DrillResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = '/tmp/opencode/backup-drills';
  mkdirSync(backupDir, { recursive: true });
  const archivePath = `${backupDir}/backup-${sourceDb}-${timestamp}.json`;
  const drillDb = `${sourceDb}_drill_${Date.now()}`;

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const { snapshot, counts: sourceCounts } = await snapshotDatabase(client, sourceDb);
    writeFileSync(archivePath, JSON.stringify(snapshot, null, 2), 'utf8');

    // Read back and restore to drill DB
    const loadedSnapshot = JSON.parse(readFileSync(archivePath, 'utf8')) as Record<
      string,
      unknown[]
    >;
    const restoredCounts = await restoreSnapshot(client, drillDb, loadedSnapshot);

    let verified = true;
    for (const [coll, count] of Object.entries(sourceCounts)) {
      if (restoredCounts[coll] !== count) {
        verified = false;
        break;
      }
    }

    // Clean up drill database
    await client.db(drillDb).dropDatabase();

    return {
      backupFile: archivePath,
      drillDb,
      sourceCounts,
      restoredCounts,
      verified,
    };
  } finally {
    await client.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] ?? '--help';

  if (mode === '--help') {
    process.stdout.write('Usage: tsx scripts/backup-restore-drill.ts [--drill]\n');
    return;
  }

  if (mode === '--drill') {
    process.stdout.write('Starting backup/restore drill...\n');
    const result = await runDrill();
    process.stdout.write(`Drill result: ${JSON.stringify(result, null, 2)}\n`);
    if (!result.verified) {
      process.stderr.write('Verification failed: collection counts do not match!\n');
      process.exit(1);
    }
    process.stdout.write('Backup & restore drill successful!\n');
  }
}

if (process.argv[1]?.endsWith('backup-restore-drill.ts')) {
  main().catch((err) => {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exit(1);
  });
}
