import { describe, it, expect } from 'vitest';
import type { RiskEngineConfig, AccountState } from '../types.js';
import { RiskEngine } from '../engine/index.js';

const mockConfig: RiskEngineConfig = {
  riskConfig: {
    accountCurrency: 'USD',
    startingBalance: 10_000,
    riskPerTradePct: 1,
    maxDailyLossPct: 3,
    maxOpenRiskPct: 5,
    maxPositions: 3,
    minRewardRisk: 1.5,
    maxSpreadPips: {
      'XAU/USD': 35,
      'EUR/USD': 2,
      'GBP/USD': 2.5,
    },
    eventBlackoutMinutes: 30,
    killSwitch: false,
  },
  instruments: {
    'XAU/USD': {
      symbol: 'XAU/USD',
      pipSize: 0.01,
      contractSize: 100,
      currentBid: 2000,
      currentAsk: 2000.5,
    },
    'EUR/USD': {
      symbol: 'EUR/USD',
      pipSize: 0.0001,
      contractSize: 100_000,
      currentBid: 1.0500,
      currentAsk: 1.0501,
    },
    'GBP/USD': {
      symbol: 'GBP/USD',
      pipSize: 0.0001,
      contractSize: 100_000,
      currentBid: 1.2800,
      currentAsk: 1.2801,
    },
  },
};

describe('RiskEngine', () => {
  const createAccountState = (overrides?: Partial<AccountState>): AccountState => ({
    equity: 10_000,
    dailyPnL: 0,
    openPositions: [],
    openOrders: [],
    ...overrides,
  });

  describe('Initialization', () => {
    it('should initialize with valid config', () => {
      const engine = new RiskEngine(mockConfig);
      expect(engine).toBeDefined();
    });

    it('should load instrument data', () => {
      const engine = new RiskEngine(mockConfig);
      const config = engine.getConfig();
      expect(config.accountCurrency).toBe('USD');
    });
  });

  describe('Risk limits calculation', () => {
    it('should calculate per-trade limit', () => {
      const engine = new RiskEngine(mockConfig);
      const limits = engine.getRiskLimits(10_000);

      expect(limits.perTradeLimitUSD).toBe(100); // 1% of 10,000
    });

    it('should calculate daily loss limit', () => {
      const engine = new RiskEngine(mockConfig);
      const limits = engine.getRiskLimits(10_000);

      expect(limits.dailyLossLimitUSD).toBe(300); // 3% of 10,000
    });

    it('should calculate open risk limit', () => {
      const engine = new RiskEngine(mockConfig);
      const limits = engine.getRiskLimits(10_000);

      expect(limits.openRiskLimitUSD).toBe(500); // 5% of 10,000
    });

    it('should scale limits with account size', () => {
      const engine = new RiskEngine(mockConfig);
      const smallLimits = engine.getRiskLimits(5_000);
      const largeLimits = engine.getRiskLimits(20_000);

      expect(largeLimits.perTradeLimitUSD).toBe(smallLimits.perTradeLimitUSD * 4);
    });
  });

  describe('Trade plan validation', () => {
    it('should approve valid trade plan', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.approved).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should reject trade with poor R:R', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0550, // Only 1:1 R:R, need 1.5:1
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.approved).toBe(false);
      expect(result.reasons.some((r) => r.includes('below minimum'))).toBe(true);
    });

    it('should reject trade exceeding per-trade risk', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      // Create a trade with very tight stop that would require huge position
      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0499, // Only 1 pip stop
          target: 1.0525, // Trying to get good R:R
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.approved).toBe(false);
    });

    it('should include position size in result', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.positionSize.quantityLots).toBeGreaterThan(0);
      expect(result.positionSize.riskAmount).toBeGreaterThan(0);
      expect(result.positionSize.rewardRisk).toBeGreaterThan(0);
    });

    it('should include limit check results', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.limitCheck).toBeDefined();
      expect(result.limitCheck.allOk).toBe(result.approved);
    });
  });

  describe('Gold trading', () => {
    it('should handle gold trade validation', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      const result = engine.validateTradePlan(
        {
          instrument: 'XAU/USD',
          side: 'buy',
          entry: 2000,
          stop: 1990,
          target: 2030,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.approved).toBe(true);
      expect(result.positionSize.quantityLots).toBeGreaterThan(0);
    });
  });

  describe('Account state impact', () => {
    it('should reject when daily loss limit exceeded', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState({ dailyPnL: -400 }); // Exceeds 3% limit

      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.approved).toBe(false);
      expect(result.limitCheck.dailyLossOk).toBe(false);
    });

    it('should reject when max positions reached', () => {
      const engine = new RiskEngine(mockConfig);
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
            riskAmount: 50,
          },
          {
            id: '2',
            instrument: 'GBP/USD',
            side: 'sell',
            quantityLots: 1,
            entryPrice: 1.28,
            currentPrice: 1.275,
            unrealizedPnL: 50,
            riskAmount: 50,
          },
          {
            id: '3',
            instrument: 'XAU/USD',
            side: 'buy',
            quantityLots: 1,
            entryPrice: 2000,
            currentPrice: 2005,
            unrealizedPnL: 50,
            riskAmount: 50,
          },
        ],
      });

      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.approved).toBe(false);
      expect(result.limitCheck.maxPositionsOk).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle unsupported instrument gracefully', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result).toBeDefined();
      expect(result.computedAt).toBeDefined();
    });

    it('should include inputs used in result', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      const result = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result.inputsUsed.entry).toBe(1.0500);
      expect(result.inputsUsed.stop).toBe(1.0400);
      expect(result.inputsUsed.instrument).toBe('EUR/USD');
    });
  });

  describe('Determinism', () => {
    it('should produce identical results for same inputs', () => {
      const engine = new RiskEngine(mockConfig);
      const state = createAccountState();

      const result1 = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      const result2 = engine.validateTradePlan(
        {
          instrument: 'EUR/USD',
          side: 'buy',
          entry: 1.0500,
          stop: 1.0400,
          target: 1.0650,
          accountEquity: 10_000,
          accountCurrency: 'USD',
        },
        state,
      );

      expect(result1.approved).toBe(result2.approved);
      expect(result1.positionSize.quantityLots).toBe(result2.positionSize.quantityLots);
    });
  });

  describe('Exposure summary', () => {
    it('should provide exposure information', () => {
      const engine = new RiskEngine(mockConfig);
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

      const summary = engine.getExposureSummary(state, 10_000);

      expect(summary.openRisk).toBe(100);
      expect(summary.openPositions).toBe(1);
      expect(summary.riskRemaining).toBe(400); // 500 limit - 100 open
    });
  });
});
