import { describe, expect, it } from 'vitest';
import {
  calculateClosedPnl,
  calculateFillCosts,
  calculateSpreadPips,
  calculateUnrealizedPnl,
  entryFillPrice,
  lotsFromUnits,
  pipValuePerLot,
  priceDistanceToPips,
} from './pricing.js';

describe('paper pricing', () => {
  it('converts units to lots using the contract specification', () => {
    expect(lotsFromUnits('EUR/USD', 100_000)).toBe(1);
    expect(lotsFromUnits('XAU/USD', 100)).toBe(1);
  });

  it('computes pip value in USD for supported instruments', () => {
    expect(pipValuePerLot('EUR/USD')).toBe(10);
    expect(pipValuePerLot('XAU/USD')).toBe(10);
  });

  it('converts a price distance to pips', () => {
    expect(priceDistanceToPips('EUR/USD', 0.001)).toBeCloseTo(10);
    expect(priceDistanceToPips('XAU/USD', 1)).toBeCloseTo(10);
  });

  it('applies adverse slippage to entry fills', () => {
    expect(entryFillPrice('buy', 1.05, 1.0501, 0.2, 'EUR/USD')).toBeCloseTo(1.05012, 5);
    expect(entryFillPrice('sell', 1.05, 1.0501, 0.2, 'EUR/USD')).toBeCloseTo(1.04998, 5);
  });

  it('calculates commission and slippage costs', () => {
    const costs = calculateFillCosts('EUR/USD', 100_000, {
      commissionPerLot: 7,
      slippagePips: 0.2,
    });
    expect(costs.lots).toBe(1);
    expect(costs.commission).toBe(7);
    expect(costs.slippage).toBe(2);
    expect(costs.total).toBe(9);
  });

  it('deducts entry and exit costs from gross P&L and computes R', () => {
    const result = calculateClosedPnl({
      instrument: 'EUR/USD',
      side: 'buy',
      entryPrice: 1.05,
      exitPrice: 1.06,
      stopPrice: 1.04,
      quantityUnits: 100_000,
      entryCosts: 9,
      exitCosts: 9,
    });
    expect(result.grossPnL).toBe(1000);
    expect(result.costs).toBe(18);
    expect(result.netPnL).toBe(982);
    // Risk is (1.05 - 1.04) * 100,000 = $1,000, so 982/1000 = 0.982R.
    expect(result.rMultiple).toBe(0.98);
  });

  it('computes unrealized P&L in USD for both directions', () => {
    expect(calculateUnrealizedPnl('buy', 1.05, 1.06, 100_000).pnl).toBe(1000);
    expect(calculateUnrealizedPnl('sell', 1.05, 1.04, 100_000).pnl).toBe(1000);
  });

  it('derives spread in pips and rejects inverted quotes', () => {
    expect(calculateSpreadPips('EUR/USD', 1.05, 1.0502)).toBeCloseTo(2);
    expect(calculateSpreadPips('EUR/USD', 1.0502, 1.05)).toBeNull();
    expect(calculateSpreadPips('EUR/USD', null, 1.05)).toBeNull();
  });
});
