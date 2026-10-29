import { createEnv } from '@atc/config';
import type { Task } from '@atc/shared';
import type { Db } from 'mongodb';
import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../db/mongo.js';
import { buildServer } from '../server.js';
import type { TaskStore } from './repository.js';

const baseEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  AUTH_MODE: 'disabled',
  LIVE_TRADING_ENABLED: 'false',
  ENABLE_SCHEDULER: 'false',
};

const bcryptLikeHash = `$2b$12$${'a'.repeat(53)}`;

function stubDb(): DatabaseLike {
  return { db: null as Db | null, ping: async () => true };
}

function memoryStore(initial: Task[] = []): TaskStore & { items: Task[] } {
  const items = [...initial];
  return {
    items,
    async list() {
      return [...items];
    },
    async create(input) {
      const now = new Date().toISOString();
      const task: Task = {
        id: `tsk_${items.length + 1}`,
        title: input.title,
        notes: input.notes ?? '',
        status: input.status ?? 'todo',
        priority: input.priority ?? 'medium',
        dueAt: input.dueAt ?? null,
        instrument: input.instrument ?? null,
        createdAt: now,
        updatedAt: now,
        completedAt: input.status === 'done' ? now : null,
      };
      items.push(task);
      return task;
    },
    async update(id, input) {
      const index = items.findIndex((task) => task.id === id);
      if (index === -1) return null;
      const existing = items[index]!;
      const status = input.status ?? existing.status;
      const task: Task = {
        ...existing,
        ...input,
        status,
        updatedAt: new Date().toISOString(),
        completedAt: status === 'done' ? existing.completedAt ?? new Date().toISOString() : null,
      };
      items[index] = task;
      return task;
    },
    async remove(id) {
      const index = items.findIndex((task) => task.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      return true;
    },
  };
}

const servers: Array<{ close: () => Promise<void> }> = [];

async function makeServer(store: TaskStore, overrides: Record<string, string> = {}) {
  const app = await buildServer({
    env: createEnv({ ...baseEnv, ...overrides }),
    db: stubDb(),
    logger: false,
    taskStore: store,
  });
  servers.push(app);
  return app;
}

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }
});

describe('task API', () => {
  it('lists tasks', async () => {
    const app = await makeServer(
      memoryStore([
        {
          id: 'tsk_1',
          title: 'Review gold setup',
          notes: '',
          status: 'todo',
          priority: 'high',
          dueAt: null,
          instrument: 'XAU/USD',
          createdAt: '2026-10-29T08:00:00.000Z',
          updatedAt: '2026-10-29T08:00:00.000Z',
          completedAt: null,
        },
      ]),
    );
    const response = await app.inject({ method: 'GET', url: '/api/v1/tasks' });
    expect(response.statusCode).toBe(200);
    expect(response.json().tasks).toHaveLength(1);
    expect(response.json().tasks[0]).toMatchObject({
      title: 'Review gold setup',
      instrument: 'XAU/USD',
    });
  });

  it('creates and updates a task', async () => {
    const app = await makeServer(memoryStore());
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Check EUR/USD news risk',
        priority: 'high',
        instrument: 'EUR/USD',
      },
    });
    expect(created.statusCode).toBe(201);
    const task = created.json().task;
    expect(task).toMatchObject({
      title: 'Check EUR/USD news risk',
      status: 'todo',
      priority: 'high',
      instrument: 'EUR/USD',
    });

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${task.id}`,
      payload: { status: 'done' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().task.status).toBe('done');
    expect(updated.json().task.completedAt).not.toBeNull();
    expect(updated.json().task).toMatchObject({
      notes: '',
      priority: 'high',
      instrument: 'EUR/USD',
    });
  });

  it('rejects invalid task payloads', async () => {
    const app = await makeServer(memoryStore());
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: '' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty update', async () => {
    const app = await makeServer(memoryStore());
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tasks/tsk_1',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for unknown tasks', async () => {
    const app = await makeServer(memoryStore());
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tasks/tsk_missing',
      payload: { status: 'done' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('deletes tasks', async () => {
    const store = memoryStore();
    const app = await makeServer(store);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: 'Temporary task' },
    });
    const id = created.json().task.id;
    const response = await app.inject({ method: 'DELETE', url: `/api/v1/tasks/${id}` });
    expect(response.statusCode).toBe(204);
    expect(store.items).toHaveLength(0);
  });

  it('protects task routes when session auth is enabled', async () => {
    const app = await makeServer(memoryStore(), {
      AUTH_MODE: 'session',
      AUTH_USERNAME: 'owner',
      AUTH_PASSWORD_HASH: bcryptLikeHash,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/tasks' });
    expect(response.statusCode).toBe(401);
  });
});
