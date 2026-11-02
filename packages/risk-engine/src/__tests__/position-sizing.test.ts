import { describe, it, expect } from 'vitest';
import { PositionSizingCalculator } from '../engine/position-sizing.js';

const GOLD_PIP_VALUE = 1; // $1 per pip per lot for gold
const GOLD_CONTRACT_SIZE = 100; // 100 oz per lot
const GOLD_PIP_SIZE = 0.01;

const FOREX_PIP_VALUE = 10; // $10 per pip per lot for forex
const FOREX_CONTRACT_SIZE = 100_000; // 100k per lot
const FOREX_PIP_SIZE = 0.0001;

describe('PositionSizingCalculator', () => {
  describe('Determinism', () => {
    it('should produce identical results for identical inputs', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      const result1 = calculator.calculateLots(10_000, 1, 2000, 1990, 'buy');
      const result2 = calculator.calculateLots(10_000, 1, 2000, 1990, 'buy');

      expect(result1).toBe(result2);
    });

    it('should produce consistent position sizes across multiple calls', () => {
      const calculator = new PositionSizingCalculator(FOREX_PIP_VALUE, FOREX_CONTRACT_SIZE, FOREX_PIP_SIZE);

      const results = Array.from({ length: 10 }, () =>
        calculator.calculateLots(50_000, 2, 1.0500, 1.0400, 'buy'),
      );

      const first = results[0];
      expect(results.every((r) => r === first)).toBe(true);
    });
  });

  describe('Buy orders', () => {
    it('should calculate correct lot size for gold buy', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      // Account: $10,000, Risk: 1%, Entry: 2000, Stop: 1990
      // Risk amount: $100
      // Distance: 10 pips
      // Position size: $100 / (10 pips × $1/pip) = 1 lot
      const lots = calculator.calculateLots(10_000, 1, 2000, 1990, 'buy');

      expect(lots).toBe(1);
    });

    it('should calculate correct lot size for forex buy', () => {
      const calculator = new PositionSizingCalculator(FOREX_PIP_VALUE, FOREX_CONTRACT_SIZE, FOREX_PIP_SIZE);

      // Account: $50,000, Risk: 2%, Entry: 1.0500, Stop: 1.0400
      // Risk amount: $1000
      // Distance: 100 pips
      // Position size: $1000 / (100 pips × $10/pip) = 1 lot
      const lots = calculator.calculateLots(50_000, 2, 1.0500, 1.0400, 'buy');

      expect(lots).toBe(1);
    });

    it('should reject when stop is not below entry for buy', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      expect(() => calculator.calculateLots(10_000, 1, 2000, 2010, 'buy')).toThrow(
        'For buy orders, stop must be below entry',
      );
    });

    it('should handle small position sizes', () => {
      const calculator = new PositionSizingCalculator(FOREX_PIP_VALUE, FOREX_CONTRACT_SIZE, FOREX_PIP_SIZE);

      // Very small account with large risk distance
      const lots = calculator.calculateLots(1000, 0.5, 1.0000, 1.0900, 'buy');

      expect(lots).toBeGreaterThan(0);
      expect(lots).toBeLessThan(0.1);
    });
  });

  describe('Sell orders', () => {
    it('should calculate correct lot size for gold sell', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      // Account: $10,000, Risk: 1%, Entry: 1990, Stop: 2000
      // Risk amount: $100
      // Distance: 10 pips
      // Position size: $100 / (10 pips × $1/pip) = 1 lot
      const lots = calculator.calculateLots(10_000, 1, 1990, 2000, 'sell');

      expect(lots).toBe(1);
    });

    it('should calculate correct lot size for forex sell', () => {
      const calculator = new PositionSizingCalculator(FOREX_PIP_VALUE, FOREX_CONTRACT_SIZE, FOREX_PIP_SIZE);

      // Account: $50,000, Risk: 2%, Entry: 1.0400, Stop: 1.0500
      const lots = calculator.calculateLots(50_000, 2, 1.0400, 1.0500, 'sell');

      expect(lots).toBe(1);
    });

    it('should reject when stop is not above entry for sell', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      expect(() => calculator.calculateLots(10_000, 1, 2000, 1990, 'sell')).toThrow(
        'For sell orders, stop must be above entry',
      );
    });
  });

  describe('Full position size calculation', () => {
    it('should calculate complete position details', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      const result = calculator.calculatePositionSize(10_000, 1, 2000, 1990, 2010, 'buy');

      expect(result.quantityLots).toBe(1);
      expect(result.riskAmount).toBe(100); // 10 pips × $1/pip × 1 lot
      expect(result.rewardAmount).toBe(200); // 20 pips × $1/pip × 1 lot
      expect(result.rewardRisk).toBe(2); // 200/100
      expect(result.stopDistance).toBe(10);
      expect(result.targetDistance).toBe(20);
      expect(result.pipValuePerLot).toBe(GOLD_PIP_VALUE);
      expect(result.notionalUSD).toBeGreaterThan(0);
    });

    it('should handle different account sizes', () => {
      const calculator = new PositionSizingCalculator(FOREX_PIP_VALUE, FOREX_CONTRACT_SIZE, FOREX_PIP_SIZE);

      const small = calculator.calculatePositionSize(5_000, 1, 1.0500, 1.0400, 1.0600, 'buy');
      const large = calculator.calculatePositionSize(50_000, 1, 1.0500, 1.0400, 1.0600, 'buy');

      expect(large.quantityLots).toBe(small.quantityLots * 10);
      expect(large.riskAmount).toBe(small.riskAmount * 10);
    });

    it('should handle different risk percentages', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      const conservative = calculator.calculatePositionSize(10_000, 0.5, 2000, 1990, 2010, 'buy');
      const aggressive = calculator.calculatePositionSize(10_000, 2, 2000, 1990, 2010, 'buy');

      expect(aggressive.quantityLots).toBe(conservative.quantityLots * 4);
      expect(aggressive.riskAmount).toBe(conservative.riskAmount * 4);
    });
  });

  describe('Edge cases', () => {
    it('should throw on zero or negative account equity', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      expect(() => calculator.calculateLots(0, 1, 2000, 1990, 'buy')).toThrow('accountEquity must be positive');
      expect(() => calculator.calculateLots(-1000, 1, 2000, 1990, 'buy')).toThrow('accountEquity must be positive');
    });

    it('should throw on invalid risk percentage', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      expect(() => calculator.calculateLots(10_000, 0, 2000, 1990, 'buy')).toThrow('riskPerTradePct must be positive');
      expect(() => calculator.calculateLots(10_000, -1, 2000, 1990, 'buy')).toThrow('riskPerTradePct must be positive');
    });

    it('should throw on invalid prices', () => {
      const calculator = new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE);

      expect(() => calculator.calculateLots(10_000, 1, 0, 1990, 'buy')).toThrow('entry must be positive');
      expect(() => calculator.calculateLots(10_000, 1, 2000, -1990, 'buy')).toThrow('stop must be positive');
    });

    it('should throw on invalid pip configuration', () => {
      expect(() => new PositionSizingCalculator(0, GOLD_CONTRACT_SIZE, GOLD_PIP_SIZE)).toThrow(
        'pipValuePerLot must be positive',
      );

      expect(() => new PositionSizingCalculator(GOLD_PIP_VALUE, 0, GOLD_PIP_SIZE)).toThrow(
        'contractSize must be positive',
      );

      expect(() => new PositionSizingCalculator(GOLD_PIP_VALUE, GOLD_CONTRACT_SIZE, 0)).toThrow(
        'pipSize must be positive',
      );
    });
  });

  describe('Precision', () => {
    it('should maintain decimal precision', () => {
      const calculator = new PositionSizingCalculator(1.5, 250, 0.001);

      const result = calculator.calculateLots(7_500, 1.5, 1.2345, 1.2300, 'buy');

      // Should be rounded to 2 decimal places
      expect(result.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });

    it('should round consistently', () => {
      const calculator = new PositionSizingCalculator(FOREX_PIP_VALUE, FOREX_CONTRACT_SIZE, FOREX_PIP_SIZE);

      const result1 = calculator.calculatePositionSize(9_999, 1, 1.0501, 1.0401, 1.0601, 'buy');
      const result2 = calculator.calculatePositionSize(10_001, 1, 1.0501, 1.0401, 1.0601, 'buy');

      // Similar results, not exact due to rounding
      expect(Math.abs(result1.quantityLots - result2.quantityLots)).toBeLessThan(0.5);
    });
  });
});
