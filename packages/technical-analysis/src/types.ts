/**
 * Technical analysis types and data structures
 */

export interface Candle {
  timestamp: number;  // Unix milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Simple Moving Average */
export type SMAValue = number | null;

/** Exponential Moving Average with alpha factor */
export interface EMAValue {
  value: number;
  alpha: number;
}

/** Relative Strength Index (0-100) */
export type RSIValue = number | null;

/** MACD (Moving Average Convergence Divergence) */
export interface MACDValue {
  macd: number;
  signal: number;
  histogram: number;
}

/** Average True Range */
export type ATRValue = number | null;

/** Average Directional Index (0-100) */
export type ADXValue = number | null;

/** Bollinger Bands */
export interface BBandsValue {
  upper: number;
  middle: number;
  lower: number;
  percent_b?: number;  // (close - lower) / (upper - lower)
  bandwidth?: number;  // (upper - lower) / middle
}

/** Stochastic (0-100) */
export interface StochasticValue {
  k: number;
  d: number;
}

/** Price level (support/resistance) */
export interface PriceLevel {
  type: 'high' | 'low';
  timestamp: number;
  price: number;
  candle_index: number;
  touches: number;
}

/** Trend classification */
export interface Trend {
  direction: 'up' | 'down' | 'flat';
  strength: number;  // 0-100 (based on ADX if available)
  start_timestamp: number;
  start_price: number;
}

/** Structure (trend, levels, swings) */
export interface Structure {
  trend: Trend;
  resistance_levels: PriceLevel[];
  support_levels: PriceLevel[];
  swing_high: { price: number; timestamp: number } | null;
  swing_low: { price: number; timestamp: number } | null;
}

/** Candle pattern */
export type CandlePattern =
  | 'engulfing_bull'
  | 'engulfing_bear'
  | 'pinbar_bull'
  | 'pinbar_bear'
  | 'three_inside_up'
  | 'three_inside_down'
  | 'hammer'
  | 'inverted_hammer'
  | 'doji'
  | 'morning_star'
  | 'evening_star';

/** Pattern detection result */
export interface PatternDetection {
  pattern: CandlePattern;
  index: number;
  confidence: number;  // 0-100
  description: string;
}

/** Complete technical indicators snapshot */
export interface TechnicalIndicators {
  timestamp: number;
  instrument: string;
  timeframe: string;
  indicators: {
    sma_20: SMAValue[];
    sma_50: SMAValue[];
    ema_9: (EMAValue | null)[];
    ema_21: (EMAValue | null)[];
    rsi_14: RSIValue[];
    macd: (MACDValue | null)[];
    atr_14: ATRValue[];
    adx_14: ADXValue[];
    bbands_20_2: (BBandsValue | null)[];
    stochastic_14_3_3: (StochasticValue | null)[];
  };
  structure: Structure;
  patterns: PatternDetection[];
  current_candle: Candle;
  calculated_at: string;  // ISO UTC
}

/** Strategy rule definition */
export interface StrategyRule {
  id?: string;
  name: string;
  description: string;
  instrument?: string;  // if null, applies to all
  timeframe?: string;   // if null, applies to all
  enabled: boolean;
  entry_condition_code: string;  // function body as string, evaluated in context
  target_pips: number;
  stop_pips: number;
  risk_reward_min: number;
  created_at?: string;
  updated_at?: string;
}

/** Setup candidate from strategy evaluation */
export interface SetupCandidate {
  strategy: string;
  timestamp: number;
  signal_price: number;
  target: number;
  stop: number;
  risk_reward: number;
  confidence: number;  // 0-100
  notes: string;
}

/** Context available during strategy evaluation */
export interface IndicatorContext {
  candles: Candle[];
  sma_20: SMAValue[];
  sma_50: SMAValue[];
  ema_9: (EMAValue | null)[];
  ema_21: (EMAValue | null)[];
  rsi_14: RSIValue[];
  macd: (MACDValue | null)[];
  atr_14: ATRValue[];
  adx_14: ADXValue[];
  bbands_20_2: (BBandsValue | null)[];
  stochastic_14_3_3: (StochasticValue | null)[];
  structure: Structure;
  patterns: PatternDetection[];
  current_price: number;
  current_time: number;
}

/** Swing high/low detection result */
export interface SwingPoints {
  highs: { price: number; timestamp: number; index: number }[];
  lows: { price: number; timestamp: number; index: number }[];
}
