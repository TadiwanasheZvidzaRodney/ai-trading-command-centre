import Decimal from 'decimal.js';
import type { OrderSide } from '@atc/shared';
import type { PositionSizeOutput } from '../types.js';

/**
 * Calculate position size in lots based on risk percentage.
 *
 * Formula: Position Size (lots) = (Account Equity × Risk %) / (Stop Distance in pips × Pip Value per lot)
 *
 * This is deterministic: same inputs always produce the same output.
 * No randomness, no external dependencies.
 */
export class PositionSizingCalculator {
  constructor(
    private pipValuePerLot: number,
    private contractSize: number,
    private pipSize: number,
  ) {
    if (pipValuePerLot <= 0) {
      throw new Error('pipValuePerLot must be positive');
    }
    if (contractSize <= 0) {
      throw new Error('contractSize must be positive');
    }
    if (pipSize <= 0) {
      throw new Error('pipSize must be positive');
    }
  }

  /**
   * Calculate position size in lots from risk percentage.
   */
  calculateLots(
    accountEquity: number,
    riskPerTradePct: number,
    entry: number,
    stop: number,
    side: OrderSide,
  ): number {
    if (accountEquity <= 0) throw new Error('accountEquity must be positive');
    if (riskPerTradePct <= 0) throw new Error('riskPerTradePct must be positive');
    if (entry <= 0) throw new Error('entry must be positive');
    if (stop <= 0) throw new Error('stop must be positive');

    // Ensure stop is on correct side of entry
    if (side === 'buy' && stop >= entry) {
      throw new Error('For buy orders, stop must be below entry');
    }
    if (side === 'sell' && stop <= entry) {
      throw new Error('For sell orders, stop must be above entry');
    }

    // Calculate risk amount in USD
    const riskAmount = new Decimal(accountEquity).times(riskPerTradePct).div(100);

    // Calculate distance in pips
    const distance = Math.abs(entry - stop);
    const distanceInPips = new Decimal(distance).div(this.pipSize);

    // Position size = Risk Amount / (Distance in Pips × Pip Value per Lot)
    const positionSizeLots = riskAmount.div(
      distanceInPips.times(this.pipValuePerLot),
    );

    // Round to the nearest minimum lot (0.01). Sizes below the minimum are
    // reported at the minimum so the caller can decide whether to reject.
    return Math.max(0.01, Number(positionSizeLots.toFixed(2)));
  }

  /**
   * Calculate complete position sizing output.
   */
  calculatePositionSize(
    accountEquity: number,
    riskPerTradePct: number,
    entry: number,
    stop: number,
    target: number,
    side: OrderSide,
  ): PositionSizeOutput {
    const quantityLots = this.calculateLots(accountEquity, riskPerTradePct, entry, stop, side);

    const stopDistance = Math.abs(entry - stop);
    const targetDistance = Math.abs(target - entry);

    // Risk/reward are expressed in USD using the pip value per lot.
    const stopPips = new Decimal(stopDistance).div(this.pipSize);
    const targetPips = new Decimal(targetDistance).div(this.pipSize);

    const riskAmount = stopPips.times(this.pipValuePerLot).times(quantityLots);
    const rewardAmount = targetPips.times(this.pipValuePerLot).times(quantityLots);

    const rewardRisk = riskAmount.eq(0)
      ? new Decimal(0)
      : rewardAmount.div(riskAmount);

    // Notional value
    const notionalUSD = new Decimal(entry).times(this.contractSize).times(quantityLots);

    return {
      quantityLots,
      notionalUSD: Number(notionalUSD.toFixed(2)),
      riskAmount: Number(riskAmount.toFixed(2)),
      riskPct: riskPerTradePct,
      rewardAmount: Number(rewardAmount.toFixed(2)),
      rewardRisk: Number(rewardRisk.toFixed(2)),
      stopDistance,
      targetDistance,
      pipValuePerLot: this.pipValuePerLot,
    };
  }
}
