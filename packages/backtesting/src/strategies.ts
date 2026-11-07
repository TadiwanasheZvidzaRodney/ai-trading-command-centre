import type { BacktestStrategy, StrategyContext, StrategySignal } from './types.js';

function stopTarget(
  context: StrategyContext,
  side: 'buy' | 'sell',
  stopMultiple: number,
  targetMultiple: number,
  reason: string,
): StrategySignal | null {
  const referencePrice = context.candles[context.index]!.close;
  const atr = context.atr14;
  if (atr === null || atr <= 0) return null;
  const distance = atr;
  const risk = distance * stopMultiple;
  const reward = distance * targetMultiple;
  if (risk <= 0 || reward <= 0) return null;
  return {
    side,
    referencePrice,
    stop: side === 'buy' ? referencePrice - risk : referencePrice + risk,
    target: side === 'buy' ? referencePrice + reward : referencePrice - reward,
    reason,
  };
}

/**
 * EMA(9)/EMA(21) crossover. A long signal fires on the bar where the fast EMA
 * crosses above the slow EMA; the engine then fills at the next bar open.
 */
export const emaTrendStrategy: BacktestStrategy = {
  id: 'ema-trend',
  name: 'EMA 9/21 trend',
  description:
    'Long when EMA(9) crosses above EMA(21); short when it crosses below. ATR-based stop and target.',
  warmupBars: 21,
  evaluate(context) {
    const { ema9, ema21, ema9Prev, ema21Prev } = context;
    if (ema9 === null || ema21 === null || ema9Prev === null || ema21Prev === null) {
      return null;
    }
    if (ema9Prev <= ema21Prev && ema9 > ema21) {
      return stopTarget(context, 'buy', 2, 3, 'EMA(9) crossed above EMA(21)');
    }
    if (ema9Prev >= ema21Prev && ema9 < ema21) {
      return stopTarget(context, 'sell', 2, 3, 'EMA(9) crossed below EMA(21)');
    }
    return null;
  },
};

/**
 * RSI mean reversion. Buys oversold and sells overbought conditions.
 */
export const rsiReversionStrategy: BacktestStrategy = {
  id: 'rsi-reversion',
  name: 'RSI(14) mean reversion',
  description: 'Buy below RSI 30, sell above RSI 70. ATR-based stop and target.',
  warmupBars: 15,
  evaluate(context) {
    const rsi = context.rsi14;
    if (rsi === null) return null;
    if (rsi < 30) {
      return stopTarget(context, 'buy', 2, 2, `RSI ${rsi.toFixed(1)} is oversold`);
    }
    if (rsi > 70) {
      return stopTarget(context, 'sell', 2, 2, `RSI ${rsi.toFixed(1)} is overbought`);
    }
    return null;
  },
};

/**
 * Donchian-style breakout of the prior 20 bars.
 */
export const breakoutStrategy: BacktestStrategy = {
  id: 'breakout-20',
  name: '20-bar breakout',
  description:
    'Buy a close above the prior 20-bar high, sell a close below the prior 20-bar low. ATR-based stop and target.',
  warmupBars: 21,
  evaluate(context) {
    const price = context.candles[context.index]!.close;
    if (context.highestHigh20 !== null && price > context.highestHigh20) {
      return stopTarget(context, 'buy', 2, 4, 'Close broke the prior 20-bar high');
    }
    if (context.lowestLow20 !== null && price < context.lowestLow20) {
      return stopTarget(context, 'sell', 2, 4, 'Close broke the prior 20-bar low');
    }
    return null;
  },
};

export const BUILT_IN_STRATEGIES: readonly BacktestStrategy[] = [
  emaTrendStrategy,
  rsiReversionStrategy,
  breakoutStrategy,
];

export function getStrategy(id: string): BacktestStrategy | undefined {
  return BUILT_IN_STRATEGIES.find((strategy) => strategy.id === id);
}
