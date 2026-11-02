import Decimal from 'decimal.js';
import type { InstrumentSymbol, OrderSide, RiskConfig } from '@atc/shared';
import type {
  AccountState,
  RiskEngineConfig,
  RiskValidationResult,
  TradePlanInput,
  RiskLimits,
  InstrumentData,
} from '../types.js';
import { PositionSizingCalculator } from './position-sizing.js';
import { RewardRiskCalculator } from './rr-calculator.js';
import { LimitChecker } from './limit-checker.js';

/**
 * RiskEngine: Main orchestrator for deterministic risk management.
 * 
 * Responsibilities:
 * 1. Calculate position sizes from risk percentages
 * 2. Validate reward-to-risk ratios
 * 3. Check hard limits (per-trade, daily, open risk, max positions)
 * 4. Provide clear approval/rejection with reasons
 * 
 * Key property: DETERMINISTIC
 * Same inputs always produce the same output. No randomness. No external calls.
 */
export class RiskEngine {
  private positionSizing: Map<InstrumentSymbol, PositionSizingCalculator>;
  private rrCalculator: RewardRiskCalculator;
  private limitChecker: LimitChecker;
  private riskConfig: RiskConfig;
  private instruments: Map<InstrumentSymbol, InstrumentData>;

  constructor(config: RiskEngineConfig) {
    this.riskConfig = config.riskConfig;
    this.instruments = new Map(Object.entries(config.instruments));
    this.rrCalculator = new RewardRiskCalculator(
      config.riskConfig.minRewardRisk,
      this.getInstrument('XAU/USD').pipSize, // Use XAU as reference
    );
    this.limitChecker = new LimitChecker();

    // Initialize position sizing calculators for each instrument
    this.positionSizing = new Map();
    for (const [symbol, data] of this.instruments) {
      this.positionSizing.set(
        symbol,
        new PositionSizingCalculator(data.pipSize, data.contractSize, data.pipSize),
      );
    }
  }

  /**
   * Main entry point: Validate a complete trade plan.
   * 
   * Returns approved/rejected with full reasoning.
   */
  validateTradePlan(
    tradePlan: TradePlanInput,
    accountState: AccountState,
  ): RiskValidationResult {
    const startTime = new Date();
    const reasons: string[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: Calculate position size
      const calculator = this.positionSizing.get(tradePlan.instrument);
      if (!calculator) {
        throw new Error(`Unsupported instrument: ${tradePlan.instrument}`);
      }

      const positionSize = calculator.calculatePositionSize(
        tradePlan.accountEquity,
        this.riskConfig.riskPerTradePct,
        tradePlan.entry,
        tradePlan.stop,
        tradePlan.target,
        tradePlan.side,
      );

      reasons.push(`Position size calculated: ${positionSize.quantityLots} lots`);
      reasons.push(`Risk amount: $${positionSize.riskAmount.toFixed(2)}`);
      reasons.push(`Reward-to-risk: ${positionSize.rewardRisk.toFixed(2)}`);

      // Step 2: Validate R:R ratio
      const rrValidation = this.rrCalculator.validate(
        tradePlan.entry,
        tradePlan.stop,
        tradePlan.target,
      );

      if (!rrValidation.valid) {
        const suggestions = this.rrCalculator.suggestCorrections(
          tradePlan.entry,
          tradePlan.stop,
          tradePlan.target,
        );
        reasons.push(...suggestions.suggestions);
      }

      // Step 3: Check all limits
      const limits = this.getRiskLimits(tradePlan.accountEquity);
      const limitCheck = this.limitChecker.checkAllLimits(
        positionSize.riskAmount,
        positionSize.rewardRisk,
        accountState,
        limits,
      );

      // Compile violations and warnings
      reasons.push(...limitCheck.violations);
      warnings.push(...limitCheck.warnings);

      // Final decision
      const approved = limitCheck.allOk && rrValidation.valid;

      if (approved) {
        reasons.push('✓ Trade plan approved - all checks passed');
      } else {
        reasons.push('✗ Trade plan rejected - see violations above');
      }

      return {
        approved,
        positionSize,
        limitCheck,
        reasons,
        warnings,
        inputsUsed: {
          instrument: tradePlan.instrument,
          side: tradePlan.side,
          entry: tradePlan.entry,
          stop: tradePlan.stop,
          target: tradePlan.target,
          accountEquity: tradePlan.accountEquity,
          riskPerTradePct: this.riskConfig.riskPerTradePct,
        },
        computedAt: startTime.toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        approved: false,
        positionSize: {
          quantityLots: 0,
          notionalUSD: 0,
          riskAmount: 0,
          riskPct: 0,
          rewardAmount: 0,
          rewardRisk: 0,
          stopDistance: 0,
          targetDistance: 0,
          pipValuePerLot: 0,
        },
        limitCheck: {
          perTradeOk: false,
          dailyLossOk: false,
          openRiskOk: false,
          maxPositionsOk: false,
          minRROk: false,
          allOk: false,
          violations: [message],
          warnings: [],
        },
        reasons: [`Error validating trade plan: ${message}`],
        warnings: [],
        inputsUsed: {},
        computedAt: startTime.toISOString(),
      };
    }
  }

  /**
   * Get current risk limits based on account equity.
   */
  getRiskLimits(accountEquity: number): RiskLimits {
    const perTradePct = this.riskConfig.riskPerTradePct / 100;
    const dailyLossPct = this.riskConfig.maxDailyLossPct / 100;
    const openRiskPct = this.riskConfig.maxOpenRiskPct / 100;

    return {
      perTradeLimitUSD: Number(new Decimal(accountEquity).times(perTradePct).toFixed(2)),
      dailyLossLimitUSD: Number(new Decimal(accountEquity).times(dailyLossPct).toFixed(2)),
      openRiskLimitUSD: Number(new Decimal(accountEquity).times(openRiskPct).toFixed(2)),
      maxPositions: this.riskConfig.maxPositions,
      minRewardRisk: this.riskConfig.minRewardRisk,
    };
  }

  /**
   * Get configuration state.
   */
  getConfig(): RiskConfig {
    return { ...this.riskConfig };
  }

  /**
   * Get an instrument's data.
   */
  private getInstrument(symbol: InstrumentSymbol): InstrumentData {
    const instrument = this.instruments.get(symbol);
    if (!instrument) {
      throw new Error(`Instrument not found: ${symbol}`);
    }
    return instrument;
  }

  /**
   * Get exposure summary for current account state.
   */
  getExposureSummary(accountState: AccountState, accountEquity: number) {
    const limits = this.getRiskLimits(accountEquity);
    return this.limitChecker.getExposureSummary(accountState, limits);
  }
}
