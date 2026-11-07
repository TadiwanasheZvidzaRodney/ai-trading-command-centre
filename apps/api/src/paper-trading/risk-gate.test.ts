import { DEFAULT_RISK_CONFIG } from '@atc/shared';
import { describe, expect, it } from 'vitest';
import { evaluateRisk, type RiskGateInput } from './risk-gate.js';

const base: RiskGateInput = {
  instrument: 'EUR/USD',
  side: 'buy',
  entry: 1.05,
  stop: 1.04,
  target: 1.065,
  quantityLots: 0.1,
  equity: 10_000,
  dailyPnL: 0,
  openPositions: [],
  openOrders: [],
  spreadPips: 1,
  nextHighImpactMinutes: 120,
  killSwitch: { enabled: false },
  riskConfig: DEFAULT_RISK_CONFIG,
};

describe('evaluateRisk', () => {
  it('approves a plan that satisfies every limit', () => {
    const result = evaluateRisk(base);
    expect(result.approved).toBe(true);
    expect(result.code).toBeNull();
    expect(result.riskAmount).toBe(100);
    expect(result.rewardRisk).toBe(1.5);
  });

  it('rejects everything when the kill switch is on', () => {
    const result = evaluateRisk({
      ...base,
      killSwitch: { enabled: true, reason: 'manual halt' },
    });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('KILL_SWITCH');
    expect(result.reasons[0]).toContain('manual halt');
  });

  it('fails closed when the spread is unavailable', () => {
    const result = evaluateRisk({ ...base, spreadPips: null });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('SPREAD_UNAVAILABLE');
  });

  it('rejects a spread above the instrument limit', () => {
    const result = evaluateRisk({ ...base, spreadPips: 5 });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('SPREAD_LIMIT');
  });

  it('rejects inside the high-impact event blackout', () => {
    const result = evaluateRisk({ ...base, nextHighImpactMinutes: 10 });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('EVENT_BLACKOUT');
  });

  it('warns rather than crashing when event data is unavailable', () => {
    const result = evaluateRisk({ ...base, nextHighImpactMinutes: null });
    expect(result.approved).toBe(true);
    expect(result.warnings.join(' ')).toContain('blackout could not be verified');
  });

  it('rejects correlated same-direction exposure', () => {
    const result = evaluateRisk({
      ...base,
      instrument: 'GBP/USD',
      entry: 1.27,
      stop: 1.26,
      target: 1.285,
      openPositions: [
        {
          instrument: 'EUR/USD',
          side: 'buy',
          quantityLots: 0.1,
          entryPrice: 1.05,
          stopLoss: 1.04,
          riskAmount: 100,
        },
      ],
    });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('CORRELATION_LIMIT');
  });

  it('allows opposite-direction correlated exposure', () => {
    const result = evaluateRisk({
      ...base,
      instrument: 'GBP/USD',
      entry: 1.27,
      stop: 1.26,
      target: 1.285,
      openPositions: [
        {
          instrument: 'EUR/USD',
          side: 'sell',
          quantityLots: 0.1,
          entryPrice: 1.05,
          stopLoss: 1.06,
          riskAmount: 100,
        },
      ],
    });
    expect(result.approved).toBe(true);
  });

  it('rejects leverage above the configured maximum', () => {
    const result = evaluateRisk({
      ...base,
      quantityLots: 5,
      riskConfig: { ...DEFAULT_RISK_CONFIG, maxPositions: 50 },
    });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('MAX_LEVERAGE');
  });

  it('rejects per-trade risk above the configured percentage', () => {
    const result = evaluateRisk({
      ...base,
      quantityLots: 0.2,
      riskConfig: { ...DEFAULT_RISK_CONFIG, maxPositions: 50 },
    });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('PER_TRADE_RISK');
  });

  it('rejects a reward-to-risk ratio below the minimum', () => {
    const result = evaluateRisk({ ...base, target: 1.055 });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('MIN_REWARD_RISK');
  });

  it('rejects when the daily loss limit is already breached', () => {
    const result = evaluateRisk({ ...base, dailyPnL: -500 });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('DAILY_LOSS_LIMIT');
  });

  it('rejects when the position count limit is reached', () => {
    const result = evaluateRisk({
      ...base,
      openPositions: [
        { instrument: 'XAU/USD', side: 'buy', quantityLots: 0.01, entryPrice: 2000, stopLoss: 1990, riskAmount: 10 },
        { instrument: 'XAU/USD', side: 'sell', quantityLots: 0.01, entryPrice: 2000, stopLoss: 2010, riskAmount: 10 },
        { instrument: 'XAU/USD', side: 'buy', quantityLots: 0.01, entryPrice: 2000, stopLoss: 1990, riskAmount: 10 },
      ],
    });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('MAX_POSITIONS');
  });

  it('rejects a stop on the wrong side of entry', () => {
    const result = evaluateRisk({ ...base, stop: 1.06 });
    expect(result.approved).toBe(false);
    expect(result.code).toBe('INVALID_PLAN');
  });
});
