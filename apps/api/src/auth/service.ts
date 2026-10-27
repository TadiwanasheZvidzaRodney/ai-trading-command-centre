import type { Env } from '@atc/config';
import bcrypt from 'bcryptjs';
import type { Db, ObjectId } from 'mongodb';
import type { AuthUser } from './types.js';

interface UserRecord {
  _id?: ObjectId;
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthService {
  private readonly collection;

  constructor(private readonly db: Db) {
    this.collection = db.collection<UserRecord>('users');
  }

  async seed(username: string, passwordHash: string): Promise<void> {
    const now = new Date();
    await this.collection.updateOne(
      { id: 'owner' },
      {
        $set: { username, passwordHash, updatedAt: now },
        $setOnInsert: { id: 'owner', createdAt: now },
      },
      { upsert: true },
    );
  }

  async verify(username: string, password: string): Promise<AuthUser | null> {
    const user = await this.collection.findOne({ username });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? { id: user.id, username: user.username } : null;
  }
}

export async function seedAuthUser(env: Env, db: Db): Promise<void> {
  if (env.AUTH_MODE !== 'session') return;
  if (!env.AUTH_USERNAME || !env.AUTH_PASSWORD_HASH) return;
  await new AuthService(db).seed(env.AUTH_USERNAME, env.AUTH_PASSWORD_HASH);
}
