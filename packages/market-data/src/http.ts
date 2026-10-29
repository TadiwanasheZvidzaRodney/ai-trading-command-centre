import { MarketDataError, ProviderRequestError, ProviderResponseError } from './errors.js';
import type { ProviderContext } from './types.js';

export interface FetchJsonOptions {
  headers?: Record<string, string>;
}

export interface FetchJsonResult<T> {
  data: T;
  latencyMs: number;
}

function retryDelayMs(attempt: number): number {
  return 250 * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function asProviderError(providerId: string, error: unknown): MarketDataError {
  if (error instanceof MarketDataError) return error;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new ProviderRequestError(
      providerId,
      'PROVIDER_TIMEOUT',
      'Provider request timed out',
      { retryable: true },
      { cause: error },
    );
  }
  return new ProviderRequestError(
    providerId,
    'PROVIDER_UNAVAILABLE',
    error instanceof Error ? error.message : 'Provider request failed',
    { retryable: true },
    { cause: error },
  );
}

/**
 * Fetch JSON with a hard timeout, bounded retries and explicit error codes.
 * 4xx responses are not retried; 429 and 5xx responses are.
 */
export async function fetchJson<T>(
  url: string,
  context: ProviderContext,
  providerId: string,
  options: FetchJsonOptions = {},
): Promise<FetchJsonResult<T>> {
  let lastError: MarketDataError | null = null;

  for (let attempt = 0; attempt <= context.retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, context.timeoutMs);
    const started = performance.now();

    try {
      const response = await context.fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': context.userAgent,
          ...options.headers,
        },
        signal: controller.signal,
      });
      const latencyMs = Math.round(performance.now() - started);

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const body = await response.text().catch(() => '');
        const detail = body.length > 0 ? `: ${body.slice(0, 300)}` : '';
        lastError = new ProviderRequestError(
          providerId,
          'PROVIDER_HTTP_ERROR',
          `Provider returned HTTP ${response.status}${detail}`,
          { status: response.status, retryable },
        );
        if (!retryable) throw lastError;
      } else {
        const text = await response.text();
        let data: T;
        try {
          data = JSON.parse(text) as T;
        } catch (error) {
          throw new ProviderResponseError(
            providerId,
            'Provider returned invalid JSON',
            {},
            { cause: error },
          );
        }
        return { data, latencyMs };
      }
    } catch (error) {
      lastError = asProviderError(providerId, error);
    } finally {
      clearTimeout(timer);
    }

    if (lastError && lastError.retryable && attempt < context.retries) {
      await sleep(retryDelayMs(attempt));
      continue;
    }
    if (lastError) throw lastError;
  }

  throw (
    lastError ??
    new ProviderRequestError(providerId, 'PROVIDER_UNAVAILABLE', 'Provider request failed')
  );
}
