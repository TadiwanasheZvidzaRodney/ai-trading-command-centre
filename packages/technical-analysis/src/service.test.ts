/**
 * Unit tests for technical analysis service
 */

import { describe, it, expect } from 'vitest';
import { TechnicalAnalysisService, createTechnicalAnalysisService } from './service';
import {
  createEurUsdTrendingUp,
  createGbpUsdTrendingDown,
  createXauUsdRanging,
  createSmallSample,
} from './fixtures';

describe('TechnicalAnalysisService - analyze', () => {
  it('should create service instance', () => {
    const service = new TechnicalAnalysisService();
    expect(service).toBeDefined();
  });

  it('should analyze candles and return TechnicalIndicators', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(result).toBeDefined();
    expect(result.instrument).toBe('EUR/USD');
    expect(result.timeframe).toBe('4h');
    expect(result.timestamp).toBeDefined();
  });

  it('should include all indicator arrays', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(result.indicators).toBeDefined();
    expect(result.indicators.sma_20).toBeDefined();
    expect(result.indicators.sma_50).toBeDefined();
    expect(result.indicators.ema_9).toBeDefined();
    expect(result.indicators.ema_21).toBeDefined();
    expect(result.indicators.rsi_14).toBeDefined();
    expect(result.indicators.macd).toBeDefined();
    expect(result.indicators.atr_14).toBeDefined();
    expect(result.indicators.adx_14).toBeDefined();
    expect(result.indicators.bbands_20_2).toBeDefined();
    expect(result.indicators.stochastic_14_3_3).toBeDefined();
  });

  it('should populate all arrays with correct length', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(result.indicators.sma_20).toHaveLength(candles.length);
    expect(result.indicators.sma_50).toHaveLength(candles.length);
    expect(result.indicators.ema_9).toHaveLength(candles.length);
    expect(result.indicators.ema_21).toHaveLength(candles.length);
    expect(result.indicators.rsi_14).toHaveLength(candles.length);
    expect(result.indicators.macd).toHaveLength(candles.length);
    expect(result.indicators.atr_14).toHaveLength(candles.length);
    expect(result.indicators.adx_14).toHaveLength(candles.length);
    expect(result.indicators.bbands_20_2).toHaveLength(candles.length);
    expect(result.indicators.stochastic_14_3_3).toHaveLength(candles.length);
  });

  it('should include structure analysis', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(result.structure).toBeDefined();
    expect(result.structure.trend).toBeDefined();
    expect(result.structure.resistance_levels).toBeDefined();
    expect(result.structure.support_levels).toBeDefined();
    expect(result.structure.swing_high).toBeDefined();
    expect(result.structure.swing_low).toBeDefined();
  });

  it('should detect patterns', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(Array.isArray(result.patterns)).toBe(true);
    result.patterns.forEach((p) => {
      expect(p.pattern).toBeDefined();
      expect(p.confidence).toBeDefined();
      expect(p.description).toBeDefined();
    });
  });

  it('should include current candle', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(result.current_candle).toBeDefined();
    expect(result.current_candle).toEqual(candles[candles.length - 1]);
  });

  it('should include calculated_at timestamp', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(result.calculated_at).toBeDefined();
    // Should be valid ISO string
    expect(() => new Date(result.calculated_at)).not.toThrow();
  });

  it('should throw on empty candles', async () => {
    const service = new TechnicalAnalysisService();
    await expect(service.analyze('EUR/USD', '4h', [])).rejects.toThrow(
      'No candles provided for analysis'
    );
  });

  it('should work with different instruments', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createGbpUsdTrendingDown();
    const result = await service.analyze('GBP/USD', '1d', candles);

    expect(result.instrument).toBe('GBP/USD');
    expect(result.timeframe).toBe('1d');
  });

  it('should work with trending up data', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(result.structure.trend.direction).toBe('up');
  });

  it('should work with trending down data', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createGbpUsdTrendingDown();
    const result = await service.analyze('GBP/USD', '1d', candles);

    expect(result.structure.trend.direction).toBe('down');
  });

  it('should work with ranging data', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createXauUsdRanging();
    const result = await service.analyze('XAU/USD', '1h', candles);

    expect(result).toBeDefined();
    expect(result.structure).toBeDefined();
  });
});

describe('TechnicalAnalysisService - evaluateStrategiesForContext', () => {
  it('should evaluate strategies against analysis', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const analysis = await service.analyze('EUR/USD', '4h', candles);

    const rules = [
      {
        name: 'Simple Uptrend',
        description: 'Buy when trending up',
        enabled: true,
        entry_condition_code: 'return structure.trend.direction === "up";',
        target_pips: 50,
        stop_pips: 20,
        risk_reward_min: 1.5,
      },
    ];

    const candidates = await service.evaluateStrategiesForContext(analysis, rules);
    expect(Array.isArray(candidates)).toBe(true);
  });

  it('should return setup candidates with required fields', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const analysis = await service.analyze('EUR/USD', '4h', candles);

    const rules = [
      {
        name: 'Uptrend Rule',
        description: 'Test rule',
        enabled: true,
        entry_condition_code: 'return true;',
        target_pips: 50,
        stop_pips: 20,
        risk_reward_min: 1.5,
      },
    ];

    const candidates = await service.evaluateStrategiesForContext(analysis, rules);
    candidates.forEach((c) => {
      expect(c.strategy).toBeDefined();
      expect(c.timestamp).toBeDefined();
      expect(c.signal_price).toBeDefined();
      expect(c.target).toBeDefined();
      expect(c.stop).toBeDefined();
      expect(c.risk_reward).toBeDefined();
      expect(c.confidence).toBeDefined();
      expect(c.notes).toBeDefined();
    });
  });
});

describe('TechnicalAnalysisService - getHealth', () => {
  it('should return health status', () => {
    const service = new TechnicalAnalysisService();
    const health = service.getHealth();

    expect(health.status).toBe('ok');
    expect(health.message).toBeDefined();
  });

  it('should indicate operational status', () => {
    const service = new TechnicalAnalysisService();
    const health = service.getHealth();

    expect(['ok', 'degraded', 'error']).toContain(health.status);
  });

  it('should have descriptive message', () => {
    const service = new TechnicalAnalysisService();
    const health = service.getHealth();

    expect(health.message.length).toBeGreaterThan(0);
  });
});

describe('TechnicalAnalysisService - createTechnicalAnalysisService', () => {
  it('should create default service instance', () => {
    const service = createTechnicalAnalysisService();
    expect(service).toBeInstanceOf(TechnicalAnalysisService);
  });

  it('should accept optional logger', () => {
    const mockLogger = {
      error: () => {},
      info: () => {},
    };
    const service = createTechnicalAnalysisService(mockLogger);
    expect(service).toBeInstanceOf(TechnicalAnalysisService);
  });
});

describe('TechnicalAnalysisService - Integration', () => {
  it('should analyze multiple instruments independently', async () => {
    const service = new TechnicalAnalysisService();
    const eurCandles = createEurUsdTrendingUp();
    const gbpCandles = createGbpUsdTrendingDown();

    const eurResult = await service.analyze('EUR/USD', '4h', eurCandles);
    const gbpResult = await service.analyze('GBP/USD', '1d', gbpCandles);

    expect(eurResult.instrument).toBe('EUR/USD');
    expect(gbpResult.instrument).toBe('GBP/USD');
    expect(eurResult.structure.trend.direction).toBe('up');
    expect(gbpResult.structure.trend.direction).toBe('down');
  });

  it('should handle rapid consecutive analyses', async () => {
    const service = new TechnicalAnalysisService();
    const candles1 = createEurUsdTrendingUp();
    const candles2 = createXauUsdRanging();

    const result1 = await service.analyze('EUR/USD', '4h', candles1);
    const result2 = await service.analyze('XAU/USD', '1h', candles2);

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });

  it('should validate indicator fields are populated correctly', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    // Check SMA values
    const sma20Values = result.indicators.sma_20.filter((v) => v !== null);
    expect(sma20Values.length).toBeGreaterThan(0);

    // Check RSI bounds
    const rsiValues = result.indicators.rsi_14.filter((v) => v !== null) as number[];
    rsiValues.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });

    // Check ATR positive
    const atrValues = result.indicators.atr_14.filter((v) => v !== null) as number[];
    atrValues.forEach((v) => {
      expect(v).toBeGreaterThan(0);
    });
  });

  it('should integrate structure and patterns in analysis', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    // Structure should align with trend direction
    expect(['up', 'down', 'flat']).toContain(result.structure.trend.direction);

    // Patterns should have valid indices
    result.patterns.forEach((p) => {
      expect(p.index).toBeGreaterThanOrEqual(0);
      expect(p.index).toBeLessThan(candles.length);
    });
  });

  it('should handle small candle samples', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createSmallSample();
    const result = await service.analyze('EUR/USD', '1h', candles);

    expect(result).toBeDefined();
    expect(result.indicators).toBeDefined();
    // Many indicators will be null for small samples
    const nullCount = result.indicators.sma_20.filter((v) => v === null).length;
    expect(nullCount).toBeGreaterThan(0);
  });
});

describe('TechnicalAnalysisService - Error Handling', () => {
  it('should throw on empty candles array', async () => {
    const service = new TechnicalAnalysisService();
    await expect(service.analyze('EUR/USD', '4h', [])).rejects.toThrow();
  });

  it('should not throw on valid candles', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createSmallSample();
    await expect(service.analyze('EUR/USD', '1h', candles)).resolves.toBeDefined();
  });

  it('should handle logger errors gracefully', async () => {
    const errorLogger = {
      error: () => {
        throw new Error('Logger error');
      },
    };
    const service = new TechnicalAnalysisService(errorLogger);
    const candles = createEurUsdTrendingUp();

    // Should still work even if logger fails
    const result = await service.analyze('EUR/USD', '4h', candles);
    expect(result).toBeDefined();
  });
});

describe('TechnicalAnalysisService - Data Consistency', () => {
  it('should maintain consistent timestamp in analysis', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    expect(typeof result.timestamp).toBe('number');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('should have current_candle matching last input candle', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    const lastCandle = candles[candles.length - 1]!;
    expect(result.current_candle).toEqual(lastCandle);
  });

  it('should have matching array lengths for all indicators', async () => {
    const service = new TechnicalAnalysisService();
    const candles = createEurUsdTrendingUp();
    const result = await service.analyze('EUR/USD', '4h', candles);

    const expectedLength = candles.length;
    Object.entries(result.indicators).forEach(([name, indicator]) => {
      expect(indicator).toHaveLength(expectedLength);
    });
  });
});
