import type { Candle } from '@atc/shared';

/**
 * All helpers in this module are causal: the value at index `i` depends only
 * on candles `0..i`. Computing the full series once and reading index `i` is
 * therefore equivalent to computing on a truncated slice, and is not
 * look-ahead.
 */

export function emaSeries(values: readonly number[], period: number): (number | null)[] {
  if (period < 1 || values.length < period) return values.map(() => null);
  const alpha = 2 / (period + 1);
  const result: (number | null)[] = [];
  let previous: number | null = null;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]!;
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const seed = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
      previous = seed;
      result.push(seed);
    } else {
      const next: number = value * alpha + (previous as number) * (1 - alpha);
      previous = next;
      result.push(next);
    }
  }
  return result;
}

export function rsiSeries(candles: readonly Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = candles.map(() => null);
  if (period < 1 || candles.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = candles[i]!.close - candles[i - 1]!.close;
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = rsiValue(avgGain, avgLoss);

  for (let i = period + 1; i < candles.length; i += 1) {
    const change = candles[i]!.close - candles[i - 1]!.close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = rsiValue(avgGain, avgLoss);
  }
  return result;
}

function rsiValue(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function atrSeries(candles: readonly Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = candles.map(() => null);
  if (period < 1 || candles.length < period) return result;

  const trueRanges: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i]!;
    if (i === 0) {
      trueRanges.push(candle.high - candle.low);
    } else {
      const previousClose = candles[i - 1]!.close;
      trueRanges.push(
        Math.max(
          candle.high - candle.low,
          Math.abs(candle.high - previousClose),
          Math.abs(candle.low - previousClose),
        ),
      );
    }
  }

  let sum = 0;
  for (let i = 0; i < period; i += 1) sum += trueRanges[i]!;
  let average = sum / period;
  result[period - 1] = average;

  for (let i = period; i < candles.length; i += 1) {
    average = (average * (period - 1) + trueRanges[i]!) / period;
    result[i] = average;
  }
  return result;
}

export function rollingHighest(
  candles: readonly Candle[],
  index: number,
  period: number,
): number | null {
  if (index - period < 0) return null;
  let highest = Number.NEGATIVE_INFINITY;
  for (let i = index - period; i < index; i += 1) {
    highest = Math.max(highest, candles[i]!.high);
  }
  return highest;
}

export function rollingLowest(
  candles: readonly Candle[],
  index: number,
  period: number,
): number | null {
  if (index - period < 0) return null;
  let lowest = Number.POSITIVE_INFINITY;
  for (let i = index - period; i < index; i += 1) {
    lowest = Math.min(lowest, candles[i]!.low);
  }
  return lowest;
}
