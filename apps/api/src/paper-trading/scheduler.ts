import type { PaperTradingService } from './service.js';
import type { PaperTradingLogger } from './service.js';

export interface PaperSchedulerOptions {
  service: PaperTradingService;
  intervalSeconds: number;
  logger?: PaperTradingLogger;
}

/**
 * Periodically mark open paper positions to market and close any that have hit
 * their stop or target. The interval is intentionally simple: this is a
 * single-user research workspace, not a broker daemon, and the scheduler stops
 * with the API process.
 */
export function startPaperTradingScheduler(options: PaperSchedulerOptions): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void options.service
      .evaluateTriggers()
      .then((result) => {
        if (result.closed.length > 0) {
          options.logger?.info?.(
            { closed: result.closed.length, positions: result.closed },
            'Paper positions auto-closed on stop/target',
          );
        }
      })
      .catch((error) => {
        options.logger?.error?.({ err: error }, 'Paper trading evaluation failed');
      })
      .finally(() => {
        running = false;
      });
  }, Math.max(10, options.intervalSeconds) * 1000);

  timer.unref?.();
  return () => clearInterval(timer);
}
