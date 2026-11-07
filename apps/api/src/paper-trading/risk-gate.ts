import {
  INSTRUMENTS,
  type InstrumentSymbol,
  type OrderSide,
  type RiskConfig,
} from '@atc/shared';
import { LimitChecker, type AccountState } from '@atc/risk-engine';

export type RiskRejectionCode =
  | 'KILL_SWITCH'
  | 'SPREAD_LIMIT'
  | 'SPREAD_UNAVAILABLE'
  | 'EVENT_BLACKOUT'
  | 'CORRELATION_LIMIT'
  | 'MAX_LEVERAGE'
  | 'PER_TRADE_RISK'
  | 'DAILY_LOSS_LIMIT'
  | 'OPEN_RISK_LIMIT'
  | 'MAX_POSITIONS'
  | 'MIN_REWARD_RISK'
  | 'POSITION_TOO_SMALL'
  | 'INVALID_PLAN';

export interface KillSwitchState {
  enabled: boolean;
  reason?: string;
  updatedAt?: string;
}

export interface RiskOpenPosition {
  instrument: InstrumentSymbol;
  side: OrderSide;
  quantityLots: number;
  entryPrice: number;
  stopLoss: number;
  riskAmount: number;
}

export interface RiskOpenOrder {
  instrument: InstrumentSymbol;
  side: OrderSide;
  quantityLots: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  createdAt: string;
}

export interface RiskGateInput {
  instrument: InstrumentSymbol;
  side: OrderSide;
  entry: number;
  stop: number;
  target: number;
  quantityLots: number;
  equity: number;
  dailyPnL: number;
  openPositions: RiskOpenPosition[];
  openOrders: RiskOpenOrder[];
  /** Current spread in pips, or null when the quote is unavailable. */
  spreadPips: number | null;
  /** Minutes until the next high-impact event, or null when unknown. */
  nextHighImpactMinutes: number | null;
  killSwitch: KillSwitchState;
  riskConfig: RiskConfig;
  /** Correlation above which same-direction positions are considered one risk. */
  correlationThreshold?: number;
}

export interface RiskCheck {
  id: RiskRejectionCode | 'OK';
  ok: boolean;
  detail: string;
}

export interface RiskGateResult {
  approved: boolean;
  code: RiskRejectionCode | null;
  reasons: string[];
  warnings: string[];
  checks: RiskCheck[];
  riskAmount: number;
  riskPct: number;
  rewardRisk: number;
  notionalUSD: number;
  leverage: number;
  stopDistance: number;
  targetDistance: number;
  quantityLots: number;
}

/** Static correlation assumptions used until a supported correlation feed exists. */
const CORRELATION_MATRIX: Record<InstrumentSymbol, Partial<Record<InstrumentSymbol, number>>> = {
  'EUR/USD': { 'EUR/USD': 1, 'GBP/USD': 0.85, 'XAU/USD': 0.4 },
  'GBP/USD': { 'GBP/USD': 1, 'EUR/USD': 0.85, 'XAU/USD': 0.35 },
  'XAU/USD': { 'XAU/USD': 1, 'EUR/USD': 0.4, 'GBP/USD': 0.35 },
};

export function correlationBetween(a: InstrumentSymbol, b: InstrumentSymbol): number {
  return CORRELATION_MATRIX[a]?.[b] ?? 0;
}

const VIOLATION_CODES: Array<{ prefix: string; code: RiskRejectionCode }> = [
  { prefix: 'Per-trade risk', code: 'PER_TRADE_RISK' },
  { prefix: 'Daily loss', code: 'DAILY_LOSS_LIMIT' },
  { prefix: 'Total open risk', code: 'OPEN_RISK_LIMIT' },
  { prefix: 'Would have', code: 'MAX_POSITIONS' },
  { prefix: 'Reward-to-risk', code: 'MIN_REWARD_RISK' },
];

function codeForViolation(message: string): RiskRejectionCode {
  const match = VIOLATION_CODES.find((entry) => message.startsWith(entry.prefix));
  return match?.code ?? 'INVALID_PLAN';
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

export function evaluateRisk(input: RiskGateInput): RiskGateResult {
  const checks: RiskCheck[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];

  const spec = INSTRUMENTS[input.instrument];
  const contractSize = spec.contractSize;
  const stopDistance = Math.abs(input.entry - input.stop);
  const targetDistance = Math.abs(input.target - input.entry);
  const riskAmount = round(stopDistance * contractSize * input.quantityLots);
  const notionalUSD = round(input.entry * contractSize * input.quantityLots);
  const leverage = input.equity > 0 ? round(notionalUSD / input.equity, 2) : 0;
  const riskPct = input.equity > 0 ? round((riskAmount / input.equity) * 100) : 0;
  const rewardRisk = stopDistance > 0 ? round(targetDistance / stopDistance) : 0;

  const reject = (code: RiskRejectionCode, detail: string): void => {
    checks.push({ id: code, ok: false, detail });
    reasons.push(detail);
  };
  const pass = (id: RiskCheck['id'], detail: string): void => {
    checks.push({ id, ok: true, detail });
  };

  // 1. Kill switch is absolute.
  if (input.killSwitch.enabled) {
    reject(
      'KILL_SWITCH',
      `Kill switch is enabled${input.killSwitch.reason ? `: ${input.killSwitch.reason}` : ''}. No new paper orders are accepted.`,
    );
  } else {
    pass('OK', 'Kill switch is off');
  }

  // 2. Plan sanity: stop and target must be on the correct side of entry.
  const stopValid =
    input.side === 'buy' ? input.stop < input.entry : input.stop > input.entry;
  const targetValid =
    input.side === 'buy' ? input.target > input.entry : input.target < input.entry;
  if (!stopValid) {
    reject('INVALID_PLAN', 'Stop loss is on the wrong side of entry');
  } else if (!targetValid) {
    reject('INVALID_PLAN', 'Take profit is on the wrong side of entry');
  } else if (input.quantityLots < spec.minLot) {
    reject(
      'POSITION_TOO_SMALL',
      `Position size ${input.quantityLots} lots is below minimum ${spec.minLot}`,
    );
  } else {
    pass('OK', 'Trade plan prices and position size are valid');
  }

  // 3. Spread must be known and within the instrument limit.
  const maxSpread = input.riskConfig.maxSpreadPips[input.instrument];
  if (input.spreadPips === null || !Number.isFinite(input.spreadPips)) {
    reject(
      'SPREAD_UNAVAILABLE',
      'Current spread is unavailable. Orders fail closed until a quote is available.',
    );
  } else if (input.spreadPips > maxSpread) {
    reject(
      'SPREAD_LIMIT',
      `Spread ${input.spreadPips.toFixed(2)} pips exceeds limit of ${maxSpread} pips`,
    );
  } else if (input.spreadPips < 0) {
    reject('SPREAD_LIMIT', 'Spread cannot be negative');
  } else {
    pass('OK', `Spread ${input.spreadPips.toFixed(2)} pips is within ${maxSpread} pips`);
  }

  // 4. Event blackout.
  if (input.nextHighImpactMinutes !== null) {
    if (input.nextHighImpactMinutes <= input.riskConfig.eventBlackoutMinutes) {
      reject(
        'EVENT_BLACKOUT',
        `High-impact event in ${input.nextHighImpactMinutes} minute(s); blackout is ${input.riskConfig.eventBlackoutMinutes} minute(s)`,
      );
    } else {
      pass(
        'OK',
        `Next high-impact event is ${input.nextHighImpactMinutes} minute(s) away`,
      );
    }
  } else {
    warnings.push(
      'High-impact event data is unavailable; blackout could not be verified.',
    );
  }

  // 5. Correlation: same-direction correlated exposure is treated as one risk.
  const threshold = input.correlationThreshold ?? 0.7;
  const correlated = [
    ...input.openPositions.map((position) => ({
      instrument: position.instrument,
      side: position.side,
    })),
    ...input.openOrders.map((order) => ({
      instrument: order.instrument,
      side: order.side,
    })),
  ].find(
    (existing) =>
      existing.side === input.side &&
      correlationBetween(existing.instrument, input.instrument) >= threshold,
  );
  if (correlated) {
    reject(
      'CORRELATION_LIMIT',
      `Same-direction ${correlated.instrument} exposure is correlated ${correlationBetween(correlated.instrument, input.instrument)} with ${input.instrument} (threshold ${threshold})`,
    );
  } else {
    pass('OK', 'No correlated same-direction exposure');
  }

  // 6. Leverage / notional exposure.
  const maxLeverage = input.riskConfig.maxLeverage ?? 30;
  if (leverage > maxLeverage) {
    reject(
      'MAX_LEVERAGE',
      `Leverage ${leverage.toFixed(1)}x exceeds limit of ${maxLeverage}x`,
    );
  } else {
    pass('OK', `Leverage ${leverage.toFixed(1)}x is within ${maxLeverage}x`);
  }

  // 7. Core limits from @atc/risk-engine.
  const accountEquity = Math.max(0, input.equity);
  const limits = {
    perTradeLimitUSD: round((accountEquity * input.riskConfig.riskPerTradePct) / 100),
    dailyLossLimitUSD: round((accountEquity * input.riskConfig.maxDailyLossPct) / 100),
    openRiskLimitUSD: round((accountEquity * input.riskConfig.maxOpenRiskPct) / 100),
    maxPositions: input.riskConfig.maxPositions,
    minRewardRisk: input.riskConfig.minRewardRisk,
  };

  const accountState: AccountState = {
    equity: accountEquity,
    dailyPnL: input.dailyPnL,
    openPositions: input.openPositions.map((position, index) => ({
      id: `open-${index}`,
      instrument: position.instrument,
      side: position.side,
      quantityLots: position.quantityLots,
      entryPrice: position.entryPrice,
      currentPrice: position.entryPrice,
      unrealizedPnL: 0,
      riskAmount: position.riskAmount,
    })),
    openOrders: input.openOrders.map((order, index) => ({
      id: `order-${index}`,
      instrument: order.instrument,
      side: order.side,
      quantityLots: order.quantityLots,
      requestedPrice: null,
      stopLoss: order.stopLoss,
      takeProfit: order.targetPrice,
      createdAt: order.createdAt,
    })),
  };

  const limitCheck = new LimitChecker().checkAllLimits(
    riskAmount,
    rewardRisk,
    accountState,
    limits,
  );

  if (limitCheck.violations.length === 0) {
    pass('OK', 'Per-trade, daily loss, open risk and position-count limits pass');
  } else {
    for (const violation of limitCheck.violations) {
      reject(codeForViolation(violation), violation);
    }
  }
  warnings.push(...limitCheck.warnings);

  const firstFailure = checks.find((check) => !check.ok);

  return {
    approved: firstFailure === undefined,
    code: firstFailure?.id === 'OK' ? null : (firstFailure?.id as RiskRejectionCode) ?? null,
    reasons,
    warnings,
    checks,
    riskAmount,
    riskPct,
    rewardRisk,
    notionalUSD,
    leverage,
    stopDistance,
    targetDistance,
    quantityLots: input.quantityLots,
  };
}
