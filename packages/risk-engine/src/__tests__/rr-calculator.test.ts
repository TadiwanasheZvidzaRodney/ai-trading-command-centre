import { describe, it, expect } from 'vitest';
import { RewardRiskCalculator } from '../engine/rr-calculator.js';

describe('RewardRiskCalculator', () => {
  const calculator = new RewardRiskCalculator(1.5, 0.0001);

  describe('Basic calculation', () => {
    it('should calculate R:R for buy order', () => {
      const ratio = calculator.calculateRatio(1.0500, 1.0400, 1.0650);
      expect(ratio).toBe(1.5); // (1.0650-1.0500)/(1.0500-1.0400) = 150/100 = 1.5
    });

    it('should calculate R:R for sell order', () => {
      const ratio = calculator.calculateRatio(1.0500, 1.0600, 1.0350);
      expect(ratio).toBe(1.5); // (1.0500-1.0350)/(1.0600-1.0500) = 150/100 = 1.5
    });

    it('should handle gold prices', () => {
      const ratio = calculator.calculateRatio(2000, 1990, 2030);
      expect(ratio).toBe(3); // (2030-2000)/(2000-1990) = 30/10 = 3
    });

    it('should handle various R:R ratios', () => {
      const ratios = [
        [1.0500, 1.0400, 1.0550, 0.5], // 50 pips / 100 pips
        [1.0500, 1.0400, 1.0600, 1], // 100 pips / 100 pips
        [1.0500, 1.0400, 1.0800, 3], // 300 pips / 100 pips
      ];

      for (const [entry, stop, target, expected] of ratios) {
        const ratio = calculator.calculateRatio(entry, stop, target);
        expect(ratio).toBe(expected);
      }
    });
  });

  describe('Validation', () => {
    it('should approve when R:R meets minimum', () => {
      const result = calculator.validate(1.0500, 1.0400, 1.0650);
      expect(result.valid).toBe(true);
      expect(result.ratio).toBe(1.5);
      expect(result.minRequired).toBe(1.5);
    });

    it('should reject when R:R below minimum', () => {
      const result = calculator.validate(1.0500, 1.0400, 1.0600);
      expect(result.valid).toBe(false);
      expect(result.ratio).toBe(1);
      expect(result.minRequired).toBe(1.5);
    });

    it('should return difference when rejected', () => {
      const result = calculator.validate(1.0500, 1.0400, 1.0600);
      expect(result.valid).toBe(false);
      expect(result.difference).toBe(-0.5);
    });

    it('should return positive difference when exceeds minimum', () => {
      const result = calculator.validate(1.0500, 1.0400, 1.0800);
      expect(result.valid).toBe(true);
      expect(result.difference).toBe(1.5); // 3.0 - 1.5
    });
  });

  describe('Minimum target calculation', () => {
    it('should calculate minimum target for default minimum R:R', () => {
      const minTarget = calculator.calculateMinimumTarget(1.0500, 1.0400);
      expect(minTarget).toBe(1.065); // Entry + (100 pips × 1.5)
    });

    it('should calculate minimum target for custom R:R', () => {
      const minTarget = calculator.calculateMinimumTarget(1.0500, 1.0400, 2);
      expect(minTarget).toBe(1.07); // Entry + (100 pips × 2)
    });

    it('should work for gold prices', () => {
      const minTarget = calculator.calculateMinimumTarget(2000, 1990);
      expect(minTarget).toBe(2015); // Entry + (10 × 1.5)
    });
  });

  describe('Suggestions', () => {
    it('should suggest moving target when R:R too low', () => {
      const result = calculator.suggestCorrections(1.0500, 1.0400, 1.0550);
      expect(result.needed).toBe('moveTarget');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toContain('1');
    });

    it('should return none when R:R already valid', () => {
      const result = calculator.suggestCorrections(1.0500, 1.0400, 1.0650);
      expect(result.needed).toBe('none');
      expect(result.suggestions[0]).toContain('already meets');
    });

    it('should provide actionable suggestions', () => {
      const result = calculator.suggestCorrections(1.0500, 1.0400, 1.0550);
      const suggestions = result.suggestions.join('\n');
      expect(suggestions).toContain('1.065'); // Suggested target
    });
  });

  describe('Edge cases', () => {
    it('should throw on zero stop distance', () => {
      expect(() => calculator.calculateRatio(1.0500, 1.0500, 1.0650)).toThrow('Stop distance cannot be zero');
    });

    it('should throw on non-positive prices', () => {
      expect(() => calculator.calculateRatio(0, 1.0400, 1.0650)).toThrow('entry, stop, and target must be positive');
      expect(() => calculator.calculateRatio(-1, 1.0400, 1.0650)).toThrow('entry, stop, and target must be positive');
      expect(() => calculator.calculateRatio(1.0500, 0, 1.0650)).toThrow('entry, stop, and target must be positive');
      expect(() => calculator.calculateRatio(1.0500, 1.0400, 0)).toThrow('entry, stop, and target must be positive');
    });

    it('should throw on invalid target calculation parameters', () => {
      expect(() => calculator.calculateMinimumTarget(0, 1.0400, 1.5)).toThrow('All parameters must be positive');
      expect(() => calculator.calculateMinimumTarget(1.0500, 0, 1.5)).toThrow('All parameters must be positive');
      expect(() => calculator.calculateMinimumTarget(1.0500, 1.0400, 0)).toThrow('All parameters must be positive');
    });
  });

  describe('Determinism', () => {
    it('should produce consistent results across multiple calls', () => {
      const results = Array.from({ length: 10 }, () => calculator.calculateRatio(1.0500, 1.0400, 1.0650));

      expect(results.every((r) => r === results[0])).toBe(true);
    });

    it('should validate consistently', () => {
      const validations = Array.from({ length: 10 }, () =>
        calculator.validate(1.0500, 1.0400, 1.0650),
      );

      expect(validations.every((v) => v.valid === validations[0].valid)).toBe(true);
    });
  });

  describe('Precision', () => {
    it('should round R:R to 2 decimal places', () => {
      const ratio = calculator.calculateRatio(1.0500, 1.0400, 1.0667);
      const decimals = (ratio.toString().split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });
});
