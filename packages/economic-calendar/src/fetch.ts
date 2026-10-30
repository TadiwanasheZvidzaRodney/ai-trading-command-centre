export interface FetchJsonOptions {
  fetch: typeof fetch;
  timeoutMs: number;
  retries: number;
  userAgent: string;
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

/** Fetch JSON with a hard timeout and bounded retries. 4xx responses are not retried. */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions,
): Promise<FetchJsonResult<T>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, options.timeoutMs);
    const started = performance.now();

    try {
      const response = await options.fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': options.userAgent,
        },
        signal: controller.signal,
      });
      const latencyMs = Math.round(performance.now() - started);
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`Calendar provider returned HTTP ${response.status}`);
        if (!retryable) throw error;
        lastError = error;
      } else {
        const text = await response.text();
        try {
          return { data: JSON.parse(text) as T, latencyMs };
        } catch {
          throw new Error('Calendar provider returned invalid JSON');
        }
      }
    } catch (error) {
      lastError =
        error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
          ? new Error('Calendar request timed out')
          : error instanceof Error
            ? error
            : new Error('Calendar request failed');
    } finally {
      clearTimeout(timer);
    }

    if (attempt < options.retries) {
      await sleep(retryDelayMs(attempt));
    }
  }

  throw lastError ?? new Error('Calendar request failed');
}
