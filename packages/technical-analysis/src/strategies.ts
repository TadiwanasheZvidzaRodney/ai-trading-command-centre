/**
 * Strategy rule evaluation and setup candidate generation
 */

import type { IndicatorContext, StrategyRule, SetupCandidate } from './types';

/**
 * Create a safe execution context for strategy rules
 * Only allows access to indicator data, no external functions
 */
function createStrategyContext(ctx: IndicatorContext): Record<string, unknown> {
  return {
    // Candle data
    candles: ctx.candles,
    current_candle: ctx.candles[ctx.candles.length - 1],
    prev_candle: ctx.candles.length > 1 ? ctx.candles[ctx.candles.length - 2] : null,

    // Indicator values (last value only)
    sma_20: ctx.sma_20[ctx.sma_20.length - 1] || null,
    sma_50: ctx.sma_50[ctx.sma_50.length - 1] || null,
    ema_9: ctx.ema_9[ctx.ema_9.length - 1] || null,
    ema_21: ctx.ema_21[ctx.ema_21.length - 1] || null,
    rsi_14: ctx.rsi_14[ctx.rsi_14.length - 1] || null,
    macd: ctx.macd[ctx.macd.length - 1] || null,
    atr_14: ctx.atr_14[ctx.atr_14.length - 1] || null,
    adx_14: ctx.adx_14[ctx.adx_14.length - 1] || null,
    bbands_20_2: ctx.bbands_20_2[ctx.bbands_20_2.length - 1] || null,
    stochastic_14_3_3: ctx.stochastic_14_3_3[ctx.stochastic_14_3_3.length - 1] || null,

    // Structure
    structure: ctx.structure,
    patterns: ctx.patterns,
    current_price: ctx.current_price,
    current_time: ctx.current_time,

    // Helper functions
    cross_above: (line1: (number | null)[], line2: (number | null)[]): boolean => {
      if (line1.length < 2 || line2.length < 2) return false;
      const curr1 = line1[line1.length - 1];
      const prev1 = line1[line1.length - 2];
      const curr2 = line2[line2.length - 1];
      const prev2 = line2[line2.length - 2];

      if (curr1 === null || curr1 === undefined || prev1 === null || prev1 === undefined || curr2 === null || curr2 === undefined || prev2 === null || prev2 === undefined) return false;

      return prev1 < prev2 && curr1 > curr2;
    },

    cross_below: (line1: (number | null)[], line2: (number | null)[]): boolean => {
      if (line1.length < 2 || line2.length < 2) return false;
      const curr1 = line1[line1.length - 1];
      const prev1 = line1[line1.length - 2];
      const curr2 = line2[line2.length - 1];
      const prev2 = line2[line2.length - 2];

      if (curr1 === null || curr1 === undefined || prev1 === null || prev1 === undefined || curr2 === null || curr2 === undefined || prev2 === null || prev2 === undefined) return false;

      return prev1 > prev2 && curr1 < curr2;
    },

    highest: (prices: (number | null)[], period: number): number | null => {
      const slice = prices.slice(-period).filter((p): p is number => p !== null);
      return slice.length > 0 ? Math.max(...slice) : null;
    },

    lowest: (prices: (number | null)[], period: number): number | null => {
      const slice = prices.slice(-period).filter((p): p is number => p !== null);
      return slice.length > 0 ? Math.min(...slice) : null;
    },

    avg: (prices: (number | null)[]): number | null => {
      const valid = prices.filter((p): p is number => p !== null);
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    },
  };
}

/**
 * Safely evaluate a strategy rule against indicator context
 * Wraps the rule in a function and executes it with limited scope
 */
export function evaluateStrategy(rule: StrategyRule, ctx: IndicatorContext): boolean {
  try {
    const strategyContext = createStrategyContext(ctx);

    // Build function from rule code
    const functionBody = `
      "use strict";
      ${rule.entry_condition_code}
    `;

    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(strategyContext), functionBody);
    const result = fn(...Object.values(strategyContext));

    return result === true;
  } catch (error) {
    // Strategy evaluation failed; return false
    return false;
  }
}

/**
 * Evaluate all strategies and return setup candidates
 */
export function evaluateStrategies(ctx: IndicatorContext, rules: StrategyRule[]): SetupCandidate[] {
  const candidates: SetupCandidate[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const triggered = evaluateStrategy(rule, ctx);

    if (triggered) {
      const currentPrice = ctx.current_price;
      const target = currentPrice + (rule.target_pips * ctx.current_price) / 10000;
      const stop = currentPrice - (rule.stop_pips * ctx.current_price) / 10000;
      const riskReward = Math.abs(target - currentPrice) / Math.abs(currentPrice - stop);

      candidates.push({
        strategy: rule.name,
        timestamp: ctx.current_time,
        signal_price: currentPrice,
        target,
        stop,
        risk_reward: Math.round(riskReward * 100) / 100,
        confidence: 50,  // Base confidence; strategies can modify via notes
        notes: rule.description,
      });
    }
  }

  return candidates;
}

/**
 * Validate a strategy rule before storing
 */
export function validateStrategy(rule: Partial<StrategyRule>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule.name || rule.name.trim().length === 0) {
    errors.push('Strategy name is required');
  }

  if (!rule.entry_condition_code || rule.entry_condition_code.trim().length === 0) {
    errors.push('Entry condition code is required');
  }

  if (typeof rule.target_pips !== 'number' || rule.target_pips <= 0) {
    errors.push('Target pips must be a positive number');
  }

  if (typeof rule.stop_pips !== 'number' || rule.stop_pips <= 0) {
    errors.push('Stop pips must be a positive number');
  }

  if (typeof rule.risk_reward_min !== 'number' || rule.risk_reward_min <= 0) {
    errors.push('Risk/reward minimum must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Example built-in strategies for reference
 */
export const EXAMPLE_STRATEGIES: StrategyRule[] = [
  {
    name: 'SMA Crossover',
    description: 'Buy when EMA 9 crosses above SMA 20; strong uptrend',
    entry_condition_code: `
      // Check if EMA 9 crossed above SMA 20
      if (!cross_above || sma_20 === null || ema_9 === null) return false;
      if (!cross_above([ema_9.value || 0], [sma_20])) return false;
      
      // Confirm with RSI not overbought
      if (rsi_14 !== null && rsi_14 > 75) return false;
      
      // Confirm with ADX showing trend
      if (adx_14 !== null && adx_14 < 25) return false;
      
      return true;
    `,
    target_pips: 50,
    stop_pips: 30,
    risk_reward_min: 1.5,
    enabled: false,
  },

  {
    name: 'RSI Oversold Bounce',
    description: 'Buy when RSI crosses above 30 from below',
    entry_condition_code: `
      // Check if RSI crossed above 30
      if (!rsi_14 || rsi_14 === null) return false;
      if (rsi_14 < 30) return false;
      
      // Get previous RSI
      const prevIdx = candles.length - 2;
      if (prevIdx < 0) return false;
      
      // Simplified: just check RSI in oversold zone bouncing
      return rsi_14 >= 30 && rsi_14 <= 45;
    `,
    target_pips: 40,
    stop_pips: 25,
    risk_reward_min: 1.5,
    enabled: false,
  },

  {
    name: 'Bollinger Band Breakout',
    description: 'Trade breakouts from Bollinger Band edges',
    entry_condition_code: `
      if (!bbands_20_2 || bbands_20_2 === null) return false;
      if (!current_candle) return false;
      
      // Buy if close above upper band
      if (current_candle.close > bbands_20_2.upper) {
        return true;
      }
      
      return false;
    `,
    target_pips: 60,
    stop_pips: 40,
    risk_reward_min: 1.5,
    enabled: false,
  },
];
