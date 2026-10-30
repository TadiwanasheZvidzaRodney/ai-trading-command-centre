/**
 * Test fixtures: realistic candle series for technical analysis tests
 */

import type { Candle } from './types';

/**
 * EUR/USD 4h trending up (50+ candles)
 * Realistic range: 1.0800 - 1.0900
 */
export function createEurUsdTrendingUp(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1609459200000; // Jan 1, 2021
  let open = 1.0800;

  for (let i = 0; i < 55; i++) {
    const trend = 0.00005 * i; // Steady uptrend
    const close = open + trend + (Math.random() - 0.5) * 0.0002;
    const high = Math.max(open, close) + Math.random() * 0.00015;
    const low = Math.min(open, close) - Math.random() * 0.00015;
    const volume = 1000000 + Math.random() * 500000;

    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    });

    timestamp += 4 * 60 * 60 * 1000; // 4 hours
    open = close;
  }

  return candles;
}

/**
 * GBP/USD 1d trending down (50+ candles)
 * Realistic range: 1.2500 - 1.2700
 */
export function createGbpUsdTrendingDown(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1609459200000; // Jan 1, 2021
  let open = 1.2650;

  for (let i = 0; i < 55; i++) {
    const trend = -0.0001 * i; // Steady downtrend
    const close = open + trend + (Math.random() - 0.5) * 0.0004;
    const high = Math.max(open, close) + Math.random() * 0.0002;
    const low = Math.min(open, close) - Math.random() * 0.0003;
    const volume = 2000000 + Math.random() * 1000000;

    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    });

    timestamp += 24 * 60 * 60 * 1000; // 1 day
    open = close;
  }

  return candles;
}

/**
 * XAU/USD 1h ranging (50+ candles)
 * Realistic range: 2600 - 2700
 */
export function createXauUsdRanging(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1609459200000; // Jan 1, 2021
  const supportLevel = 2650;
  const resistanceLevel = 2680;
  const midpoint = (supportLevel + resistanceLevel) / 2;

  for (let i = 0; i < 55; i++) {
    // Oscillate between support and resistance
    const phase = (i % 20) / 20; // 0 to 1
    const basePrice =
      supportLevel +
      Math.sin(phase * Math.PI * 2) * (resistanceLevel - supportLevel) * 0.3;
    const open = basePrice + (Math.random() - 0.5) * 5;
    const close = open + (Math.random() - 0.5) * 8;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    const volume = 500000 + Math.random() * 300000;

    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    });

    timestamp += 60 * 60 * 1000; // 1 hour
  }

  return candles;
}

/**
 * Small sample for edge case testing (5 candles)
 */
export function createSmallSample(): Candle[] {
  return [
    {
      timestamp: 1000,
      open: 100,
      high: 102,
      low: 99,
      close: 101,
      volume: 1000,
    },
    {
      timestamp: 2000,
      open: 101,
      high: 103,
      low: 100,
      close: 102,
      volume: 1100,
    },
    {
      timestamp: 3000,
      open: 102,
      high: 104,
      low: 101,
      close: 103,
      volume: 1200,
    },
    {
      timestamp: 4000,
      open: 103,
      high: 105,
      low: 102,
      close: 104,
      volume: 1300,
    },
    {
      timestamp: 5000,
      open: 104,
      high: 106,
      low: 103,
      close: 105,
      volume: 1400,
    },
  ];
}

/**
 * Flat/ranging sample (10 candles)
 */
export function createFlatSample(): Candle[] {
  const candles: Candle[] = [];
  const basePrice = 100;

  for (let i = 0; i < 10; i++) {
    const open = basePrice + (Math.random() - 0.5) * 0.5;
    const close = basePrice + (Math.random() - 0.5) * 0.5;
    const high = Math.max(open, close) + 0.5;
    const low = Math.min(open, close) - 0.5;

    candles.push({
      timestamp: 1000 * (i + 1),
      open,
      high,
      low,
      close,
      volume: 1000,
    });
  }

  return candles;
}

/**
 * Strong bullish pattern (for pattern detection)
 */
export function createBullishPatternSample(): Candle[] {
  return [
    // Bearish candle
    {
      timestamp: 1000,
      open: 105,
      high: 106,
      low: 102,
      close: 103,
      volume: 1000,
    },
    // Small body (doji-like)
    {
      timestamp: 2000,
      open: 103.5,
      high: 104,
      low: 103,
      close: 103.2,
      volume: 800,
    },
    // Strong bullish candle (morning star pattern)
    {
      timestamp: 3000,
      open: 103,
      high: 107,
      low: 102.8,
      close: 106,
      volume: 1500,
    },
  ];
}

/**
 * Strong bearish pattern (for pattern detection)
 */
export function createBearishPatternSample(): Candle[] {
  return [
    // Bullish candle
    {
      timestamp: 1000,
      open: 95,
      high: 98,
      low: 94,
      close: 97,
      volume: 1000,
    },
    // Small body (doji-like)
    {
      timestamp: 2000,
      open: 96.5,
      high: 97,
      low: 96,
      close: 96.8,
      volume: 800,
    },
    // Strong bearish candle (evening star pattern)
    {
      timestamp: 3000,
      open: 97,
      high: 97.2,
      low: 93,
      close: 94,
      volume: 1500,
    },
  ];
}

/**
 * Engulfing pattern (bullish)
 */
export function createEngulfingBullishSample(): Candle[] {
  return [
    // Bearish candle
    {
      timestamp: 1000,
      open: 102,
      high: 103,
      low: 100,
      close: 100.5,
      volume: 1000,
    },
    // Bullish engulfing candle
    {
      timestamp: 2000,
      open: 100,
      high: 104,
      low: 99,
      close: 103,
      volume: 1500,
    },
  ];
}

/**
 * Pin bar pattern (bullish)
 */
export function createPinBarBullishSample(): Candle[] {
  return [
    // Regular candle
    {
      timestamp: 1000,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
    },
    // Bullish pin bar: long lower wick, small body near top
    {
      timestamp: 2000,
      open: 100.2,
      high: 101.5,
      low: 98,
      close: 100.8,
      volume: 1200,
    },
  ];
}
