import { nowIso, taskCreateSchema, taskUpdateSchema } from '@atc/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, NotFoundError } from '../errors.js';
import type { TaskStore } from './repository.js';

const taskIdSchema = z.string().min(1).max(100);

export async function registerTaskRoutes(
  app: FastifyInstance,
  options: { store: TaskStore },
): Promise<void> {
  const { store } = options;

  app.get('/api/v1/tasks', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    return { tasks: await store.list(), timestamp: nowIso() };
  });

  app.post('/api/v1/tasks', async (request, reply) => {
    const input = taskCreateSchema.parse(request.body);
    const task = await store.create(input);
    reply.code(201);
    return { task, timestamp: nowIso() };
  });

  app.patch('/api/v1/tasks/:id', async (request) => {
    const { id } = z.object({ id: taskIdSchema }).parse(request.params);
    if (
      !request.body ||
      typeof request.body !== 'object' ||
      Array.isArray(request.body) ||
      Object.keys(request.body).length === 0
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'At least one field must be updated');
    }
    const input = taskUpdateSchema.parse(request.body);
    const task = await store.update(id, input);
    if (!task) throw new NotFoundError('Task not found');
    return { task, timestamp: nowIso() };
  });

  app.delete('/api/v1/tasks/:id', async (request, reply) => {
    const { id } = z.object({ id: taskIdSchema }).parse(request.params);
    const removed = await store.remove(id);
    if (!removed) throw new NotFoundError('Task not found');
    reply.code(204);
    return null;
  });
}
