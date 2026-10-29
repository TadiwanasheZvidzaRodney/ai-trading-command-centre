import type { ProviderContext } from './types.js';

export function providerContext(
  fetchImpl: typeof fetch,
  now = new Date('2026-10-27T12:00:30.000Z'),
  overrides: Partial<ProviderContext> = {},
): ProviderContext {
  return {
    fetch: fetchImpl,
    now: () => now,
    timeoutMs: 1000,
    retries: 0,
    userAgent: 'atc-test',
    ...overrides,
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
