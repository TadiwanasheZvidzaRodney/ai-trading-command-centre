import type { AuthContext, AuthMode } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }

  interface FastifyInstance {
    authMode: AuthMode;
    sessionService: import('./auth/session.js').SessionService | null;
  }
}
