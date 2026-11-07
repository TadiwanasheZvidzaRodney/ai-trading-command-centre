/** Shared domain vocabulary. Keep this package free of HTTP, database and provider SDKs. */

export type InstrumentSymbol = 'XAU/USD' | 'EUR/USD' | 'GBP/USD';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'XAU';
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1wk';
export type DataQuality = 'live' | 'delayed' | 'reference' | 'proxy';
export type ProviderStatus = 'ok' | 'degraded' | 'error' | 'not_configured';
export type Impact = 'high' | 'medium' | 'low' | 'holiday' | 'unknown';
export type Trend = 'uptrend' | 'downtrend' | 'range' | 'unknown';
export type VolatilityRegime = 'low' | 'normal' | 'high' | 'unknown';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected' | 'closed';
export type SetupStatus = 'watching' | 'triggered' | 'invalidated' | 'expired' | 'taken';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TradingMode = 'research' | 'paper';

export interface Instrument {
  symbol: InstrumentSymbol;
  base: CurrencyCode;
  quote: CurrencyCode;
  displayName: string;
  kind: 'metal' | 'forex';
  pricePrecision: number;
  pipSize: number;
  tickSize: number;
  /** Units of the base asset in one standard lot. */
  contractSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  quoteCurrency: 'USD';
  /** Free-provider proxy used only when a direct candle provider is unavailable. */
  candleProxySymbol?: string;
  candleProxyLabel?: string;
  notes?: string;
}

export interface ProviderInfo {
  id: string;
  displayName: string;
  quality: DataQuality;
  delaySeconds?: number;
  url?: string;
  note?: string;
}

export interface Quote {
  instrument: InstrumentSymbol;
  bid: number | null;
  ask: number | null;
  mid: number;
  spread: number | null;
  provider: ProviderInfo;
  /** Provider observation time, ISO-8601 UTC. */
  observedAt: string;
  /** Time this application retrieved the value, ISO-8601 UTC. */
  fetchedAt: string;
  ageSeconds: number;
  stale: boolean;
  quality: DataQuality;
  proxy: boolean;
  proxyFor?: InstrumentSymbol;
  note?: string;
}

export interface Candle {
  /** Unix epoch milliseconds, UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface CandleGap {
  after: number;
  before: number;
  missing: number;
  /** True when the gap is explained by a weekend/holiday closure. */
  expected: boolean;
}

export interface CandleSeries {
  instrument: InstrumentSymbol;
  timeframe: Timeframe;
  provider: ProviderInfo;
  candles: Candle[];
  fetchedAt: string;
  from: string;
  to: string;
  quality: DataQuality;
  proxy: boolean;
  proxyFor?: InstrumentSymbol;
  duplicatesRemoved: number;
  gaps: CandleGap[];
  notes: string[];
}

/** Deterministic summary derived only from the supplied candle series. */
export interface MarketSummary {
  candleCount: number;
  lastClose: number;
  firstClose: number;
  change: number;
  changePct: number;
  periodHigh: number;
  periodLow: number;
  averageRange: number;
  averageVolume: number | null;
  volumeAvailable: boolean;
  sma20: number | null;
  sma50: number | null;
  trend: Trend;
  gapCount: number;
  expectedGapCount: number;
  asOf: string;
}

export interface ProviderHealth {
  providerId: string;
  displayName: string;
  category: 'market-data' | 'news' | 'calendar' | 'analytics' | 'ai';
  status: ProviderStatus;
  configured: boolean;
  quality: DataQuality;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  message: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  fetchedAt: string;
  currencies: string[];
  instruments: InstrumentSymbol[];
  relevance: number;
  tags: string[];
}

export interface NewsSourceStatus {
  id: string;
  url: string;
  status: 'ok' | 'error';
  itemCount: number;
  skippedCount: number;
  latencyMs: number;
  error: string | null;
}

export interface NewsFeed {
  items: NewsItem[];
  provider: ProviderInfo;
  sources: NewsSourceStatus[];
  fetchedAt: string;
  cached: boolean;
  duplicatesRemoved: number;
  skippedCount: number;
  error: string | null;
  notes: string[];
}

export interface CalendarEvent {
  id: string;
  externalId: string;
  title: string;
  currency: string;
  country: string;
  impact: Impact;
  scheduledAt: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  source: string;
  sourceUrl?: string;
  fetchedAt: string;
  instruments: InstrumentSymbol[];
  note?: string;
}

export interface CalendarFeed {
  events: CalendarEvent[];
  provider: ProviderInfo;
  weekStart: string;
  weekEnd: string;
  fetchedAt: string;
  cached: boolean;
  skippedCount: number;
  error: string | null;
  notes: string[];
}

export interface IndicatorPoint {
  time: number;
  value: number | null;
}

export interface MacdPoint {
  time: number;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface CandlePattern {
  time: number;
  name: string;
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface TechnicalSnapshot {
  instrument: InstrumentSymbol;
  timeframe: Timeframe;
  asOf: string;
  candleCount: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  macd: MacdPoint | null;
  atr14: number | null;
  adx14: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  support: number[];
  resistance: number[];
  trend: Trend;
  volatility: VolatilityRegime;
  patterns: CandlePattern[];
  notes: string[];
}

export interface Scenario {
  name: 'bullish' | 'bearish' | 'neutral';
  thesis: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  conditions: string[];
  invalidation: string[];
  targetZone?: string;
}

export interface AnalysisSource {
  title: string;
  url?: string;
  provider: string;
  publishedAt?: string;
}

export interface AnalysisReport {
  id: string;
  instrument: InstrumentSymbol;
  timeframe: Timeframe;
  createdAt: string;
  dataAsOf: string;
  provider: ProviderInfo;
  generation: 'deterministic' | 'ai';
  model: string | null;
  promptVersion: string;
  marketContext: string;
  trend: string;
  technicalSummary: string;
  macroContext: string;
  eventRisk: string;
  scenarios: Scenario[];
  keyLevels: { support: number[]; resistance: number[] };
  riskNotes: string[];
  missingData: string[];
  sources: AnalysisSource[];
  limitations: string[];
  inputHash: string;
  disclaimer: string;
}

export interface RiskConfig {
  accountCurrency: 'USD';
  startingBalance: number;
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxOpenRiskPct: number;
  maxPositions: number;
  minRewardRisk: number;
  maxSpreadPips: Record<InstrumentSymbol, number>;
  eventBlackoutMinutes: number;
  killSwitch: boolean;
  /** Maximum notional exposure as a multiple of account equity. */
  maxLeverage?: number;
}

export interface PositionSizeInput {
  instrument: InstrumentSymbol;
  accountEquity: number;
  riskPerTradePct: number;
  entry: number;
  stop: number;
  target: number;
  side: OrderSide;
}

export interface RiskDecision {
  approved: boolean;
  reasons: string[];
  warnings: string[];
  positionSizeLots: number;
  riskAmount: number;
  riskPct: number;
  rewardRisk: number;
  notional: number;
  stopDistance: number;
  targetDistance: number;
  pipValuePerLot: number;
  computedAt: string;
  inputsUsed: Record<string, number | string | boolean>;
}

export interface PaperOrder {
  id: string;
  idempotencyKey: string;
  instrument: InstrumentSymbol;
  side: OrderSide;
  type: OrderType;
  quantityLots: number;
  requestedPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  status: OrderStatus;
  createdAt: string;
  filledAt: string | null;
  filledPrice: number | null;
  exitPrice: number | null;
  closedAt: string | null;
  spreadAtEntry: number | null;
  slippage: number;
  commission: number;
  pnl: number | null;
  rMultiple: number | null;
  closeReason: 'stop' | 'target' | 'manual' | null;
  notes: string;
  riskDecision: RiskDecision | null;
}

export interface JournalEntry {
  id: string;
  orderId: string;
  instrument: InstrumentSymbol;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  quantityLots: number;
  pnl: number;
  rMultiple: number | null;
  openedAt: string;
  closedAt: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceMetrics {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  expectancy: number;
  profitFactor: number | null;
  averageWin: number;
  averageLoss: number;
  averageR: number | null;
  totalR: number | null;
  maxDrawdown: number;
  maxDrawdownPct: number;
  startingEquity: number;
  endingEquity: number;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  instrument: InstrumentSymbol | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Setup {
  id: string;
  instrument: InstrumentSymbol;
  timeframe: Timeframe;
  direction: 'long' | 'short';
  status: SetupStatus;
  entry: number;
  stop: number;
  target: number;
  rewardRisk: number;
  rationale: string;
  invalidation: string;
  source: 'manual' | 'technical' | 'analysis';
  createdAt: string;
  updatedAt: string;
}

export interface BacktestConfig {
  instrument: InstrumentSymbol;
  timeframe: Timeframe;
  from: string;
  to: string;
  strategyId: string;
  initialEquity: number;
  riskPerTradePct: number;
  spreadPips: number;
  commissionPerLot: number;
  slippagePips: number;
  maxHoldBars: number;
}

export interface BacktestTrade {
  id: string;
  side: OrderSide;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  quantityLots: number;
  pnl: number;
  rMultiple: number;
  exitReason: 'stop' | 'target' | 'time';
  costs: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  inputHash: string;
  createdAt: string;
  metrics: PerformanceMetrics;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  warnings: string[];
  split: {
    development: { from: string; to: string };
    validation: { from: string; to: string };
    outOfSample: { from: string; to: string };
  } | null;
}
