import { describe, expect, it } from 'vitest';
import { formatPct, formatUsd, pipsBetween, roundDownToStep, roundTo, safeDivide } from './money';

describe('money helpers', () => {
  it('rounds down to the lot step without increasing risk', () => {
    expect(roundDownToStep(0.019, 0.01)).toBe(0.01);
    expect(roundDownToStep(0.029, 0.01)).toBe(0.02);
    expect(roundDownToStep(1.999, 0.01)).toBe(1.99);
  });

  it('rounds display values half-up', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(1.004, 2)).toBe(1);
  });

  it('calculates pips', () => {
    expect(pipsBetween(1.10505, 1.105, 0.0001)).toBeCloseTo(0.5, 8);
    expect(pipsBetween(4010.1, 4009.9, 0.1)).toBeCloseTo(2, 8);
  });

  it('formats money and percentages safely', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatPct(1.25)).toBe('1.25%');
    expect(formatUsd(Number.NaN)).toBe('—');
  });

  it('does not divide by zero', () => {
    expect(safeDivide(10, 0, -1)).toBe(-1);
  });
});
