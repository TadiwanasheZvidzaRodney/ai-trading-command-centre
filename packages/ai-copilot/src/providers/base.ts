import pino from 'pino';
import type { AIProvider, HealthCheckResult } from '../types.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
  },
});

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;
  protected log = logger.child({ component: this.constructor.name });

  abstract available(): Promise<boolean>;
  abstract analyze(prompt: string, temperature: number): Promise<string>;
  abstract healthCheck(): Promise<HealthCheckResult>;

  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 2,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable (transient)
        const isRetryable =
          error instanceof Error &&
          (error.message.includes('429') ||
            error.message.includes('5') ||
            error.message.includes('timeout'));

        if (!isRetryable || attempt === maxAttempts) {
          throw lastError;
        }

        const wait = delayMs * Math.pow(2, attempt - 1);
        this.log.warn({ attempt, waitMs: wait, error: lastError.message }, 'Retrying');
        await this.delay(wait);
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
