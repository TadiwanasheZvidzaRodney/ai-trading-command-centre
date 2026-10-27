import { createEnv } from '@atc/config';
import type { Db } from 'mongodb';
import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseLike } from './db/mongo.js';
import { buildServer } from './server.js';

const baseEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  AUTH_MODE: 'disabled',
  LIVE_TRADING_ENABLED: 'false',
  ENABLE_SCHEDULER: 'false',
};

const bcryptLikeHash = `$2b$12$${'a'.repeat(53)}`;

function stubDb(healthy = true): DatabaseLike {
  return {
    db: null as Db | null,
    ping: async () => healthy,
  };
}

const servers: Array<{ close: () => Promise<void> }> = [];

async function makeServer(overrides: Record<string, string> = {}, healthy = true) {
  const app = await buildServer({
    env: createEnv({ ...baseEnv, ...overrides }),
    db: stubDb(healthy),
    logger: false,
  });
  servers.push(app);
  return app;
}

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }
});

describe('API foundation', () => {
  it('reports healthy with a reachable database', async () => {
    const app = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
    expect(body.liveTradingEnabled).toBe(false);
  });

  it('reports degraded when the database is unreachable', async () => {
    const app = await makeServer({}, false);
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(503);
    expect(response.json().status).toBe('degraded');
  });

  it('exposes provider status without secrets', async () => {
    const app = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/health/providers' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.providers.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('apiKey');
  });

  it('reports development auth mode with a warning', async () => {
    const app = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/status' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.mode).toBe('disabled');
    expect(body.authenticated).toBe(true);
    expect(body.warning).toContain('development-only');
    expect(body.csrfToken).toBeTruthy();
  });

  it('returns a structured 404', async () => {
    const app = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('protects routes when session auth is enabled', async () => {
    const app = await makeServer({
      AUTH_MODE: 'session',
      AUTH_USERNAME: 'owner',
      AUTH_PASSWORD_HASH: bcryptLikeHash,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/system/info' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });
});
