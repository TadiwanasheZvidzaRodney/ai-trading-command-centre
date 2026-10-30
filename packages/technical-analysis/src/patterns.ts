/**
 * Candle pattern detection
 */

import type { Candle, PatternDetection, CandlePattern } from './types';

interface CandleMetrics {
  body_size: number;
  body_ratio: number;  // body / (high - low)
  upper_wick: number;
  lower_wick: number;
  upper_wick_ratio: number;  // upper_wick / (high - low)
  lower_wick_ratio: number;  // lower_wick / (high - low)
  is_bullish: boolean;
  is_bearish: boolean;
}

/**
 * Calculate candle metrics for pattern analysis
 */
function getCandleMetrics(candle: Candle): CandleMetrics {
  const body_size = Math.abs(candle.close - candle.open);
  const hl_range = candle.high - candle.low;
  const body_ratio = hl_range > 0 ? body_size / hl_range : 0;

  const upper_wick = candle.high - Math.max(candle.open, candle.close);
  const lower_wick = Math.min(candle.open, candle.close) - candle.low;

  const upper_wick_ratio = hl_range > 0 ? upper_wick / hl_range : 0;
  const lower_wick_ratio = hl_range > 0 ? lower_wick / hl_range : 0;

  return {
    body_size,
    body_ratio,
    upper_wick,
    lower_wick,
    upper_wick_ratio,
    lower_wick_ratio,
    is_bullish: candle.close > candle.open,
    is_bearish: candle.close < candle.open,
  };
}

/**
 * Engulfing pattern: current candle body fully contains previous candle body
 */
function detectEngulfing(candles: Candle[], index: number): PatternDetection | null {
  if (index === 0 || index >= candles.length) return null;

  const current = candles[index]!;
  const prev = candles[index - 1]!;

  const currentMetrics = getCandleMetrics(current);
  const prevMetrics = getCandleMetrics(prev);

  // Bullish engulfing: current is bullish, prev is bearish, current engulfs prev
  if (
    currentMetrics.is_bullish &&
    prevMetrics.is_bearish &&
    current.open < prev.close &&
    current.close > prev.open
  ) {
    return {
      pattern: 'engulfing_bull',
      index,
      confidence: 85,
      description: 'Bullish engulfing pattern: bullish candle engulfs bearish candle',
    };
  }

  // Bearish engulfing: current is bearish, prev is bullish, current engulfs prev
  if (
    currentMetrics.is_bearish &&
    prevMetrics.is_bullish &&
    current.open > prev.close &&
    current.close < prev.open
  ) {
    return {
      pattern: 'engulfing_bear',
      index,
      confidence: 85,
      description: 'Bearish engulfing pattern: bearish candle engulfs bullish candle',
    };
  }

  return null;
}

/**
 * Pin bar pattern: long wick on one side, small body on other
 */
function detectPinBar(candles: Candle[], index: number): PatternDetection | null {
  if (index >= candles.length) return null;

  const current = candles[index]!;
  const metrics = getCandleMetrics(current);

  // Body must be small (< 20% of range)
  if (metrics.body_ratio > 0.2) return null;

  // Bullish pin bar: long lower wick, small body near top
  if (metrics.lower_wick_ratio > 0.5 && current.close > (current.high + current.low) / 2) {
    return {
      pattern: 'pinbar_bull',
      index,
      confidence: 75,
      description: 'Bullish pin bar: long lower wick with body near top',
    };
  }

  // Bearish pin bar: long upper wick, small body near bottom
  if (metrics.upper_wick_ratio > 0.5 && current.close < (current.high + current.low) / 2) {
    return {
      pattern: 'pinbar_bear',
      index,
      confidence: 75,
      description: 'Bearish pin bar: long upper wick with body near bottom',
    };
  }

  return null;
}

/**
 * Doji pattern: open and close are nearly equal
 */
function detectDoji(candles: Candle[], index: number): PatternDetection | null {
  if (index >= candles.length) return null;

  const current = candles[index]!;
  const metrics = getCandleMetrics(current);

  // Body very small (< 5% of range)
  if (metrics.body_ratio < 0.05) {
    return {
      pattern: 'doji',
      index,
      confidence: 80,
      description: 'Doji: open and close nearly equal, indecision',
    };
  }

  return null;
}

/**
 * Hammer pattern: small body, long lower wick, on downtrend
 */
function detectHammer(candles: Candle[], index: number): PatternDetection | null {
  if (index === 0 || index >= candles.length) return null;

  const current = candles[index]!;
  const prev = candles[index - 1]!;
  const metrics = getCandleMetrics(current);

  // Body small, mostly bullish
  if (metrics.body_ratio < 0.3 && current.close > current.open && metrics.lower_wick_ratio > 0.5) {
    // Previous should show downtrend
    if (prev.close > current.close) {
      return {
        pattern: 'hammer',
        index,
        confidence: 80,
        description: 'Hammer: small bullish body with long lower wick, potential reversal',
      };
    }
  }

  return null;
}

/**
 * Inverted hammer pattern: small body, long upper wick, on uptrend
 */
function detectInvertedHammer(candles: Candle[], index: number): PatternDetection | null {
  if (index === 0 || index >= candles.length) return null;

  const current = candles[index]!;
  const prev = candles[index - 1]!;
  const metrics = getCandleMetrics(current);

  // Body small, mostly bearish, long upper wick
  if (metrics.body_ratio < 0.3 && current.close < current.open && metrics.upper_wick_ratio > 0.5) {
    // Previous should show uptrend
    if (prev.close < current.close) {
      return {
        pattern: 'inverted_hammer',
        index,
        confidence: 80,
        description: 'Inverted hammer: small bearish body with long upper wick, potential reversal',
      };
    }
  }

  return null;
}

/**
 * Morning star pattern: bearish, doji/small, bullish (3 candles)
 */
function detectMorningStar(candles: Candle[], index: number): PatternDetection | null {
  if (index < 2 || index >= candles.length) return null;

  const candle1 = candles[index - 2]!;
  const candle2 = candles[index - 1]!;
  const candle3 = candles[index]!;

  const m1 = getCandleMetrics(candle1);
  const m2 = getCandleMetrics(candle2);
  const m3 = getCandleMetrics(candle3);

  // First bearish, second small body (doji or small), third bullish
  if (
    m1.is_bearish &&
    m2.body_ratio < 0.3 &&
    m3.is_bullish &&
    candle3.close > candle1.open
  ) {
    return {
      pattern: 'morning_star',
      index,
      confidence: 75,
      description: 'Morning star: bearish, small body, bullish; potential uptrend start',
    };
  }

  return null;
}

/**
 * Evening star pattern: bullish, doji/small, bearish (3 candles)
 */
function detectEveningStar(candles: Candle[], index: number): PatternDetection | null {
  if (index < 2 || index >= candles.length) return null;

  const candle1 = candles[index - 2]!;
  const candle2 = candles[index - 1]!;
  const candle3 = candles[index]!;

  const m1 = getCandleMetrics(candle1);
  const m2 = getCandleMetrics(candle2);
  const m3 = getCandleMetrics(candle3);

  // First bullish, second small body (doji or small), third bearish
  if (
    m1.is_bullish &&
    m2.body_ratio < 0.3 &&
    m3.is_bearish &&
    candle3.close < candle1.open
  ) {
    return {
      pattern: 'evening_star',
      index,
      confidence: 75,
      description: 'Evening star: bullish, small body, bearish; potential downtrend start',
    };
  }

  return null;
}

/**
 * Three inside up pattern: bearish, smaller bearish inside, bullish engulfing
 */
function detectThreeInsideUp(candles: Candle[], index: number): PatternDetection | null {
  if (index < 2 || index >= candles.length) return null;

  const candle1 = candles[index - 2]!;
  const candle2 = candles[index - 1]!;
  const candle3 = candles[index]!;

  const m1 = getCandleMetrics(candle1);
  const m2 = getCandleMetrics(candle2);
  const m3 = getCandleMetrics(candle3);

  // First bearish, second bearish inside first, third bullish
  if (
    m1.is_bearish &&
    m2.is_bearish &&
    candle2.high < candle1.high &&
    candle2.low > candle1.low &&
    m3.is_bullish &&
    candle3.close > candle1.open
  ) {
    return {
      pattern: 'three_inside_up',
      index,
      confidence: 70,
      description: 'Three inside up: potential bullish reversal pattern',
    };
  }

  return null;
}

/**
 * Three inside down pattern: bullish, smaller bullish inside, bearish engulfing
 */
function detectThreeInsideDown(candles: Candle[], index: number): PatternDetection | null {
  if (index < 2 || index >= candles.length) return null;

  const candle1 = candles[index - 2]!;
  const candle2 = candles[index - 1]!;
  const candle3 = candles[index]!;

  const m1 = getCandleMetrics(candle1);
  const m2 = getCandleMetrics(candle2);
  const m3 = getCandleMetrics(candle3);

  // First bullish, second bullish inside first, third bearish
  if (
    m1.is_bullish &&
    m2.is_bullish &&
    candle2.high < candle1.high &&
    candle2.low > candle1.low &&
    m3.is_bearish &&
    candle3.close < candle1.open
  ) {
    return {
      pattern: 'three_inside_down',
      index,
      confidence: 70,
      description: 'Three inside down: potential bearish reversal pattern',
    };
  }

  return null;
}

/**
 * Detect all patterns in candle series
 */
export function detectPatterns(candles: Candle[]): PatternDetection[] {
  const patterns: PatternDetection[] = [];

  for (let i = 0; i < candles.length; i++) {
    // Single candle patterns
    const doji = detectDoji(candles, i);
    if (doji) patterns.push(doji);

    const pinBar = detectPinBar(candles, i);
    if (pinBar) patterns.push(pinBar);

    const hammer = detectHammer(candles, i);
    if (hammer) patterns.push(hammer);

    const invHammer = detectInvertedHammer(candles, i);
    if (invHammer) patterns.push(invHammer);

    // Two candle patterns
    const engulfing = detectEngulfing(candles, i);
    if (engulfing) patterns.push(engulfing);

    // Three candle patterns
    const morning = detectMorningStar(candles, i);
    if (morning) patterns.push(morning);

    const evening = detectEveningStar(candles, i);
    if (evening) patterns.push(evening);

    const threeUp = detectThreeInsideUp(candles, i);
    if (threeUp) patterns.push(threeUp);

    const threeDown = detectThreeInsideDown(candles, i);
    if (threeDown) patterns.push(threeDown);
  }

  return patterns;
}
