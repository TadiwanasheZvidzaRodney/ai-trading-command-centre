import Decimal from 'decimal.js';
import type { AccountState, LimitCheckResult, RiskLimits } from '../types.js';

/**
 * Check risk limits to prevent over-exposure.
 * 
 * Hard limits that cannot be bypassed:
 * 1. Per-trade risk limit: Risk per trade cannot exceed account × riskPerTradePct
 * 2. Daily loss limit: Total losses today cannot exceed account × maxDailyLossPct
 * 3. Open risk limit: Total open position risk cannot exceed account × maxOpenRiskPct
 * 4. Max positions: Cannot have more than maxPositions open positions
 * 5. Min reward-to-risk: Every trade must meet minimum R:R ratio
 */
export class LimitChecker {
  /**
   * Check all limits against account state.
   * 
   * @param riskAmount The risk amount of the proposed new trade in USD
   * @param rewardRisk The reward-to-risk ratio of the proposed trade
   * @param accountState Current account state (positions, orders, P&L)
   * @param limits Risk limits configuration
   * @returns Result of all limit checks with any violations
   */
  checkAllLimits(
    riskAmount: number,
    rewardRisk: number,
    accountState: AccountState,
    limits: RiskLimits,
  ): LimitCheckResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    // 1. Per-trade limit
    const perTradeOk = this.checkPerTrade(riskAmount, limits.perTradeLimitUSD, violations);

    // 2. Daily loss limit
    const dailyLossOk = this.checkDailyLoss(accountState.dailyPnL, limits.dailyLossLimitUSD, violations);

    // 3. Open risk limit
    const currentOpenRisk = this.calculateOpenRisk(accountState);
    const openRiskOk = this.checkOpenRisk(
      currentOpenRisk,
      riskAmount,
      limits.openRiskLimitUSD,
      violations,
    );

    // 4. Max positions
    const maxPositionsOk = this.checkMaxPositions(
      accountState.openPositions.length,
      accountState.openOrders.length,
      limits.maxPositions,
      violations,
    );

    // 5. Min reward-to-risk
    const minRROk = this.checkMinRR(rewardRisk, limits.minRewardRisk, violations);

    const allOk = perTradeOk && dailyLossOk && openRiskOk && maxPositionsOk && minRROk;

    return {
      perTradeOk,
      dailyLossOk,
      openRiskOk,
      maxPositionsOk,
      minRROk,
      allOk,
      violations,
      warnings,
    };
  }

  /**
   * Check per-trade risk limit.
   */
  private checkPerTrade(riskAmount: number, perTradeLimitUSD: number, violations: string[]): boolean {
    const ok = riskAmount <= perTradeLimitUSD;
    if (!ok) {
      violations.push(
        `Per-trade risk $${riskAmount.toFixed(2)} exceeds limit of $${perTradeLimitUSD.toFixed(2)}`,
      );
    }
    return ok;
  }

  /**
   * Check daily loss limit.
   */
  private checkDailyLoss(dailyPnL: number, dailyLossLimitUSD: number, violations: string[]): boolean {
    const dailyLoss = Math.min(0, dailyPnL); // Only count losses
    const ok = Math.abs(dailyLoss) <= dailyLossLimitUSD;
    if (!ok) {
      violations.push(
        `Daily loss $${Math.abs(dailyLoss).toFixed(2)} exceeds limit of $${dailyLossLimitUSD.toFixed(2)}`,
      );
    }
    return ok;
  }

  /**
   * Check open risk limit (total risk across all open positions).
   */
  private checkOpenRisk(
    currentOpenRisk: number,
    proposedRisk: number,
    openRiskLimitUSD: number,
    violations: string[],
  ): boolean {
    const totalRisk = new Decimal(currentOpenRisk).plus(proposedRisk);
    const ok = totalRisk.lessThanOrEqualTo(openRiskLimitUSD);
    if (!ok) {
      violations.push(
        `Total open risk $${totalRisk.toFixed(2)} would exceed limit of $${openRiskLimitUSD.toFixed(2)}`,
      );
    }
    return ok;
  }

  /**
   * Check maximum open positions limit.
   */
  private checkMaxPositions(
    currentPositions: number,
    pendingOrders: number,
    maxPositions: number,
    violations: string[],
  ): boolean {
    const totalPotential = currentPositions + pendingOrders;
    const ok = totalPotential < maxPositions;
    if (!ok) {
      violations.push(
        `Would have ${totalPotential + 1} positions (current: ${currentPositions}, pending: ${pendingOrders}), limit is ${maxPositions}`,
      );
    }
    return ok;
  }

  /**
   * Check minimum reward-to-risk ratio.
   */
  private checkMinRR(rewardRisk: number, minRewardRisk: number, violations: string[]): boolean {
    const ok = rewardRisk >= minRewardRisk;
    if (!ok) {
      violations.push(
        `Reward-to-risk ratio ${rewardRisk.toFixed(2)} is below minimum of ${minRewardRisk.toFixed(2)}`,
      );
    }
    return ok;
  }

  /**
   * Calculate total risk across all open positions.
   * Risk = Quantity × Pip Distance × Pip Value per Lot
   */
  private calculateOpenRisk(accountState: AccountState): number {
    return accountState.openPositions.reduce((total, position) => {
      return total + position.riskAmount;
    }, 0);
  }

  /**
   * Get a summary of current exposure.
   */
  getExposureSummary(accountState: AccountState, limits: RiskLimits) {
    const openRisk = this.calculateOpenRisk(accountState);
    const riskPct = (openRisk / accountState.equity) * 100;
    const riskRemaining = limits.openRiskLimitUSD - openRisk;
    const positionsRemaining = limits.maxPositions - accountState.openPositions.length;

    return {
      openRisk,
      openRiskLimit: limits.openRiskLimitUSD,
      riskPct,
      riskRemaining,
      openPositions: accountState.openPositions.length,
      maxPositions: limits.maxPositions,
      positionsRemaining,
      dailyPnL: accountState.dailyPnL,
      dailyLossLimit: limits.dailyLossLimitUSD,
    };
  }
}
