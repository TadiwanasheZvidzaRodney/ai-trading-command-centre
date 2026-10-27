import type { RiskConfig } from '@atc/shared';
import type { Env } from './env.js';

export function riskConfigFromEnv(env: Env): RiskConfig {
  return {
    accountCurrency: 'USD',
    startingBalance: env.PAPER_STARTING_BALANCE,
    riskPerTradePct: env.PAPER_RISK_PER_TRADE_PCT,
    maxDailyLossPct: env.PAPER_MAX_DAILY_LOSS_PCT,
    maxOpenRiskPct: env.PAPER_MAX_OPEN_RISK_PCT,
    maxPositions: env.PAPER_MAX_POSITIONS,
    minRewardRisk: env.PAPER_MIN_RR,
    maxSpreadPips: {
      'XAU/USD': 35,
      'EUR/USD': 2,
      'GBP/USD': 2.5,
    },
    eventBlackoutMinutes: 30,
    killSwitch: false,
  };
}
