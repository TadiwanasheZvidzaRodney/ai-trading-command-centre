import { describe, expect, it, vi } from 'vitest';
import { fetchJson } from './http.js';
import { jsonResponse, providerContext } from './test-helpers.js';

describe('provider HTTP client', () => {
  it('retries a 500 response and returns the eventual success', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({ message: 'temporary' }, 500) : jsonResponse({ ok: true });
    });
    const result = await fetchJson(
      'https://example.test/data',
      providerContext(fetchImpl as unknown as typeof fetch, undefined, { retries: 1 }),
      'test',
    );
    expect(result.data).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'bad request' }, 400));
    await expect(
      fetchJson(
        'https://example.test/data',
        providerContext(fetchImpl as unknown as typeof fetch, undefined, { retries: 2 }),
        'test',
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_HTTP_ERROR', retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps an aborted request to a timeout error', async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    await expect(
      fetchJson(
        'https://example.test/data',
        providerContext(fetchImpl as unknown as typeof fetch, undefined, {
          timeoutMs: 10,
          retries: 0,
        }),
        'test',
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
  });

  it('rejects invalid JSON with an explicit response error', async () => {
    const fetchImpl = vi.fn(async () => new Response('not json', { status: 200 }));
    await expect(
      fetchJson(
        'https://example.test/data',
        providerContext(fetchImpl as unknown as typeof fetch),
        'test',
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
  });
});
