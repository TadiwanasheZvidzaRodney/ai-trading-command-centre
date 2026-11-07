import Decimal from 'decimal.js';

function pricePrecision(pipSize: number): number {
  const precision = Math.ceil(-Math.log10(pipSize));
  return Math.min(10, Math.max(0, precision));
}

/**
 * Validate reward-to-risk ratio.
 * 
 * Deterministic validation: R:R = Profit Distance / Loss Distance
 * Target must be at least (Stop Distance × Min R:R) away from entry.
 */
export class RewardRiskCalculator {
  constructor(private minRewardRisk: number, private pipSize: number) {
    if (minRewardRisk <= 0) {
      throw new Error('minRewardRisk must be positive');
    }
    if (pipSize <= 0) {
      throw new Error('pipSize must be positive');
    }
  }

  /**
   * Calculate the actual reward-to-risk ratio for a trade plan.
   * 
   * R:R = (Target - Entry) / (Entry - Stop) for buy
   * R:R = (Entry - Target) / (Stop - Entry) for sell
   */
  calculateRatio(entry: number, stop: number, target: number): number {
    if (entry <= 0 || stop <= 0 || target <= 0) {
      throw new Error('entry, stop, and target must be positive');
    }

    const stopDistance = Math.abs(entry - stop);
    const targetDistance = Math.abs(target - entry);

    if (stopDistance === 0) {
      throw new Error('Stop distance cannot be zero');
    }

    const ratio = new Decimal(targetDistance).div(stopDistance);
    return Number(ratio.toFixed(2));
  }

  /**
   * Validate that the reward-to-risk ratio meets minimum requirements.
   * 
   * @returns { valid: boolean, ratio: number, minRequired: number }
   */
  validate(entry: number, stop: number, target: number): {
    valid: boolean;
    ratio: number;
    minRequired: number;
    difference: number;
  } {
    const ratio = this.calculateRatio(entry, stop, target);
    const valid = ratio >= this.minRewardRisk;
    const difference = new Decimal(ratio).minus(this.minRewardRisk);

    return {
      valid,
      ratio,
      minRequired: this.minRewardRisk,
      difference: Number(difference.toFixed(2)),
    };
  }

  /**
   * Calculate the minimum target price for a given R:R ratio.
   * This tells you where to place your target to achieve the desired R:R.
   */
  calculateMinimumTarget(entry: number, stop: number, targetRR: number = this.minRewardRisk): number {
    if (entry <= 0 || stop <= 0 || targetRR <= 0) {
      throw new Error('All parameters must be positive');
    }

    const stopDistance = Math.abs(entry - stop);
    const targetDistance = new Decimal(stopDistance).times(targetRR);
    const minTarget = new Decimal(entry).plus(targetDistance);

    // Round to the instrument's price precision instead of a fixed 2 decimals.
    // pipSize 0.0001 -> 4 decimals; pipSize 0.1 -> 1 decimal.
    const precision = pricePrecision(this.pipSize);
    return Number(minTarget.toFixed(precision));
  }

  /**
   * Suggest corrections to make the R:R valid.
   */
  suggestCorrections(
    entry: number,
    stop: number,
    target: number,
  ): {
    currentRatio: number;
    needed: 'moveStop' | 'moveTarget' | 'adjustBoth' | 'none';
    suggestions: string[];
  } {
    const current = this.calculateRatio(entry, stop, target);

    if (current >= this.minRewardRisk) {
      return {
        currentRatio: current,
        needed: 'none',
        suggestions: [`Current R:R of ${current} already meets minimum of ${this.minRewardRisk}`],
      };
    }

    const stopDistance = Math.abs(entry - stop);
    const minTargetDistance = new Decimal(stopDistance).times(this.minRewardRisk);
    const adjustedTarget = new Decimal(entry).plus(minTargetDistance);
    const precision = pricePrecision(this.pipSize);
    const adjustedTargetText = Number(adjustedTarget.toFixed(precision));
    const differenceText = Number(
      adjustedTarget.minus(target).abs().toFixed(precision),
    );

    return {
      currentRatio: current,
      needed: 'moveTarget',
      suggestions: [
        `Current R:R is ${current}, need at least ${this.minRewardRisk}`,
        `Move target from ${target} to at least ${adjustedTargetText} (difference: ${differenceText} pips)`,
      ],
    };
  }
}
