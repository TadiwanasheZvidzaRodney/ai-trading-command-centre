export * from './types.js';
export {
  emaSeries,
  rsiSeries,
  atrSeries,
  rollingHighest,
  rollingLowest,
} from './indicators.js';
export {
  BUILT_IN_STRATEGIES,
  breakoutStrategy,
  emaTrendStrategy,
  getStrategy,
  rsiReversionStrategy,
} from './strategies.js';
export {
  computeMetrics,
  equityCurveFromTrades,
  maxDrawdownFromCurve,
} from './metrics.js';
export { runBacktest } from './engine.js';
