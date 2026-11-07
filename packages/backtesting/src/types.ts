import type {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  Candle,
  OrderSide,
  PerformanceMetrics,
} from '@atc/shared';

export interface StrategySignal {
  side: OrderSide;
  /** Reference price the rule was evaluated at (the signal bar close). */
  referencePrice: number;
  stop: number;
  target: number;
  reason: string;
}

/**
 * Causal indicator snapshot for a single bar. Every value is derived from
 * candles at or before `index`; nothing here may look forward.
 */
export interface StrategyContext {
  candles: readonly Candle[];
  index: number;
  ema9: number | null;
  ema21: number | null;
  ema9Prev: number | null;
  ema21Prev: number | null;
  rsi14: number | null;
  atr14: number | null;
  /** Highest high of the `period` bars strictly before `index`. */
  highestHigh20: number | null;
  /** Lowest low of the `period` bars strictly before `index`. */
  lowestLow20: number | null;
}

export interface BacktestStrategy {
  id: string;
  name: string;
  description: string;
  /** Number of bars required before the strategy can emit a signal. */
  warmupBars: number;
  evaluate(context: StrategyContext): StrategySignal | null;
}

export type BacktestSplitName = 'development' | 'validation' | 'outOfSample';

export type BacktestVerdict =
  | 'insufficient-evidence'
  | 'out-of-sample-profitable'
  | 'out-of-sample-not-profitable';

export interface BacktestSplitMetrics {
  development: PerformanceMetrics;
  validation: PerformanceMetrics;
  outOfSample: PerformanceMetrics;
}

export interface BacktestSplit {
  development: { from: string; to: string };
  validation: { from: string; to: string };
  outOfSample: { from: string; to: string };
}

export interface BacktestRun extends Omit<BacktestResult, 'split'> {
  id: string;
  strategy: { id: string; name: string };
  candleCount: number;
  split: BacktestSplit;
  splitMetrics: BacktestSplitMetrics;
  verdict: BacktestVerdict;
}

export interface RunBacktestInput {
  candles: readonly Candle[];
  config: BacktestConfig;
  strategy: BacktestStrategy;
  /** Injectable clock so tests can produce deterministic metadata. */
  now?: () => Date;
}
