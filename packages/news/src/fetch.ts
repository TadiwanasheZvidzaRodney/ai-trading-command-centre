export interface FetchTextOptions {
  fetch: typeof fetch;
  timeoutMs: number;
  retries: number;
  userAgent: string;
}

export interface FetchTextResult {
  text: string;
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

/** Fetch text with a hard timeout and bounded retries. 4xx responses are not retried. */
export async function fetchText(
  url: string,
  options: FetchTextOptions,
): Promise<FetchTextResult> {
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
          accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
          'user-agent': options.userAgent,
        },
        signal: controller.signal,
      });
      const latencyMs = Math.round(performance.now() - started);
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`Feed returned HTTP ${response.status}`);
        if (!retryable) throw error;
        lastError = error;
      } else {
        return { text: await response.text(), latencyMs };
      }
    } catch (error) {
      lastError =
        error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
          ? new Error('Feed request timed out')
          : error instanceof Error
            ? error
            : new Error('Feed request failed');
    } finally {
      clearTimeout(timer);
    }

    if (attempt < options.retries) {
      await sleep(retryDelayMs(attempt));
    }
  }

  throw lastError ?? new Error('Feed request failed');
}
