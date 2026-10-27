import type { Env } from '@atc/config';
import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import type { DatabaseLike } from '../db/mongo.js';
import { SessionService } from './session.js';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  isMutatingMethod,
  isPublicRoute,
} from './types.js';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function registerAuth(
  app: FastifyInstance,
  options: { env: Env; db: DatabaseLike },
): Promise<void> {
  const { env, db } = options;
  const sessionService =
    env.AUTH_MODE === 'session' && db.db
      ? new SessionService(db.db, env.SESSION_TTL_HOURS)
      : null;

  app.decorate('authMode', env.AUTH_MODE);
  app.decorate('sessionService', sessionService);
  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (request) => {
    if (env.AUTH_MODE === 'disabled') {
      request.auth = {
        mode: 'disabled',
        user: { id: 'dev-user', username: 'development' },
      };
      return;
    }

    const token = request.cookies?.[SESSION_COOKIE];
    if (!token || !sessionService) {
      request.auth = null;
      return;
    }
    request.auth = await sessionService.resolve(token);
  });

  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    if (isPublicRoute(request.url)) return;

    if (!request.auth) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.id,
        },
      });
    }

    if (env.AUTH_MODE === 'session' && isMutatingMethod(request.method)) {
      const cookieToken = request.cookies?.[CSRF_COOKIE];
      const headerToken = request.headers[CSRF_HEADER];
      if (
        typeof headerToken !== 'string' ||
        !cookieToken ||
        !safeEqual(cookieToken, headerToken)
      ) {
        return reply.code(403).send({
          error: {
            code: 'CSRF_INVALID',
            message: 'Missing or invalid CSRF token',
            requestId: request.id,
          },
        });
      }
    }
  });
}
