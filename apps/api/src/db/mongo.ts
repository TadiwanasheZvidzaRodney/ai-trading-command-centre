import type { Db } from 'mongodb';
import { MongoClient } from 'mongodb';

export interface DatabaseLike {
  readonly db: Db | null;
  ping(): Promise<boolean>;
}

export class MongoConnection implements DatabaseLike {
  private readonly client: MongoClient;
  private readonly dbName: string;
  private connected = false;

  constructor(uri: string, dbName: string) {
    this.client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
      maxPoolSize: 10,
      retryWrites: true,
    });
    this.dbName = dbName;
  }

  get db(): Db {
    if (!this.connected) {
      throw new Error('MongoDB is not connected');
    }
    return this.client.db(this.dbName);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    await this.client.db(this.dbName).command({ ping: 1 });
    this.connected = true;
  }

  async ping(): Promise<boolean> {
    if (!this.connected) return false;
    try {
      await this.client.db(this.dbName).command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}
