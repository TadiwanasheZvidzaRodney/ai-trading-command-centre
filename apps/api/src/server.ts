import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Env } from '@atc/config';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { registerAuth } from './auth/plugin.js';
import { registerAuthRoutes } from './auth/routes.js';
import type { DatabaseLike } from './db/mongo.js';
import { AppError, zodDetails } from './errors.js';
import { registerHealthRoutes } from './health/routes.js';
import { loggerOptions } from './logger.js';
import { registerSystemRoutes } from './system/routes.js';

const VERSION = '0.1.0';

export interface BuildServerOptions {
  env: Env;
  db: DatabaseLike;
  logger?: FastifyServerOptions['logger'];
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const { env, db } = options;

  const app = Fastify({
    logger: options.logger !== undefined ? options.logger : loggerOptions(env),
    genReqId: (request) =>
      typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : randomUUID(),
    requestIdHeader: 'x-request-id',
    trustProxy: env.NODE_ENV === 'production',
    bodyLimit: 1_048_576,
  });

  await app.register(cookie, { secret: env.SESSION_SECRET });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  await app.register(cors, {
    origin: env.WEB_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    allowList: (request) =>
      request.url.startsWith('/health') || request.url.startsWith('/docs'),
  });

  if (env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'AI Trading Command Centre API',
          version: VERSION,
          description:
            'Personal trading research API. Research and paper trading only; live execution is not implemented.',
        },
        servers: [{ url: env.API_URL }],
        components: {
          securitySchemes: {
            cookieAuth: { type: 'apiKey', in: 'cookie', name: 'atc_session' },
          },
        },
      },
    });
  }

  await registerAuth(app, { env, db });
  await registerHealthRoutes(app, { env, db });
  await registerAuthRoutes(app, { env, db });
  await registerSystemRoutes(app, { env });

  app.get('/', async () => ({
    name: 'AI Trading Command Centre API',
    version: VERSION,
    status: 'ok',
    health: '/health',
    docs: env.NODE_ENV !== 'production' ? '/docs' : null,
    liveTradingEnabled: false,
  }));

  if (env.NODE_ENV !== 'production') {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: zodDetails(error),
          requestId: request.id,
        },
      });
      return;
    }

    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 429) {
      reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
          requestId: request.id,
        },
      });
      return;
    }

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      reply.code(statusCode).send({
        error: {
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Bad request',
          requestId: request.id,
        },
      });
      return;
    }

    request.log.error({ err: error }, 'Unhandled request error');
    reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: request.id,
      },
    });
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  return app;
}
