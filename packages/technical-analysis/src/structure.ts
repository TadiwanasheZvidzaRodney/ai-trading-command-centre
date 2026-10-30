/**
 * Structure detection: trend, swing highs/lows, support/resistance
 */

import type { Candle, Structure, Trend, PriceLevel, SwingPoints, ADXValue } from './types';

/**
 * Detect swing highs and lows
 * A swing high is a candle with high > previous N and next N candles
 * A swing low is a candle with low < previous N and next N candles
 */
export function detectSwingHighLow(candles: Candle[], lookback: number = 5): SwingPoints {
  const highs: { price: number; timestamp: number; index: number }[] = [];
  const lows: { price: number; timestamp: number; index: number }[] = [];

  if (candles.length < lookback * 2 + 1) {
    return { highs, lows };
  }

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i]!;

    // Check swing high
    let isSwingHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j]!.high >= current.high) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      highs.push({
        price: current.high,
        timestamp: current.timestamp,
        index: i,
      });
    }

    // Check swing low
    let isSwingLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j]!.low <= current.low) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      lows.push({
        price: current.low,
        timestamp: current.timestamp,
        index: i,
      });
    }
  }

  return { highs, lows };
}

/**
 * Identify trend direction and strength
 * Direction: based on comparing recent close to previous closes
 * Strength: based on ADX values if available, or slope
 */
export function identifyTrend(candles: Candle[], adxValues: (ADXValue)[] = []): Trend {
  if (candles.length < 2) {
    return {
      direction: 'flat',
      strength: 0,
      start_timestamp: candles.length > 0 ? candles[0]!.timestamp : 0,
      start_price: candles.length > 0 ? candles[0]!.close : 0,
    };
  }

  const lastClose = candles[candles.length - 1]!.close;
  const lookbackPeriod = Math.min(20, candles.length - 1);
  const prevClose = candles[candles.length - 1 - lookbackPeriod]!.close;

  let direction: 'up' | 'down' | 'flat' = 'flat';
  let strength = 0;

  if (lastClose > prevClose) {
    direction = 'up';
  } else if (lastClose < prevClose) {
    direction = 'down';
  }

  // Calculate strength from ADX if available
  if (adxValues.length > 0 && adxValues[adxValues.length - 1] !== null) {
    strength = adxValues[adxValues.length - 1] as unknown as number;
  } else {
    // Fallback: calculate from price slope
    const closeGain = Math.abs(lastClose - prevClose);
    const highestClose = Math.max(...candles.slice(-lookbackPeriod).map(c => c.close));
    const lowestClose = Math.min(...candles.slice(-lookbackPeriod).map(c => c.close));
    const range = highestClose - lowestClose;

    if (range > 0) {
      strength = Math.min(100, (closeGain / range) * 100);
    }
  }

  // Find trend start: where direction changed
  let trendStartIndex = candles.length - 1;
  for (let i = candles.length - 2; i >= 0; i--) {
    const currentClose = candles[i]!.close;
    const nextClose = candles[i + 1]!.close;

    if (direction === 'up' && currentClose > nextClose) {
      break;
    }
    if (direction === 'down' && currentClose < nextClose) {
      break;
    }
    trendStartIndex = i;
  }

  return {
    direction,
    strength: Math.round(strength * 100) / 100,
    start_timestamp: candles[trendStartIndex]!.timestamp,
    start_price: candles[trendStartIndex]!.close,
  };
}

/**
 * Cluster price levels (support/resistance)
 * Identifies areas where price has bounced multiple times
 */
export function clusterLevels(
  highs: { price: number; timestamp: number; index: number }[],
  lows: { price: number; timestamp: number; index: number }[],
  clusteringDistancePercent: number = 0.5
): { resistance: PriceLevel[]; support: PriceLevel[] } {
  const resistance: PriceLevel[] = [];
  const support: PriceLevel[] = [];

  // Cluster resistance levels (from swing highs)
  const clusteredResistance = clusterPrices(
    highs.map(h => h.price),
    clusteringDistancePercent
  );

  for (const cluster of clusteredResistance) {
    const touchingHighs = highs.filter(h => isInRange(h.price, cluster.center, clusteringDistancePercent));
    if (touchingHighs.length > 0) {
      const lastHigh = touchingHighs[touchingHighs.length - 1]!;
      resistance.push({
        type: 'high',
        timestamp: lastHigh.timestamp,  // Most recent touch
        price: cluster.center,
        candle_index: lastHigh.index,
        touches: touchingHighs.length,
      });
    }
  }

  // Cluster support levels (from swing lows)
  const clusteredSupport = clusterPrices(
    lows.map(l => l.price),
    clusteringDistancePercent
  );

  for (const cluster of clusteredSupport) {
    const touchingLows = lows.filter(l => isInRange(l.price, cluster.center, clusteringDistancePercent));
    if (touchingLows.length > 0) {
      const lastLow = touchingLows[touchingLows.length - 1]!;
      support.push({
        type: 'low',
        timestamp: lastLow.timestamp,  // Most recent touch
        price: cluster.center,
        candle_index: lastLow.index,
        touches: touchingLows.length,
      });
    }
  }

  // Sort by number of touches (most touched first)
  resistance.sort((a, b) => (b.touches || 0) - (a.touches || 0));
  support.sort((a, b) => (b.touches || 0) - (a.touches || 0));

  return { resistance, support };
}

/**
 * Identify the most recent swing high and low
 */
export function getRecentSwings(candles: Candle[], lookback: number = 5): {
  recent_high: { price: number; timestamp: number } | null;
  recent_low: { price: number; timestamp: number } | null;
} {
  const swings = detectSwingHighLow(candles, lookback);

  return {
    recent_high: swings.highs.length > 0 ? swings.highs[swings.highs.length - 1] || null : null,
    recent_low: swings.lows.length > 0 ? swings.lows[swings.lows.length - 1] || null : null,
  };
}

/**
 * Build complete structure snapshot
 */
export function analyzeStructure(
  candles: Candle[],
  adxValues: (ADXValue)[] = [],
  clusteringDistancePercent: number = 0.5,
  swingLookback: number = 5
): Structure {
  const trend = identifyTrend(candles, adxValues);
  const swings = detectSwingHighLow(candles, swingLookback);
  const { resistance, support } = clusterLevels(swings.highs, swings.lows, clusteringDistancePercent);

  const recentSwings = getRecentSwings(candles, swingLookback);

  return {
    trend,
    resistance_levels: resistance,
    support_levels: support,
    swing_high: recentSwings.recent_high,
    swing_low: recentSwings.recent_low,
  };
}

// Helper functions

/**
 * Check if a price is within range (±percent from center)
 */
function isInRange(price: number, center: number, percentDistance: number): boolean {
  const distance = (percentDistance / 100) * center;
  return price >= center - distance && price <= center + distance;
}

/**
 * Cluster nearby prices
 */
interface PriceCluster {
  center: number;
  prices: number[];
}

function clusterPrices(prices: number[], percentDistance: number): PriceCluster[] {
  if (prices.length === 0) return [];

  const sorted = [...prices].sort((a, b) => a - b);
  const clusters: PriceCluster[] = [];

  let currentCluster = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const clusterCenter = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;

    if (isInRange(current, clusterCenter, percentDistance)) {
      currentCluster.push(current);
    } else {
      // Finalize current cluster
      clusters.push({
        center: currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length,
        prices: currentCluster,
      });
      currentCluster = [current];
    }
  }

  // Add final cluster
  if (currentCluster.length > 0) {
    clusters.push({
      center: currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length,
      prices: currentCluster,
    });
  }

  return clusters;
}
