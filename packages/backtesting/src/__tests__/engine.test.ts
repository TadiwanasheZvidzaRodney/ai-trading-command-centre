import type { BacktestConfig, BacktestTrade, Candle } from '@atc/shared';
import { describe, expect, it } from 'vitest';
import { runBacktest } from '../engine.js';
import { emaSeries } from '../indicators.js';
import { computeMetrics } from '../metrics.js';
import type { BacktestStrategy } from '../types.js';

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);

function candle(index: number, values: Partial<Candle> = {}): Candle {
  const close = values.close ?? 100 + index;
  return {
    time: START + index * DAY,
    open: values.open ?? close,
    high: values.high ?? Math.max(values.open ?? close, close) + 1,
    low: values.low ?? Math.min(values.open ?? close, close) - 1,
    close,
    volume: null,
  };
}

function config(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    instrument: 'XAU/USD',
    timeframe: '1d',
    from: new Date(START).toISOString(),
    to: new Date(START + 60 * DAY).toISOString(),
    strategyId: 'test',
    initialEquity: 10_000,
    riskPerTradePct: 1,
    spreadPips: 0,
    commissionPerLot: 0,
    slippagePips: 0,
    maxHoldBars: 1,
    ...overrides,
  };
}

function signalAt(
  signalIndex: number,
  side: 'buy' | 'sell',
  stop: number,
  target: number,
): BacktestStrategy {
  return {
    id: 'test-signal',
    name: 'Test signal',
    description: 'Emits one signal at a fixed index.',
    warmupBars: 1,
    evaluate(context) {
      if (context.index !== signalIndex) return null;
      return {
        side,
        referencePrice: context.candles[context.index]!.close,
        stop,
        target,
        reason: 'test signal',
      };
    },
  };
}

describe('backtesting engine', () => {
  it('enters at the next bar open, never at the signal bar close', () => {
    const candles = [
      candle(0, { open: 100, high: 101, low: 99, close: 100 }),
      candle(1, { open: 100, high: 101, low: 99, close: 100 }),
      candle(2, { open: 100, high: 101, low: 99, close: 100 }),
      candle(3, { open: 150, high: 151, low: 149, close: 150 }),
      candle(4, { open: 150, high: 151, low: 149, close: 150 }),
      candle(5, { open: 150, high: 151, low: 149, close: 150 }),
    ];

    const result = runBacktest({
      candles,
      config: config(),
      strategy: signalAt(2, 'buy', 90, 400),
      now: () => new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]!.entryTime).toBe(candles[3]!.time);
    expect(result.trades[0]!.entryPrice).toBe(150);
    expect(result.trades[0]!.entryPrice).not.toBe(candles[2]!.close);
  });

  it('is reproducible from the same stored configuration and candles', () => {
    const candles = Array.from({ length: 28 }, (_, index) => candle(index));
    const strategy = signalAt(5, 'buy', 80, 200);
    const now = () => new Date('2026-03-01T00:00:00.000Z');

    const first = runBacktest({ candles, config: config(), strategy, now });
    const second = runBacktest({ candles, config: config(), strategy, now });

    expect(second.inputHash).toBe(first.inputHash);
    expect(second.id).toBe(first.id);
    expect(second.trades).toEqual(first.trades);
    expect(second.metrics).toEqual(first.metrics);
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('changes results in the expected direction when costs rise', () => {
    const candles = Array.from({ length: 10 }, (_, index) =>
      candle(index, {
        open: 100 + index * 2,
        high: 101 + index * 2,
        low: 99 + index * 2,
        close: 100 + index * 2,
      }),
    );
    const strategy = signalAt(2, 'buy', 80, 200);

    const free = runBacktest({
      candles,
      config: config({ spreadPips: 0, commissionPerLot: 0, slippagePips: 0 }),
      strategy,
      now: () => new Date('2026-03-01T00:00:00.000Z'),
    });
    const costly = runBacktest({
      candles,
      config: config({ spreadPips: 5, commissionPerLot: 20, slippagePips: 2 }),
      strategy,
      now: () => new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(free.trades).toHaveLength(1);
    expect(costly.trades).toHaveLength(1);
    expect(costly.trades[0]!.costs).toBeGreaterThan(free.trades[0]!.costs);
    expect(costly.metrics.netPnl).toBeLessThan(free.metrics.netPnl);
  });

  it('assumes the stop when a bar touches both stop and target', () => {
    const candles = [
      candle(0, { open: 100, high: 101, low: 99, close: 100 }),
      candle(1, { open: 100, high: 101, low: 99, close: 100 }),
      candle(2, { open: 100, high: 101, low: 99, close: 100 }),
      candle(3, { open: 100, high: 130, low: 70, close: 100 }),
      candle(4, { open: 100, high: 101, low: 99, close: 100 }),
    ];

    const result = runBacktest({
      candles,
      config: config({ maxHoldBars: 10 }),
      strategy: signalAt(2, 'buy', 90, 110),
      now: () => new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]!.exitReason).toBe('stop');
    expect(result.trades[0]!.pnl).toBeLessThan(0);
  });

  it('never looks ahead when computing indicators', () => {
    const candles = Array.from({ length: 50 }, (_, index) =>
      candle(index, { close: 100 + Math.sin(index / 3) * 10 }),
    );
    const full = emaSeries(
      candles.map((item) => item.close),
      9,
    );

    for (const index of [8, 20, 40]) {
      const truncated = emaSeries(
        candles.slice(0, index + 1).map((item) => item.close),
        9,
      );
      expect(truncated[index]).toBeCloseTo(full[index] as number, 10);
    }
  });

  it('splits the period and refuses a profitability claim without out-of-sample evidence', () => {
    const candles = Array.from({ length: 40 }, (_, index) => candle(index, { close: 100 }));
    const result = runBacktest({
      candles,
      config: config({ maxHoldBars: 1 }),
      strategy: signalAt(3, 'buy', 90, 200),
      now: () => new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(result.split.development.to).toBe('2026-02-06T00:00:00.000Z');
    expect(result.split.validation.to).toBe('2026-02-18T00:00:00.000Z');
    expect(result.split.outOfSample.from).toBe('2026-02-18T00:00:00.000Z');
    expect(result.verdict).toBe('insufficient-evidence');
    expect(result.warnings.join(' ')).toContain('Do not claim this strategy is profitable');
  });

  it('rejects periods with too little history instead of fabricating results', () => {
    const candles = [candle(0), candle(1)];
    const result = runBacktest({
      candles,
      config: config(),
      strategy: signalAt(0, 'buy', 90, 200),
      now: () => new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(result.trades).toHaveLength(0);
    expect(result.verdict).toBe('insufficient-evidence');
    expect(result.warnings.join(' ')).toContain('Insufficient candle history');
  });

  it('computes metrics that reconcile with the trade list', () => {
    const trades: BacktestTrade[] = [
      {
        id: 'a',
        side: 'buy',
        entryTime: 1,
        exitTime: 2,
        entryPrice: 100,
        exitPrice: 110,
        quantityLots: 1,
        pnl: 100,
        rMultiple: 1,
        exitReason: 'target',
        costs: 10,
      },
      {
        id: 'b',
        side: 'sell',
        entryTime: 3,
        exitTime: 4,
        entryPrice: 100,
        exitPrice: 105,
        quantityLots: 1,
        pnl: -50,
        rMultiple: -0.5,
        exitReason: 'stop',
        costs: 10,
      },
    ];

    const metrics = computeMetrics(trades, 10_000);
    expect(metrics.trades).toBe(2);
    expect(metrics.wins).toBe(1);
    expect(metrics.losses).toBe(1);
    expect(metrics.winRate).toBe(50);
    expect(metrics.netPnl).toBe(50);
    expect(metrics.grossProfit).toBe(100);
    expect(metrics.grossLoss).toBe(50);
    expect(metrics.profitFactor).toBe(2);
    expect(metrics.expectancy).toBe(25);
    expect(metrics.averageR).toBe(0.25);
    expect(metrics.endingEquity).toBe(10_050);
  });
});
