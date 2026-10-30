/**
 * @atc/technical-analysis
 * Technical analysis indicators, structure detection and strategy evaluation
 */

// Types
export type {
  Candle,
  SMAValue,
  EMAValue,
  RSIValue,
  MACDValue,
  ATRValue,
  ADXValue,
  BBandsValue,
  StochasticValue,
  PriceLevel,
  Trend,
  Structure,
  CandlePattern,
  PatternDetection,
  TechnicalIndicators,
  StrategyRule,
  SetupCandidate,
  IndicatorContext,
  SwingPoints,
} from './types';

// Indicators
export { sma, ema, rsi, macd, atr, adx, bbands, stochastic } from './indicators';

// Structure
export {
  detectSwingHighLow,
  identifyTrend,
  clusterLevels,
  getRecentSwings,
  analyzeStructure,
} from './structure';

// Patterns
export { detectPatterns } from './patterns';

// Strategies
export {
  evaluateStrategy,
  evaluateStrategies,
  validateStrategy,
  EXAMPLE_STRATEGIES,
} from './strategies';

// Service
export {
  TechnicalAnalysisService,
  createTechnicalAnalysisService,
} from './service';
