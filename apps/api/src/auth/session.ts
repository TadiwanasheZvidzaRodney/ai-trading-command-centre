import { createHash, randomBytes } from 'node:crypto';
import type { Db, ObjectId } from 'mongodb';
import type { AuthContext, AuthUser } from './types.js';

export interface SessionRecord {
  _id?: ObjectId;
  tokenHash: string;
  userId: string;
  username: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  ip: string;
  userAgent: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export class SessionService {
  private readonly collection;

  constructor(
    db: Db,
    private readonly ttlHours: number,
  ) {
    this.collection = db.collection<SessionRecord>('sessions');
  }

  async create(
    user: AuthUser,
    meta: { ip: string; userAgent: string },
  ): Promise<{ token: string; csrfToken: string; expiresAt: string }> {
    const token = generateSessionToken();
    const csrfToken = generateCsrfToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlHours * 60 * 60 * 1000);
    await this.collection.insertOne({
      tokenHash: hashToken(token),
      userId: user.id,
      username: user.username,
      createdAt: now,
      expiresAt,
      lastSeenAt: now,
      ip: meta.ip.slice(0, 100),
      userAgent: meta.userAgent.slice(0, 500),
    });
    return { token, csrfToken, expiresAt: expiresAt.toISOString() };
  }

  async resolve(token: string): Promise<AuthContext | null> {
    const now = new Date();
    const session = await this.collection.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: now },
    });
    if (!session) return null;
    await this.collection.updateOne(
      { _id: session._id },
      { $set: { lastSeenAt: now } },
    );
    return {
      mode: 'session',
      user: { id: session.userId, username: session.username },
    };
  }

  async delete(token: string): Promise<void> {
    await this.collection.deleteOne({ tokenHash: hashToken(token) });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.collection.deleteMany({ userId });
  }
}
