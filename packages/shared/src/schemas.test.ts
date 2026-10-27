import { describe, expect, it } from 'vitest';
import { paperOrderRequestSchema, tradePlanRequestSchema } from './schemas.js';

describe('request schemas', () => {
  it('accepts a valid trade plan', () => {
    const result = tradePlanRequestSchema.safeParse({
      instrument: 'XAU/USD',
      side: 'buy',
      entry: 4000,
      stop: 3990,
      target: 4025,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-finite and non-positive prices', () => {
    expect(
      tradePlanRequestSchema.safeParse({
        instrument: 'XAU/USD',
        side: 'buy',
        entry: Number.POSITIVE_INFINITY,
        stop: 3990,
        target: 4025,
      }).success,
    ).toBe(false);
    expect(
      tradePlanRequestSchema.safeParse({
        instrument: 'XAU/USD',
        side: 'buy',
        entry: 0,
        stop: 3990,
        target: 4025,
      }).success,
    ).toBe(false);
  });

  it('requires a limit price for limit orders', () => {
    const base = {
      idempotencyKey: 'test-key-12345',
      instrument: 'EUR/USD',
      side: 'buy',
      type: 'limit',
      stopLoss: 1.1,
      takeProfit: 1.12,
    };
    expect(paperOrderRequestSchema.safeParse(base).success).toBe(false);
    expect(paperOrderRequestSchema.safeParse({ ...base, limitPrice: 1.105 }).success).toBe(true);
  });

  it('enforces target/stop ordering for the side', () => {
    const base = {
      idempotencyKey: 'test-key-12345',
      instrument: 'GBP/USD',
      side: 'buy',
      type: 'market',
      stopLoss: 1.33,
      takeProfit: 1.32,
    };
    expect(paperOrderRequestSchema.safeParse(base).success).toBe(false);
  });
});
