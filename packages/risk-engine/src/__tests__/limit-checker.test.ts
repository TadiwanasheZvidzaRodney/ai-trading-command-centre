import { describe, it, expect } from 'vitest';
import type { AccountState, RiskLimits } from '../types.js';
import { LimitChecker } from '../engine/limit-checker.js';

describe('LimitChecker', () => {
  const checker = new LimitChecker();

  const createAccountState = (overrides?: Partial<AccountState>): AccountState => ({
    equity: 10_000,
    dailyPnL: 0,
    openPositions: [],
    openOrders: [],
    ...overrides,
  });

  const createLimits = (overrides?: Partial<RiskLimits>): RiskLimits => ({
    perTradeLimitUSD: 100,
    dailyLossLimitUSD: 300,
    openRiskLimitUSD: 500,
    maxPositions: 3,
    minRewardRisk: 1.5,
    ...overrides,
  });

  describe('Per-trade limit', () => {
    it('should approve when risk is below limit', () => {
      const state = createAccountState();
      const limits = createLimits();
      const result = checker.checkAllLimits(50, 2, state, limits);

      expect(result.perTradeOk).toBe(true);
      expect(result.violations).not.toContainEqual(expect.stringContaining('Per-trade risk'));
    });

    it('should reject when risk exceeds limit', () => {
      const state = createAccountState();
      const limits = createLimits();
      const result = checker.checkAllLimits(150, 2, state, limits);

      expect(result.perTradeOk).toBe(false);
      expect(result.violations).toContainEqual(
        expect.stringContaining('Per-trade risk $150.00 exceeds limit of $100.00'),
      );
    });

    it('should approve when risk equals limit', () => {
      const state = createAccountState();
      const limits = createLimits();
      const result = checker.checkAllLimits(100, 2, state, limits);

      expect(result.perTradeOk).toBe(true);
    });
  });

  describe('Daily loss limit', () => {
    it('should approve when daily PnL is neutral', () => {
      const state = createAccountState({ dailyPnL: 0 });
      const limits = createLimits();
      const result = checker.checkAllLimits(50, 2, state, limits);

      expect(result.dailyLossOk).toBe(true);
    });

    it('should approve when daily loss is below limit', () => {
      const state = createAccountState({ dailyPnL: -100 });
      const limits = createLimits();
      const result = checker.checkAllLimits(50, 2, state, limits);

      expect(result.dailyLossOk).toBe(true);
    });

    it('should reject when daily loss exceeds limit', () => {
      const state = createAccountState({ dailyPnL: -500 });
      const limits = createLimits();
      const result = checker.checkAllLimits(50, 2, state, limits);

      expect(result.dailyLossOk).toBe(false);
      expect(result.violations).toContainEqual(
        expect.stringContaining('Daily loss $500.00 exceeds limit of $300.00'),
      );
    });

    it('should only count losses, not gains', () => {
      const state = createAccountState({ dailyPnL: 1000 });
      const limits = createLimits();
      const result = checker.checkAllLimits(50, 2, state, limits);

      expect(result.dailyLossOk).toBe(true);
    });
  });

  describe('Open risk limit', () => {
    it('should approve with no open positions', () => {
      const state = createAccountState();
      const limits = createLimits();
      const result = checker.checkAllLimits(200, 2, state, limits);

      expect(result.openRiskOk).toBe(true);
    });

    it('should calculate open risk from positions', () => {
      const state = createAccountState({
        openPositions: [
          {
            id: '1',
            instrument: 'EUR/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 1.05,
            currentPrice: 1.055,
            unrealizedPnL: 50,
            riskAmount: 100,
          },
        ],
      });
      const limits = createLimits({ openRiskLimitUSD: 500 });
      const result = checker.checkAllLimits(200, 2, state, limits);

      // 100 + 200 = 300, which is below 500 limit
      expect(result.openRiskOk).toBe(true);
    });

    it('should reject when total risk exceeds limit', () => {
      const state = createAccountState({
        openPositions: [
          {
            id: '1',
            instrument: 'EUR/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 1.05,
            currentPrice: 1.055,
            unrealizedPnL: 50,
            riskAmount: 400,
          },
        ],
      });
      const limits = createLimits({ openRiskLimitUSD: 500 });
      const result = checker.checkAllLimits(200, 2, state, limits);

      // 400 + 200 = 600, which exceeds 500 limit
      expect(result.openRiskOk).toBe(false);
      expect(result.violations).toContainEqual(
        expect.stringContaining('Total open risk $600.00 would exceed limit of $500.00'),
      );
    });
  });

  describe('Max positions limit', () => {
    it('should approve with room for more positions', () => {
      const state = createAccountState({
        openPositions: [
          {
            id: '1',
            instrument: 'EUR/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 1.05,
            currentPrice: 1.055,
            unrealizedPnL: 50,
            riskAmount: 100,
          },
        ],
      });
      const limits = createLimits({ maxPositions: 3 });
      const result = checker.checkAllLimits(50, 2, state, limits);

      expect(result.maxPositionsOk).toBe(true);
    });

    it('should count both positions and pending orders', () => {
      const state = createAccountState({
        openPositions: [
          {
            id: '1',
            instrument: 'EUR/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 1.05,
            currentPrice: 1.055,
            unrealizedPnL: 50,
            riskAmount: 100,
          },
        ],
        openOrders: [
          {
            id: '2',
            instrument: 'GBP/USD',
            side: 'sell',
            quantityLots: 1,
            requestedPrice: null,
            stopLoss: 1.3,
            takeProfit: 1.26,
            createdAt: new Date().toISOString(),
          },
          {
            id: '3',
            instrument: 'XAU/USD',
            side: 'buy',
            quantityLots: 1,
            requestedPrice: null,
            stopLoss: 1900,
            takeProfit: 2050,
            createdAt: new Date().toISOString(),
          },
        ],
      });
      const limits = createLimits({ maxPositions: 3 });
      const result = checker.checkAllLimits(50, 2, state, limits);

      // 1 position + 2 orders = 3, would need 4 for new trade
      expect(result.maxPositionsOk).toBe(false);
      expect(result.violations).toContainEqual(
        expect.stringContaining('Would have 4 positions (current: 1, pending: 2), limit is 3'),
      );
    });

    it('should reject when at capacity', () => {
      const state = createAccountState({
        openPositions: [
          {
            id: '1',
            instrument: 'EUR/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 1.05,
            currentPrice: 1.055,
            unrealizedPnL: 50,
            riskAmount: 100,
          },
          {
            id: '2',
            instrument: 'GBP/USD',
            side: 'sell',
            quantityLots: 1,
            entryPrice: 1.28,
            currentPrice: 1.275,
            unrealizedPnL: 50,
            riskAmount: 100,
          },
          {
            id: '3',
            instrument: 'XAU/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 2000,
            currentPrice: 2005,
            unrealizedPnL: 50,
            riskAmount: 100,
          },
        ],
      });
      const limits = createLimits({ maxPositions: 3 });
      const result = checker.checkAllLimits(50, 2, state, limits);

      expect(result.maxPositionsOk).toBe(false);
    });
  });

  describe('Min R:R limit', () => {
    it('should approve when R:R meets minimum', () => {
      const state = createAccountState();
      const limits = createLimits({ minRewardRisk: 1.5 });
      const result = checker.checkAllLimits(50, 1.5, state, limits);

      expect(result.minRROk).toBe(true);
    });

    it('should reject when R:R below minimum', () => {
      const state = createAccountState();
      const limits = createLimits({ minRewardRisk: 1.5 });
      const result = checker.checkAllLimits(50, 1, state, limits);

      expect(result.minRROk).toBe(false);
      expect(result.violations).toContainEqual(
        expect.stringContaining('Reward-to-risk ratio 1.00 is below minimum of 1.50'),
      );
    });

    it('should approve when R:R exceeds minimum', () => {
      const state = createAccountState();
      const limits = createLimits({ minRewardRisk: 1.5 });
      const result = checker.checkAllLimits(50, 3, state, limits);

      expect(result.minRROk).toBe(true);
    });
  });

  describe('All limits combined', () => {
    it('should approve when all limits pass', () => {
      const state = createAccountState();
      const limits = createLimits();
      const result = checker.checkAllLimits(50, 2, state, limits);

      expect(result.allOk).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should reject when any single limit fails', () => {
      const state = createAccountState();
      const limits = createLimits();
      const result = checker.checkAllLimits(150, 2, state, limits); // Exceeds per-trade

      expect(result.allOk).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should collect all violations', () => {
      const state = createAccountState({
        dailyPnL: -500, // Exceeds daily loss
        openPositions: [
          {
            id: '1',
            instrument: 'EUR/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 1.05,
            currentPrice: 1.055,
            unrealizedPnL: 50,
            riskAmount: 400,
          },
        ],
      });
      const limits = createLimits();
      const result = checker.checkAllLimits(200, 1, state, limits); // Multiple violations

      expect(result.allOk).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Exposure summary', () => {
    it('should provide exposure information', () => {
      const state = createAccountState({
        openPositions: [
          {
            id: '1',
            instrument: 'EUR/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 1.05,
            currentPrice: 1.055,
            unrealizedPnL: 50,
            riskAmount: 100,
          },
        ],
      });
      const limits = createLimits();
      const summary = checker.getExposureSummary(state, limits);

      expect(summary.openRisk).toBe(100);
      expect(summary.openRiskLimit).toBe(500);
      expect(summary.riskRemaining).toBe(400);
      expect(summary.openPositions).toBe(1);
      expect(summary.positionsRemaining).toBe(2);
    });

    it('should calculate risk percentage', () => {
      const state = createAccountState({
        equity: 10_000,
        openPositions: [
          {
            id: '1',
            instrument: 'EUR/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 1.05,
            currentPrice: 1.055,
            unrealizedPnL: 50,
            riskAmount: 500, // 5% of equity
          },
        ],
      });
      const limits = createLimits();
      const summary = checker.getExposureSummary(state, limits);

      expect(summary.riskPct).toBe(5);
    });
  });
});
