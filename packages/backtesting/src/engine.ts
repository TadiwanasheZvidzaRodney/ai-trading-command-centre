import {
  INSTRUMENTS,
  type BacktestConfig,
  type BacktestTrade,
  type Candle,
  type OrderSide,
} from '@atc/shared';
import { createHash } from 'node:crypto';
import { atrSeries, emaSeries, rollingHighest, rollingLowest, rsiSeries } from './indicators.js';
import { computeMetrics, equityCurveFromTrades } from './metrics.js';
import type {
  BacktestRun,
  BacktestSplitMetrics,
  BacktestVerdict,
  RunBacktestInput,
  StrategyContext,
  StrategySignal,
} from './types.js';

const MIN_OUT_OF_SAMPLE_TRADES = 10;
const WARMUP_BUFFER = 2;

function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

function normalizeCandles(
  candles: readonly Candle[],
  config: BacktestConfig,
): Candle[] {
  const from = Date.parse(config.from);
  const to = Date.parse(config.to);
  const seen = new Set<number>();
  const cleaned: Candle[] = [];
  for (const candle of candles) {
    if (
      !Number.isFinite(candle.time) ||
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close)
    ) {
      continue;
    }
    if (candle.time < from || candle.time > to || seen.has(candle.time)) continue;
    seen.add(candle.time);
    cleaned.push(candle);
  }
  cleaned.sort((a, b) => a.time - b.time);
  return cleaned;
}

function hashInputs(
  candles: readonly Candle[],
  config: BacktestConfig,
  strategyId: string,
): string {
  const payload = {
    strategyId,
    config: {
      instrument: config.instrument,
      timeframe: config.timeframe,
      from: config.from,
      to: config.to,
      initialEquity: config.initialEquity,
      riskPerTradePct: config.riskPerTradePct,
      spreadPips: config.spreadPips,
      commissionPerLot: config.commissionPerLot,
      slippagePips: config.slippagePips,
      maxHoldBars: config.maxHoldBars,
    },
    candles: candles.map((candle) => [
      candle.time,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
    ]),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

interface OpenPosition {
  side: OrderSide;
  entryTime: number;
  entryIndex: number;
  entryPrice: number;
  entryRaw: number;
  stop: number;
  target: number;
  lots: number;
  units: number;
  riskAmount: number;
  commissionEntry: number;
  entryCosts: number;
}

interface ExitResult {
  rawPrice: number;
  reason: 'stop' | 'target' | 'time';
}

function detectExit(
  position: OpenPosition,
  bar: Candle,
  barsHeld: number,
  maxHoldBars: number,
): ExitResult | null {
  if (position.side === 'buy') {
    // Stop is checked first: when both levels are touched inside one bar the
    // conservative assumption is a stop-out.
    if (bar.low <= position.stop) {
      return { rawPrice: Math.min(bar.open, position.stop), reason: 'stop' };
    }
    if (bar.high >= position.target) {
      return { rawPrice: Math.max(bar.open, position.target), reason: 'target' };
    }
  } else {
    if (bar.high >= position.stop) {
      return { rawPrice: Math.max(bar.open, position.stop), reason: 'stop' };
    }
    if (bar.low <= position.target) {
      return { rawPrice: Math.min(bar.open, position.target), reason: 'target' };
    }
  }
  if (barsHeld >= maxHoldBars) {
    return { rawPrice: bar.close, reason: 'time' };
  }
  return null;
}

/**
 * Event-driven backtester.
 *
 * Rules for avoiding look-ahead:
 * - A signal is evaluated on the close of bar `i` using only data at or before
 *   `i`.
 * - The resulting position is opened at the open of bar `i + 1`.
 * - Stop/target exits are evaluated on bars at or after the entry bar using
 *   that bar's high/low, with the stop assumed first when both are touched.
 */
export function runBacktest(input: RunBacktestInput): BacktestRun {
  const { config, strategy } = input;
  const now = input.now ?? (() => new Date());
  const candles = normalizeCandles(input.candles, config);
  const warnings: string[] = [];

  const inputHash = hashInputs(candles, config, strategy.id);
  const id = `bt_${inputHash.slice(0, 16)}`;

  const fromMs = Date.parse(config.from);
  const toMs = Date.parse(config.to);
  const splitBoundary = (fraction: number): string =>
    new Date(fromMs + (toMs - fromMs) * fraction).toISOString();
  const split = {
    development: { from: new Date(fromMs).toISOString(), to: splitBoundary(0.6) },
    validation: { from: splitBoundary(0.6), to: splitBoundary(0.8) },
    outOfSample: { from: splitBoundary(0.8), to: new Date(toMs).toISOString() },
  };

  const emptyRun = (): BacktestRun => {
    const metrics = computeMetrics([], config.initialEquity, [
      { time: fromMs, equity: config.initialEquity },
    ]);
    return {
      id,
      inputHash,
      createdAt: now().toISOString(),
      config,
      metrics,
      trades: [],
      equityCurve: [{ time: fromMs, equity: config.initialEquity }],
      warnings,
      split,
      strategy: { id: strategy.id, name: strategy.name },
      candleCount: candles.length,
      splitMetrics: {
        development: metrics,
        validation: metrics,
        outOfSample: metrics,
      },
      verdict: 'insufficient-evidence',
    };
  };

  if (candles.length < strategy.warmupBars + WARMUP_BUFFER) {
    warnings.push(
      `Insufficient candle history: ${candles.length} bars, need at least ${
        strategy.warmupBars + WARMUP_BUFFER
      }.`,
    );
    return emptyRun();
  }

  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  if (first.time > fromMs) {
    warnings.push('Candle history starts after the requested start date.');
  }
  if (last.time < toMs) {
    warnings.push('Candle history ends before the requested end date.');
  }

  const spec = INSTRUMENTS[config.instrument];
  const ema9 = emaSeries(candles.map((candle) => candle.close), 9);
  const ema21 = emaSeries(candles.map((candle) => candle.close), 21);
  const rsi14 = rsiSeries(candles, 14);
  const atr14 = atrSeries(candles, 14);

  const snapshot = (index: number): StrategyContext => ({
    candles,
    index,
    ema9: orNull(ema9[index]),
    ema21: orNull(ema21[index]),
    ema9Prev: orNull(ema9[index - 1]),
    ema21Prev: orNull(ema21[index - 1]),
    rsi14: orNull(rsi14[index]),
    atr14: orNull(atr14[index]),
    highestHigh20: rollingHighest(candles, index, 20),
    lowestLow20: rollingLowest(candles, index, 20),
  });

  const priceCosts =
    (config.spreadPips * spec.pipSize) / 2 + config.slippagePips * spec.pipSize;
  const equityCurve: Array<{ time: number; equity: number }> = [];
  const trades: BacktestTrade[] = [];
  let balance = config.initialEquity;
  let position: OpenPosition | null = null;
  let pending: StrategySignal | null = null;
  let skippedForSize = 0;
  let skippedForGap = 0;

  for (let index = 0; index < candles.length; index += 1) {
    const bar = candles[index]!;

    if (pending && position === null) {
      const signal = pending;
      pending = null;
      const rawEntry = bar.open;
      const direction = signal.side === 'buy' ? 1 : -1;
      const entryPrice = rawEntry + direction * priceCosts;
      const stopDistance = Math.abs(entryPrice - signal.stop);
      const validPrices =
        signal.side === 'buy'
          ? signal.stop < entryPrice && signal.target > entryPrice
          : signal.stop > entryPrice && signal.target < entryPrice;

      if (!validPrices || stopDistance <= 0) {
        skippedForGap += 1;
      } else {
        const riskAmount = (balance * config.riskPerTradePct) / 100;
        const rawLots = riskAmount / (stopDistance * spec.contractSize);
        const stepped = Math.floor(rawLots / spec.lotStep + 1e-9) * spec.lotStep;
        const lots = Number(stepped.toFixed(4));
        if (lots < spec.minLot) {
          skippedForSize += 1;
        } else {
          const cappedLots = Math.min(lots, spec.maxLot);
          const units = cappedLots * spec.contractSize;
          const commissionEntry = cappedLots * config.commissionPerLot;
          position = {
            side: signal.side,
            entryTime: bar.time,
            entryIndex: index,
            entryPrice,
            entryRaw: rawEntry,
            stop: signal.stop,
            target: signal.target,
            lots: cappedLots,
            units,
            riskAmount: round(stopDistance * units),
            commissionEntry,
            entryCosts: commissionEntry + Math.abs(entryPrice - rawEntry) * units,
          };
        }
      }
    }

    if (position) {
      const barsHeld = index - position.entryIndex;
      const exit = detectExit(position, bar, barsHeld, config.maxHoldBars);
      if (exit) {
        const direction = position.side === 'buy' ? 1 : -1;
        const exitPrice = exit.rawPrice - direction * priceCosts;
        const commissionExit = position.lots * config.commissionPerLot;
        const grossPnl = (exitPrice - position.entryPrice) * direction * position.units;
        const pnl = round(grossPnl - commissionExit);
        const exitCosts = commissionExit + Math.abs(exitPrice - exit.rawPrice) * position.units;
        const costs = round(position.entryCosts + exitCosts);
        const rMultiple =
          position.riskAmount > 0 ? round(pnl / position.riskAmount, 4) : 0;

        trades.push({
          id: `bt-trade-${trades.length + 1}`,
          side: position.side,
          entryTime: position.entryTime,
          exitTime: bar.time,
          entryPrice: round(position.entryPrice, spec.pricePrecision),
          exitPrice: round(exitPrice, spec.pricePrecision),
          quantityLots: position.lots,
          pnl,
          rMultiple,
          exitReason: exit.reason,
          costs,
        });

        balance = round(balance + pnl);
        position = null;
        equityCurve.push({ time: bar.time, equity: balance });
        continue;
      }
    }

    if (position === null && index >= strategy.warmupBars && index < candles.length - 1) {
      const signal = strategy.evaluate(snapshot(index));
      if (signal) pending = signal;
    }

    let equity = balance;
    if (position) {
      const direction = position.side === 'buy' ? 1 : -1;
      equity = round(balance + (bar.close - position.entryPrice) * direction * position.units);
    }
    equityCurve.push({ time: bar.time, equity });
  }

  // Close any position still open at the end of the data.
  if (position) {
    const bar = candles[candles.length - 1]!;
    const direction = position.side === 'buy' ? 1 : -1;
    const rawPrice = bar.close;
    const exitPrice = rawPrice - direction * priceCosts;
    const commissionExit = position.lots * config.commissionPerLot;
    const grossPnl = (exitPrice - position.entryPrice) * direction * position.units;
    const pnl = round(grossPnl - commissionExit);
    const exitCosts = commissionExit + Math.abs(exitPrice - rawPrice) * position.units;
    trades.push({
      id: `bt-trade-${trades.length + 1}`,
      side: position.side,
      entryTime: position.entryTime,
      exitTime: bar.time,
      entryPrice: round(position.entryPrice, spec.pricePrecision),
      exitPrice: round(exitPrice, spec.pricePrecision),
      quantityLots: position.lots,
      pnl,
      rMultiple: position.riskAmount > 0 ? round(pnl / position.riskAmount, 4) : 0,
      exitReason: 'time',
      costs: round(position.entryCosts + exitCosts),
    });
    balance = round(balance + pnl);
    position = null;
    const lastPoint = equityCurve[equityCurve.length - 1];
    if (lastPoint) lastPoint.equity = balance;
    else equityCurve.push({ time: bar.time, equity: balance });
  }

  if (skippedForSize > 0) {
    warnings.push(
      `${skippedForSize} signal(s) were skipped because the risk-based size was below the minimum lot.`,
    );
  }
  if (skippedForGap > 0) {
    warnings.push(
      `${skippedForGap} signal(s) were skipped because the next-bar open invalidated the stop/target geometry.`,
    );
  }
  if (trades.length === 0) {
    warnings.push('No trades were generated in this period.');
  }

  const metrics = computeMetrics(trades, config.initialEquity, equityCurve);
  const splitMetrics = buildSplitMetrics(trades, split, config.initialEquity);
  const verdict = classifyVerdict(splitMetrics.outOfSample);

  if (splitMetrics.outOfSample.trades < MIN_OUT_OF_SAMPLE_TRADES) {
    warnings.push(
      `Out-of-sample evidence is thin (${splitMetrics.outOfSample.trades} trades, need at least ${MIN_OUT_OF_SAMPLE_TRADES}). Do not claim this strategy is profitable.`,
    );
  } else if (splitMetrics.outOfSample.netPnl <= 0) {
    warnings.push(
      'Out-of-sample net P&L is not positive. In-sample profits do not establish an edge.',
    );
  }

  return {
    id,
    inputHash,
    createdAt: now().toISOString(),
    config,
    metrics,
    trades,
    equityCurve,
    warnings,
    split,
    strategy: { id: strategy.id, name: strategy.name },
    candleCount: candles.length,
    splitMetrics,
    verdict,
  };
}

function orNull(value: number | null | undefined): number | null {
  return value === undefined || value === null || !Number.isFinite(value) ? null : value;
}

function buildSplitMetrics(
  trades: readonly BacktestTrade[],
  split: BacktestRun['split'],
  initialEquity: number,
): BacktestSplitMetrics {
  const developmentEnd = Date.parse(split.development.to);
  const validationEnd = Date.parse(split.validation.to);

  const developmentTrades = trades.filter((trade) => trade.entryTime < developmentEnd);
  const validationTrades = trades.filter(
    (trade) => trade.entryTime >= developmentEnd && trade.entryTime < validationEnd,
  );
  const outOfSampleTrades = trades.filter((trade) => trade.entryTime >= validationEnd);

  const development = computeMetrics(
    developmentTrades,
    initialEquity,
    equityCurveFromTrades(developmentTrades, initialEquity),
  );
  const validationStarting = development.endingEquity;
  const validation = computeMetrics(
    validationTrades,
    validationStarting,
    equityCurveFromTrades(validationTrades, validationStarting),
  );
  const outOfSampleStarting = validation.endingEquity;
  const outOfSample = computeMetrics(
    outOfSampleTrades,
    outOfSampleStarting,
    equityCurveFromTrades(outOfSampleTrades, outOfSampleStarting),
  );

  return { development, validation, outOfSample };
}

function classifyVerdict(outOfSample: BacktestSplitMetrics['outOfSample']): BacktestVerdict {
  if (outOfSample.trades < MIN_OUT_OF_SAMPLE_TRADES) return 'insufficient-evidence';
  return outOfSample.netPnl > 0
    ? 'out-of-sample-profitable'
    : 'out-of-sample-not-profitable';
}
