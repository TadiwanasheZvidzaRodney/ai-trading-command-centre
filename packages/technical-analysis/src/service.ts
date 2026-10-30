/**
 * Technical analysis service: orchestrates indicator calculation and analysis
 */

import type { Candle, TechnicalIndicators, StrategyRule, SetupCandidate, IndicatorContext } from './types';
import {
  sma,
  ema,
  rsi,
  macd,
  atr,
  adx,
  bbands,
  stochastic,
} from './indicators';
import { analyzeStructure } from './structure';
import { detectPatterns } from './patterns';
import { evaluateStrategies } from './strategies';

/**
 * Technical analysis service
 */
export class TechnicalAnalysisService {
  constructor(private logger?: any) {}

  /**
   * Analyze candles and return all indicators
   */
  async analyze(
    instrument: string,
    timeframe: string,
    candles: Candle[]
  ): Promise<TechnicalIndicators> {
    if (candles.length === 0) {
      throw new Error('No candles provided for analysis');
    }

    try {
      // Calculate all indicators
      const sma20 = sma(candles, 20);
      const sma50 = sma(candles, 50);
      const ema9 = ema(candles, 9);
      const ema21 = ema(candles, 21);
      const rsiValues = rsi(candles, 14);
      const macdValues = macd(candles, 12, 26, 9);
      const atrValues = atr(candles, 14);
      const adxValues = adx(candles, 14);
      const bbandsValues = bbands(candles, 20, 2);
      const stochValues = stochastic(candles, 14, 3, 3);

      // Analyze structure
      const structure = analyzeStructure(candles, adxValues, 0.5, 5);

      // Detect patterns
      const patterns = detectPatterns(candles);

      const result: TechnicalIndicators = {
        timestamp: Date.now(),
        instrument,
        timeframe,
        indicators: {
          sma_20: sma20,
          sma_50: sma50,
          ema_9: ema9,
          ema_21: ema21,
          rsi_14: rsiValues,
          macd: macdValues,
          atr_14: atrValues,
          adx_14: adxValues,
          bbands_20_2: bbandsValues,
          stochastic_14_3_3: stochValues,
        },
        structure,
        patterns,
        current_candle: candles[candles.length - 1]!,
        calculated_at: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error, instrument, timeframe }, 'Technical analysis failed');
      }
      throw error;
    }
  }

  /**
   * Evaluate strategies against technical analysis
   */
  async evaluateStrategiesForContext(
    analysis: TechnicalIndicators,
    rules: StrategyRule[]
  ): Promise<SetupCandidate[]> {
    try {
      const ctx: IndicatorContext = {
        candles: this.expandCandles(analysis),  // Need to reconstruct full candle history
        sma_20: analysis.indicators.sma_20,
        sma_50: analysis.indicators.sma_50,
        ema_9: analysis.indicators.ema_9,
        ema_21: analysis.indicators.ema_21,
        rsi_14: analysis.indicators.rsi_14,
        macd: analysis.indicators.macd,
        atr_14: analysis.indicators.atr_14,
        adx_14: analysis.indicators.adx_14,
        bbands_20_2: analysis.indicators.bbands_20_2,
        stochastic_14_3_3: analysis.indicators.stochastic_14_3_3,
        structure: analysis.structure,
        patterns: analysis.patterns,
        current_price: analysis.current_candle.close,
        current_time: analysis.current_candle.timestamp,
      };

      return evaluateStrategies(ctx, rules);
    } catch (error) {
      if (this.logger) {
        this.logger.error({ error }, 'Strategy evaluation failed');
      }
      throw error;
    }
  }

  /**
   * Reconstruct minimal candle history from context
   * (In real implementation, would fetch from database)
   */
  private expandCandles(analysis: TechnicalIndicators): Candle[] {
    // For now, return just the current candle
    // In production, fetch full history from market-data service
    return [analysis.current_candle];
  }

  /**
   * Check health of the service
   */
  getHealth(): {
    status: 'ok' | 'degraded' | 'error';
    message: string;
  } {
    return {
      status: 'ok',
      message: 'Technical analysis service operational',
    };
  }
}

/**
 * Create a default instance with logging
 */
export function createTechnicalAnalysisService(
  logger?: any
): TechnicalAnalysisService {
  return new TechnicalAnalysisService(logger);
}
