import type { Env } from '@atc/config';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { loginSchema } from '@atc/shared';
import { writeAudit } from '../audit/log.js';
import type { DatabaseLike } from '../db/mongo.js';
import { AppError, UnauthorizedError } from '../errors.js';
import { AuthService } from './service.js';
import { generateCsrfToken } from './session.js';
import { CSRF_COOKIE, SESSION_COOKIE } from './types.js';

function sessionCookieOptions(env: Env): CookieSerializeOptions {
  return {
    path: '/',
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: env.SESSION_TTL_HOURS * 60 * 60,
  };
}

function csrfCookieOptions(env: Env): CookieSerializeOptions {
  return {
    path: '/',
    httpOnly: false,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: env.SESSION_TTL_HOURS * 60 * 60,
  };
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: { env: Env; db: DatabaseLike },
): Promise<void> {
  const { env, db } = options;

  app.get('/api/v1/auth/status', async (request, reply) => {
    let csrfToken = request.cookies?.[CSRF_COOKIE];
    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      reply.setCookie(CSRF_COOKIE, csrfToken, csrfCookieOptions(env));
    }
    return {
      mode: env.AUTH_MODE,
      authenticated: Boolean(request.auth),
      user: request.auth?.user ?? null,
      csrfToken,
      warning:
        env.AUTH_MODE === 'disabled'
          ? 'Authentication is disabled. This is a development-only configuration.'
          : null,
    };
  });

  app.post(
    '/api/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);

      if (env.AUTH_MODE === 'disabled') {
        return { ok: true, mode: 'disabled', user: request.auth?.user ?? null };
      }

      if (!db.db || !app.sessionService) {
        throw new AppError(503, 'AUTH_UNAVAILABLE', 'Session store is unavailable');
      }

      const auth = new AuthService(db.db);
      const user = await auth.verify(body.username, body.password);

      if (!user) {
        await writeAudit(db.db, {
          action: 'auth.login.failure',
          actor: body.username,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? '',
          requestId: request.id,
        });
        throw new UnauthorizedError('Invalid username or password');
      }

      const session = await app.sessionService.create(user, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
      });

      reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(env));
      reply.setCookie(CSRF_COOKIE, session.csrfToken, csrfCookieOptions(env));

      await writeAudit(db.db, {
        action: 'auth.login.success',
        actor: user.username,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
        requestId: request.id,
      });

      return {
        ok: true,
        user,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
      };
    },
  );

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token && app.sessionService) {
      await app.sessionService.delete(token);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.clearCookie(CSRF_COOKIE, { path: '/' });
    await writeAudit(db.db, {
      action: 'auth.logout',
      actor: request.auth?.user.username ?? 'anonymous',
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? '',
      requestId: request.id,
    });
    return { ok: true };
  });
}
