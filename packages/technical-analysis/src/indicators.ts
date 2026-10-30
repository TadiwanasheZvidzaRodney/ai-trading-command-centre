/**
 * Technical analysis indicators
 * All functions are pure and stateless; pass full history each time
 */

import type { Candle, SMAValue, EMAValue, RSIValue, MACDValue, ATRValue, ADXValue, BBandsValue, StochasticValue } from './types';

/**
 * Simple Moving Average
 * Arithmetic mean of close prices over N periods
 */
export function sma(candles: Candle[], period: number): SMAValue[] {
  if (period < 1 || candles.length < period) return candles.map(() => null);

  const result: SMAValue[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = candles.slice(i - period + 1, i + 1);
      const sum = slice.reduce((acc, c) => acc + c.close, 0);
      result.push(sum / period);
    }
  }

  return result;
}

/**
 * Exponential Moving Average
 * Weighted average that gives more importance to recent prices
 * Alpha = 2 / (period + 1)
 */
export function ema(candles: Candle[], period: number): (EMAValue | null)[] {
  if (period < 1 || candles.length < period) return candles.map(() => null);

  const alpha = 2 / (period + 1);
  const result: (EMAValue | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // Initialize with SMA of first N candles
      const slice = candles.slice(0, period);
      const sum = slice.reduce((acc, c) => acc + c.close, 0);
      const initialEma = sum / period;
      result.push({ value: initialEma, alpha });
    } else {
      const prevVal = result[i - 1];
      if (prevVal && typeof prevVal === 'object' && 'value' in prevVal) {
        const newEma = candles[i]!.close * alpha + prevVal.value * (1 - alpha);
        result.push({ value: newEma, alpha });
      }
    }
  }

  return result;
}

/**
 * Relative Strength Index (RSI)
 * Momentum oscillator that measures the magnitude of recent price changes (0-100)
 */
export function rsi(candles: Candle[], period: number): RSIValue[] {
  if (period < 1 || candles.length < period + 1) return candles.map(() => null);

  const result: RSIValue[] = [];
  
  // Fill nulls for first period candles (no RSI yet)
  for (let i = 0; i <= period; i++) {
    result.push(null);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = candles[i]!.close - candles[i - 1]!.close;
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Calculate RSI for remaining candles (smoothed)
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i]!.close - candles[i - 1]!.close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiValue = 100 - 100 / (1 + rs);
    result.push(rsiValue);
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * Trend-following momentum indicator
 */
export function macd(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): (MACDValue | null)[] {
  if (candles.length < slowPeriod) return candles.map(() => null);

  const fastEma = ema(candles, fastPeriod);
  const slowEma = ema(candles, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    const fe = fastEma[i];
    const se = slowEma[i];
    if (fe === null || se === null) {
      macdLine.push(null);
    } else if (typeof fe === 'object' && typeof se === 'object') {
      macdLine.push(fe.value - se.value);
    }
  }

  // Calculate signal line (EMA of MACD line)
  const validMacdLine = macdLine.map((v, i) => ({
    timestamp: candles[i]!.timestamp,
    close: v || 0,
  } as Candle));

  const signalEma = ema(validMacdLine, signalPeriod);

  const result: (MACDValue | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    const macdVal = macdLine[i];
    const sigVal = signalEma[i];
    if (macdVal === null || sigVal === null) {
      result.push(null);
    } else if (typeof sigVal === 'object') {
      result.push({
        macd: macdVal || 0,
        signal: sigVal.value,
        histogram: (macdVal || 0) - sigVal.value,
      });
    }
  }

  return result;
}

/**
 * True Range and Average True Range (ATR)
 * Measures volatility based on the greatest of:
 * - High - Low
 * - |High - Previous Close|
 * - |Low - Previous Close|
 */
export function atr(candles: Candle[], period: number): ATRValue[] {
  if (period < 1 || candles.length < period) return candles.map(() => null);

  const trueRanges: number[] = [];
  trueRanges.push(candles[0]!.high - candles[0]!.low);

  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i]!.high - candles[i]!.low;
    const hpc = Math.abs(candles[i]!.high - candles[i - 1]!.close);
    const lpc = Math.abs(candles[i]!.low - candles[i - 1]!.close);
    trueRanges.push(Math.max(hl, hpc, lpc));
  }

  const result: ATRValue[] = [];

  // Initialize with SMA of first period
  for (let i = 0; i < period - 1; i++) {
    result.push(null);
  }

  const initialAtr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(initialAtr);

  // Smooth using Wilder's method
  let atrValue = initialAtr;
  for (let i = period; i < candles.length; i++) {
    atrValue = (atrValue * (period - 1) + trueRanges[i]!) / period;
    result.push(atrValue);
  }

  return result;
}

/**
 * ADX (Average Directional Index)
 * Measures trend strength (0-100), regardless of direction
 */
export function adx(candles: Candle[], period: number): ADXValue[] {
  if (period < 1 || candles.length < period + 1) return candles.map(() => null);

  const result: ADXValue[] = [];

  // Calculate directional movements
  const upMoves: number[] = [];
  const downMoves: number[] = [];

  upMoves.push(0);
  downMoves.push(0);

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i]!.high - candles[i - 1]!.high;
    const downMove = candles[i - 1]!.low - candles[i]!.low;

    if (upMove > downMove && upMove > 0) {
      upMoves.push(upMove);
      downMoves.push(0);
    } else if (downMove > upMove && downMove > 0) {
      upMoves.push(0);
      downMoves.push(downMove);
    } else {
      upMoves.push(0);
      downMoves.push(0);
    }
  }

  // Calculate ATR for normalization
  const atrValues = atr(candles, period);

  // Calculate DI lines and ADX
  for (let i = 0; i < candles.length; i++) {
    if (i < period || atrValues[i] === null) {
      result.push(null);
    } else {
      const atrVal = atrValues[i];
      if (atrVal === null || atrVal === undefined || atrVal === 0) {
        result.push(null);
      } else {
        // Simplified ADX: ratio of absolute directional movement to ATR
        const upSum = upMoves.slice(Math.max(0, i - period + 1), i + 1).reduce((a, b) => a + b, 0);
        const downSum = downMoves.slice(Math.max(0, i - period + 1), i + 1).reduce((a, b) => a + b, 0);
        const totalMove = upSum + downSum;
        const adxValue = totalMove > 0 ? Math.min(100, (totalMove / (atrVal * period)) * 100) : 0;
        result.push(adxValue);
      }
    }
  }

  return result;
}

/**
 * Bollinger Bands
 * Shows volatility bands above and below SMA
 * Upper = SMA + (Std Dev × stddev_multiplier)
 * Lower = SMA - (Std Dev × stddev_multiplier)
 */
export function bbands(candles: Candle[], period: number = 20, stddevMultiplier: number = 2): (BBandsValue | null)[] {
  if (period < 1 || candles.length < period) return candles.map(() => null);

  const smaValues = sma(candles, period);
  const result: (BBandsValue | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (smaValues[i] === null) {
      result.push(null);
    } else {
      const middle = smaValues[i] as number;
      const slice = candles.slice(i - period + 1, i + 1);

      // Calculate standard deviation
      const mean = slice.reduce((a, c) => a + c.close, 0) / period;
      const variance = slice.reduce((a, c) => a + Math.pow(c.close - mean, 2), 0) / period;
      const stddev = Math.sqrt(variance);

      const upper = middle + stddev * stddevMultiplier;
      const lower = middle - stddev * stddevMultiplier;
      const percentB = (candles[i]!.close - lower) / (upper - lower);
      const bandwidth = (upper - lower) / middle;

      result.push({
        upper,
        middle,
        lower,
        percent_b: Math.min(1, Math.max(0, percentB)),
        bandwidth,
      });
    }
  }

  return result;
}

/**
 * Stochastic Oscillator
 * Compares close price to price range over a period (0-100)
 */
export function stochastic(
  candles: Candle[],
  kPeriod: number = 14,
  dPeriod: number = 3,
  smoothPeriod: number = 3
): (StochasticValue | null)[] {
  if (kPeriod < 1 || candles.length < kPeriod) return candles.map(() => null);

  const kValues: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(NaN);
    } else {
      const slice = candles.slice(i - kPeriod + 1, i + 1);
      const high = Math.max(...slice.map(c => c.high));
      const low = Math.min(...slice.map(c => c.low));
      const close = candles[i]!.close;

      if (high === low) {
        kValues.push(50);
      } else {
        kValues.push(((close - low) / (high - low)) * 100);
      }
    }
  }

  // Smooth K line
  const smoothedK: number[] = [];
  for (let i = 0; i < kValues.length; i++) {
    if (i < smoothPeriod - 1 || isNaN(kValues[i]!)) {
      smoothedK.push(NaN);
    } else {
      const slice = kValues.slice(i - smoothPeriod + 1, i + 1);
      const validValues = slice.filter((v): v is number => !isNaN(v));
      smoothedK.push(validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : NaN);
    }
  }

  // Calculate D line (SMA of K)
  const dValues: (number | null)[] = [];
  for (let i = 0; i < smoothedK.length; i++) {
    if (i < dPeriod - 1 || isNaN(smoothedK[i]!)) {
      dValues.push(null);
    } else {
      const slice = smoothedK.slice(i - dPeriod + 1, i + 1);
      const validValues = slice.filter((v): v is number => !isNaN(v));
      dValues.push(validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : null);
    }
  }

  const result: (StochasticValue | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (isNaN(smoothedK[i]!) || dValues[i] === null) {
      result.push(null);
    } else {
      result.push({
        k: smoothedK[i]!,
        d: dValues[i] as number,
      });
    }
  }

  return result;
}
