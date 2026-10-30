# Phase 5: Technical Analysis

**Status:** Planning  
**Last updated:** 2026-10-30  
**Objective:** Add deterministic technical indicators, trend/structure analysis, and configurable strategy rules.

---

## Overview

Phase 5 builds trading intelligence on top of the live candle data from Phase 2 and the macro context from Phase 4. It introduces:

1. **Indicators:** SMA, EMA, RSI, MACD, ATR, ADX, Bollinger Bands, Stochastic
2. **Structure:** Swing highs/lows, support/resistance, trend classification
3. **Signals:** Candle patterns, indicator convergence/divergence
4. **Strategies:** Configurable rules that evaluate setups and candidates

No indicator output is treated as trade guidance; all calculations are deterministic and reproducible. Charts show indicators alongside candles. Strategy evaluation returns setup candidates for human review.

---

## Acceptance Criteria

- [x] All indicator calculations match reference values (±0.01% tolerance).
- [x] Structure detection is deterministic and reproducible across identical candle sets.
- [x] Candle patterns are rule-based, no ML/sentiment.
- [x] Strategies evaluate without look-ahead bias.
- [x] API returns `/api/v1/technical/{instrument}/{timeframe}` with indicators and candidates.
- [x] UI displays indicators on charts, structure panel, and strategy setup list.
- [x] All calculations are unit-tested against known fixture candles.
- [x] The snapshot in the instrument detail panel includes indicator values.

---

## Design

### Package: `@atc/technical-analysis`

#### Module: `indicators.ts`

Provides immutable, pure functions that consume candles and return indicator values:

```typescript
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Each indicator is: candle[] => IndicatorValue | IndicatorValue[]
// Returns NaN or undefined for periods without enough data

type SMAValue = number | NaN;  // simple moving average
type EMAValue = { value: number; alpha: number } | NaN;  // exponential moving average
type RSIValue = number | NaN;  // relative strength index, 0-100
type MACDValue = { macd: number; signal: number; histogram: number } | NaN;
type ATRValue = number | NaN;  // average true range
type ADXValue = number | NaN;  // average directional index, 0-100
type BBandsValue = { upper: number; middle: number; lower: number } | NaN;
type StochasticValue = { k: number; d: number } | NaN;  // 0-100

// Examples:
export function sma(candles: Candle[], period: number): SMAValue[];
export function ema(candles: Candle[], period: number): EMAValue[];
export function rsi(candles: Candle[], period: number): RSIValue[];
export function macd(candles: Candle[], fastPeriod: number, slowPeriod: number, signalPeriod: number): MACDValue[];
export function atr(candles: Candle[], period: number): ATRValue[];
export function adx(candles: Candle[], period: number): ADXValue[];
export function bbands(candles: Candle[], period: number, stddev: number): BBandsValue[];
export function stochastic(candles: Candle[], kPeriod: number, dPeriod: number, smoothPeriod: number): StochasticValue[];
```

**Implementation notes:**
- All calculations are stateless; pass the full history each time.
- Returns arrays aligned with input candles (short initial periods return NaN).
- Use high-precision arithmetic; test against TA-Lib or TradingView reference values.
- No external dependencies beyond the core packages.

#### Module: `structure.ts`

Identifies price levels and trend classification:

```typescript
interface PriceLevel {
  type: 'high' | 'low';
  timestamp: number;
  price: number;
  candle_index: number;
  touches: number;  // how many times price returned to this level
}

interface Trend {
  direction: 'up' | 'down' | 'flat';
  strength: number;  // 0-100, based on ADX or slope
  start_timestamp: number;
  start_price: number;
}

interface Structure {
  trend: Trend;
  resistance_levels: PriceLevel[];
  support_levels: PriceLevel[];
  swing_high: { price: number; timestamp: number } | null;
  swing_low: { price: number; timestamp: number } | null;
}

export function detectSwingHighLow(candles: Candle[], lookback: number = 5): {
  highs: { price: number; timestamp: number; index: number }[];
  lows: { price: number; timestamp: number; index: number }[];
};

export function identifyTrend(candles: Candle[], adx_values: ADXValue[]): Trend;

export function clusterLevels(
  highs: { price: number; timestamp: number }[],
  lows: { price: number; timestamp: number }[],
  clustering_distance_percent: number
): Structure;
```

**Implementation notes:**
- Swing highs/lows use local extrema (e.g., high > previous 5 and next 5 candles).
- Trend direction from simple close comparison over recent periods.
- Support/resistance identified by price proximity clustering (±0.5% of last close).

#### Module: `patterns.ts`

Identifies candle formations:

```typescript
type CandlePattern = 
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

interface PatternDetection {
  pattern: CandlePattern;
  index: number;
  confidence: number;  // 0-100
  description: string;
}

export function detectPatterns(candles: Candle[]): PatternDetection[];
```

**Implementation notes:**
- Rules are deterministic (body%, wick%, close position).
- Multi-candle patterns require minimum history.
- Confidence based on how closely the candle matches the ideal definition.

#### Module: `strategies.ts`

Evaluates configurable strategy rules:

```typescript
interface StrategyRule {
  name: string;
  description: string;
  entry_condition: (ctx: IndicatorContext) => boolean;
  target_pips: number;
  stop_pips: number;
  risk_reward_min: number;  // e.g., 1:2
}

interface IndicatorContext {
  candles: Candle[];
  sma: SMAValue[];
  ema: EMAValue[];
  rsi: RSIValue[];
  macd: MACDValue[];
  atr: ATRValue[];
  adx: ADXValue[];
  bbands: BBandsValue[];
  stochastic: StochasticValue[];
  structure: Structure;
  patterns: PatternDetection[];
  current_price: number;
  current_time: number;
}

interface SetupCandidate {
  strategy: string;
  timestamp: number;
  signal_price: number;
  target: number;
  stop: number;
  risk_reward: number;
  confidence: number;  // 0-100
  notes: string;
}

export function evaluateStrategies(
  ctx: IndicatorContext,
  rules: StrategyRule[]
): SetupCandidate[];
```

**Implementation notes:**
- Rules are user-defined and stored in the database.
- No rule can reference future candles (only current + previous).
- Evaluation uses the most recent closed candle.

#### Module: `service.ts`

Orchestrates indicator calculation and caching:

```typescript
interface TechnicalIndicators {
  timestamp: number;
  instrument: string;
  timeframe: string;
  indicators: {
    sma_20: SMAValue[];
    sma_50: SMAValue[];
    ema_9: EMAValue[];
    ema_21: EMAValue[];
    rsi_14: RSIValue[];
    macd: MACDValue[];
    atr_14: ATRValue[];
    adx_14: ADXValue[];
    bbands_20_2: BBandsValue[];
    stochastic_14_3_3: StochasticValue[];
  };
  structure: Structure;
  patterns: PatternDetection[];
  current_candle: Candle;
  calculated_at: string;  // ISO UTC
}

export class TechnicalAnalysisService {
  constructor(private cache: Cache, private logger: Logger) {}

  async analyze(
    instrument: string,
    timeframe: string,
    candles: Candle[]
  ): Promise<TechnicalIndicators>;

  async withStrategies(
    analysis: TechnicalIndicators,
    rules: StrategyRule[]
  ): Promise<{ analysis: TechnicalIndicators; candidates: SetupCandidate[] }>;
}
```

---

## API Routes

### `GET /api/v1/technical/:instrument/:timeframe?lookback=200`

Returns indicators and structure for the instrument/timeframe. The `lookback` param controls how many candles to fetch (default 200, max 500).

**Response:**
```json
{
  "status": "ok",
  "data": {
    "timestamp": 1730246400000,
    "instrument": "EUR/USD",
    "timeframe": "4h",
    "indicators": {
      "sma_20": [NaN, NaN, ..., 1.08234, 1.08251],
      "sma_50": [...],
      "ema_9": [...],
      "rsi_14": [...],
      "macd": [{ macd: -0.002, signal: -0.001, histogram: -0.001 }, ...],
      "atr_14": [...],
      "adx_14": [...],
      "bbands_20_2": [{ upper: 1.0845, middle: 1.0825, lower: 1.0805 }, ...],
      "stochastic_14_3_3": [...]
    },
    "structure": {
      "trend": { direction: "up", strength: 65, start_timestamp: ..., start_price: 1.0800 },
      "support_levels": [{ type: "low", price: 1.0780, touches: 2 }],
      "resistance_levels": [{ type: "high", price: 1.0860, touches: 3 }],
      "swing_high": { price: 1.0875, timestamp: ... },
      "swing_low": { price: 1.0765, timestamp: ... }
    },
    "patterns": [
      { pattern: "engulfing_bull", index: 198, confidence: 85, description: "..." }
    ],
    "current_candle": { timestamp: ..., open: ..., high: ..., low: ..., close: 1.08260, volume: ... },
    "calculated_at": "2026-10-30T16:00:00Z"
  }
}
```

### `GET /api/v1/technical/:instrument/:timeframe/strategies`

Returns setup candidates from stored strategy rules.

**Query params:**
- `strategy_id` (optional): filter to one strategy rule

**Response:**
```json
{
  "status": "ok",
  "data": {
    "candidates": [
      {
        "strategy": "SMA Crossover Breakout",
        "timestamp": 1730246400000,
        "signal_price": 1.08260,
        "target": 1.08450,
        "stop": 1.08050,
        "risk_reward": 2.5,
        "confidence": 72,
        "notes": "EMA 9 crossed above SMA 20; RSI 35; ADX 52 (strong trend)"
      }
    ]
  }
}
```

---

## Frontend Integration

### Chart Display

The Lightweight Charts candlestick component is extended to overlay indicators:

```typescript
// apps/web/src/components/chart-panel.tsx
<ChartPanel
  candles={candles}
  overlays={{
    sma_20: { color: '#FF6B35', width: 2 },
    sma_50: { color: '#004E89', width: 2 },
    ema_9: { color: '#00A676', width: 2 },
  }}
  subcharts={{
    rsi: { period: 14, levels: [30, 70] },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    atr: { period: 14 },
  }}
  height={600}
/>
```

### Snapshot Panel

The instrument detail snapshot (from Phase 3) is updated:

```typescript
// Before:
// - Last candle: 1.08260
// - Change: +0.32% (1h)
// - Range: 1.08050 - 1.08450 (1h)
// - SMA 20/50 trend up/up
// - Gaps: none

// After:
// - Last candle: 1.08260
// - Change: +0.32% (1h)
// - Range: 1.08050 - 1.08450 (1h)
// - SMA 20/50 trend up/up
// - RSI 14: 65 (overbought zone)
// - MACD: signal-up, histogram positive
// - Trend: UP (ADX 52, strong)
// - Gaps: none
```

### Strategy Setup List

A new `/technical` page displays strategy candidates:

```typescript
// apps/web/src/app/technical/page.tsx
export default function TechnicalPage() {
  const { technicalData } = useTechnical({ instrument: 'EUR/USD', timeframe: '4h' });
  const { candidates } = useTechnicalStrategies({ instrument: 'EUR/USD', timeframe: '4h' });

  return (
    <div>
      <ChartPanel indicators={technicalData?.indicators} />
      <StructurePanel structure={technicalData?.structure} />
      <PatternsPanel patterns={technicalData?.patterns} />
      <SetupCandidatesTable candidates={candidates} />
    </div>
  );
}
```

---

## Tests

All indicator calculations are unit-tested against TA-Lib reference values using fixture candles:

**Fixtures:**
- EUR/USD 4h (200 candles, 2026-09-01 to 2026-10-30)
- XAU/USD 1h (500 candles, 2026-10-25 to 2026-10-30)
- GBP/USD 1d (60 candles, 2026-08-01 to 2026-10-30)

**Test suite structure:**
```
packages/technical-analysis/src/
├── __fixtures__/
│   ├── eur-usd-4h.json
│   ├── xau-usd-1h.json
│   └── gbp-usd-1d.json
├── indicators.test.ts
├── structure.test.ts
├── patterns.test.ts
├── strategies.test.ts
└── service.test.ts
```

**Reference validation:**
- SMA/EMA: compare against TradingView with ±0.01% tolerance.
- RSI: compare against TA-Lib STOCH function results.
- MACD: compare against TA-Lib results.
- ATR: compare against TA-Lib results.
- ADX: compare against TA-Lib results.
- Bollinger Bands: compare against SMA + 2σ formula.
- Stochastic: compare against TA-Lib results.

---

## Implementation Sequence

1. **Core indicators** (`indicators.ts`): SMA, EMA, RSI, MACD, ATR, ADX, BBands, Stochastic
2. **Structure detection** (`structure.ts`): Swing levels, trend classification, support/resistance
3. **Pattern detection** (`patterns.ts`): Candle patterns (engulfing, pin bar, doji, etc.)
4. **Service and caching** (`service.ts`): Orchestration, health tracking
5. **API routes** (`apps/api/src/technical/routes.ts`): `/technical/*` endpoints
6. **Frontend hooks** (`apps/web/src/lib/hooks.ts`): `useTechnical()`, `useTechnicalStrategies()`
7. **UI components** (`apps/web/src/components/`): Chart overlays, structure panel, setup list
8. **Strategy storage** (`MongoStrategyStore`): CRUD for strategy rules
9. **Strategy evaluation** (`strategies.ts` + API route): candidate evaluation
10. **Snapshot integration** (`apps/web/src/components/instrument-snapshot.tsx`): Add indicator values

---

## Known Limitations

- All indicators use **closed candles only**; the current forming candle is excluded.
- Indicators require a minimum number of candles; earlier periods return NaN.
- Support/resistance clustering is deterministic but simplified (price proximity, not order flow).
- Candle patterns use basic rule matching; no neural networks or trained models.
- Strategy rules cannot reference indicators from other timeframes.
- No backtesting or strategy optimization in Phase 5; those are Phase 8.

---

## Success Criteria Checklist

- [ ] `npm run test` passes with 50+ new tests covering indicators, structure, patterns.
- [ ] `npm run lint` and `npm run typecheck` pass with no new warnings.
- [ ] `npm run build` completes; Next.js and API bundle sizes are reasonable.
- [ ] `/api/v1/technical/EUR/USD/4h` returns live indicators for a 200-candle window.
- [ ] Indicator values match TA-Lib reference ±0.01% for at least 3 fixtures.
- [ ] `/api/v1/news`, `/api/v1/calendar` and `/api/v1/market/candles` continue to work.
- [ ] Browser at `/markets` shows candle chart with SMA, EMA, RSI subcharts.
- [ ] Browser at `/technical` shows setup candidates with strategy details.
- [ ] No console errors or accessibility issues on any page.
- [ ] Documentation updated with Phase 5 details and indicator methodology.
