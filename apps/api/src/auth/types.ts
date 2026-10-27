import type { AuthMode } from './mode.js';

export type { AuthMode };

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthContext {
  mode: AuthMode;
  user: AuthUser;
}

export const SESSION_COOKIE = 'atc_session';
export const CSRF_COOKIE = 'atc_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function isMutatingMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

export function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return (
    path === '/' ||
    path.startsWith('/health') ||
    path.startsWith('/docs') ||
    path === '/api/v1/auth/status' ||
    path === '/api/v1/auth/login'
  );
}
