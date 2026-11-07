import { createEnv } from '@atc/config';
import type { Db } from 'mongodb';
import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseLike } from './db/mongo.js';
import { buildServer } from './server.js';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from './auth/types.js';

const bcryptLikeHash = `$2b$12$${'a'.repeat(53)}`;

const prodEnv = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'production-secret-with-more-than-32-characters-12345',
  AUTH_MODE: 'session',
  AUTH_USERNAME: 'trader',
  AUTH_PASSWORD_HASH: bcryptLikeHash,
  LIVE_TRADING_ENABLED: 'false',
  ENABLE_SCHEDULER: 'false',
  API_URL: 'https://api.example.com',
  WEB_URL: 'https://web.example.com',
};

class MemoryCollection {
  readonly docs: Record<string, unknown>[] = [];
  async findOne(query: Record<string, unknown>) {
    return (
      this.docs.find((d) =>
        Object.entries(query).every(([k, v]) => {
          if (v && typeof v === 'object' && '$gt' in (v as Record<string, unknown>)) {
            const threshold = (v as { $gt: Date }).$gt;
            return (d[k] as Date).getTime() > threshold.getTime();
          }
          return d[k] === v;
        }),
      ) ?? null
    );
  }
  async updateOne(filter: Record<string, unknown>, update: Record<string, unknown>) {
    const doc = await this.findOne(filter);
    if (doc && update.$set) {
      Object.assign(doc, update.$set as Record<string, unknown>);
    }
    return { acknowledged: true, matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0 };
  }
  async insertOne(doc: Record<string, unknown>) {
    this.docs.push({ ...doc });
    return { acknowledged: true, insertedId: '1' };
  }
  async deleteOne(query: Record<string, unknown>) {
    const idx = this.docs.findIndex((d) =>
      Object.entries(query).every(([k, v]) => d[k] === v),
    );
    if (idx >= 0) this.docs.splice(idx, 1);
    return { acknowledged: true, deletedCount: idx >= 0 ? 1 : 0 };
  }
  async deleteMany() {
    const count = this.docs.length;
    this.docs.length = 0;
    return { acknowledged: true, deletedCount: count };
  }
}

function memoryDb(): { db: Db; colls: Map<string, MemoryCollection> } {
  const colls = new Map<string, MemoryCollection>();
  const getColl = (name: string) => {
    let coll = colls.get(name);
    if (!coll) {
      coll = new MemoryCollection();
      colls.set(name, coll);
    }
    return coll;
  };
  return {
    db: { collection: getColl } as unknown as Db,
    colls,
  };
}

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }
});

describe('Phase 9 Production Hardening & Security Controls', () => {
  it('fails startup closed if production runs with auth disabled', () => {
    expect(() =>
      createEnv({
        ...prodEnv,
        AUTH_MODE: 'disabled',
      }),
    ).toThrow(/AUTH_MODE/);
  });

  it('fails startup closed if live trading is enabled', () => {
    expect(() =>
      createEnv({
        ...prodEnv,
        LIVE_TRADING_ENABLED: 'true',
      }),
    ).toThrow(/Live trading/);
  });

  it('fails startup closed if development session secret is used in production', () => {
    expect(() =>
      createEnv({
        ...prodEnv,
        SESSION_SECRET: 'dev-only-change-this-session-secret-32chars',
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('rejects unauthorized access to protected endpoints in session mode', async () => {
    const mem = memoryDb();
    const app = await buildServer({
      env: createEnv(prodEnv),
      db: { db: mem.db, ping: async () => true },
      logger: false,
    });
    servers.push(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/paper-orders',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('enforces CSRF protection on mutating endpoints in session mode', async () => {
    const mem = memoryDb();
    const app = await buildServer({
      env: createEnv(prodEnv),
      db: { db: mem.db, ping: async () => true },
      logger: false,
    });
    servers.push(app);

    // Login with valid credentials to get a session
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'trader', password: 'password123' },
    });
    // Even if password fails bcrypt verification, we test the CSRF middleware directly
    // by creating a valid mock session in DB.
    const { SessionService } = await import('./auth/session.js');
    const sessionService = new SessionService(mem.db, 24);
    const session = await sessionService.create(
      { id: 'user_1', username: 'trader' },
      { ip: '127.0.0.1', userAgent: 'test' },
    );

    // Mutating request WITHOUT CSRF header must fail 403
    const noCsrf = await app.inject({
      method: 'POST',
      url: '/api/v1/risk/kill-switch',
      headers: {
        cookie: `${SESSION_COOKIE}=${session.token}; ${CSRF_COOKIE}=${session.csrfToken}`,
      },
      payload: { enabled: true },
    });
    expect(noCsrf.statusCode).toBe(403);
    expect(noCsrf.json().error.code).toBe('CSRF_INVALID');

    // Mutating request WITH MISMATCHED CSRF token must fail 403
    const badCsrf = await app.inject({
      method: 'POST',
      url: '/api/v1/risk/kill-switch',
      headers: {
        cookie: `${SESSION_COOKIE}=${session.token}; ${CSRF_COOKIE}=${session.csrfToken}`,
        [CSRF_HEADER]: 'mismatched-token',
      },
      payload: { enabled: true },
    });
    expect(badCsrf.statusCode).toBe(403);
    expect(badCsrf.json().error.code).toBe('CSRF_INVALID');

    // Mutating request WITH MATCHING CSRF token must pass auth checks
    const goodCsrf = await app.inject({
      method: 'POST',
      url: '/api/v1/risk/kill-switch',
      headers: {
        cookie: `${SESSION_COOKIE}=${session.token}; ${CSRF_COOKIE}=${session.csrfToken}`,
        [CSRF_HEADER]: session.csrfToken,
      },
      payload: { enabled: true, reason: 'security drill' },
    });
    expect(goodCsrf.statusCode).toBe(200);
    expect(goodCsrf.json().data.enabled).toBe(true);
  });

  it('records audit events for security-sensitive operations', async () => {
    const mem = memoryDb();
    const app = await buildServer({
      env: createEnv(prodEnv),
      db: { db: mem.db, ping: async () => true },
      logger: false,
    });
    servers.push(app);

    // Trigger failed login audit
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'attacker', password: 'wrong' },
    });

    const auditColl = mem.colls.get('audit_logs');
    expect(auditColl).toBeDefined();
    const failedLog = auditColl?.docs.find((d) => d.action === 'auth.login.failure');
    expect(failedLog).toBeDefined();
    expect(failedLog?.actor).toBe('attacker');
  });

  it('includes security headers in all responses', async () => {
    const mem = memoryDb();
    const app = await buildServer({
      env: createEnv(prodEnv),
      db: { db: mem.db, ping: async () => true },
      logger: false,
    });
    servers.push(app);

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toContain('max-age');
  });
});
