import type { MarketDataService } from '@atc/market-data';
import {
  backtestRequestSchema,
  TIMEFRAME_MS,
  type BacktestConfig,
} from '@atc/shared';
import type { BacktestRun, BacktestStrategy } from '@atc/backtesting';
import { BUILT_IN_STRATEGIES, getStrategy, runBacktest } from '@atc/backtesting';
import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';

export interface BacktestRouteOptions {
  db: Db;
  marketData: MarketDataService;
}

interface StoredBacktest extends BacktestRun {
  runId: string;
}

const nowIso = (): string => new Date().toISOString();

function candleLimit(from: string, to: string, timeframe: keyof typeof TIMEFRAME_MS): number {
  const span = Math.max(0, Date.parse(to) - Date.parse(from));
  const bars = Math.ceil(span / TIMEFRAME_MS[timeframe]);
  // Leave room for indicator warm-up and provider limits.
  return Math.min(5000, Math.max(300, bars + 260));
}

function configFromRequest(input: {
  instrument: BacktestConfig['instrument'];
  timeframe: BacktestConfig['timeframe'];
  from: string;
  to: string;
  strategyId: string;
  initialEquity: number;
  riskPerTradePct: number;
  spreadPips: number;
  commissionPerLot: number;
  slippagePips: number;
  maxHoldBars: number;
}): BacktestConfig {
  return {
    instrument: input.instrument,
    timeframe: input.timeframe,
    from: input.from,
    to: input.to,
    strategyId: input.strategyId,
    initialEquity: input.initialEquity,
    riskPerTradePct: input.riskPerTradePct,
    spreadPips: input.spreadPips,
    commissionPerLot: input.commissionPerLot,
    slippagePips: input.slippagePips,
    maxHoldBars: input.maxHoldBars,
  };
}

export async function registerBacktestRoutes(
  app: FastifyInstance,
  options: BacktestRouteOptions,
): Promise<void> {
  const { db, marketData } = options;
  const runs = db.collection('backtest_runs');

  app.get<{ Querystring: { limit?: string } }>('/api/v1/backtests', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 20) || 20));
    const docs = await runs.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
    return {
      status: 'ok',
      data: {
        runs: docs.map((doc) => ({
          runId: doc.runId,
          id: doc.id,
          createdAt: doc.createdAt,
          inputHash: doc.inputHash,
          config: doc.config,
          strategy: doc.strategy,
          metrics: doc.metrics,
          verdict: doc.verdict,
          candleCount: doc.candleCount,
        })),
        total: docs.length,
      },
      timestamp: nowIso(),
    };
  });

  app.get('/api/v1/backtests/strategies', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return {
      status: 'ok',
      data: {
        strategies: BUILT_IN_STRATEGIES.map((strategy) => ({
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          warmupBars: strategy.warmupBars,
        })),
      },
      timestamp: nowIso(),
    };
  });

  app.get<{ Params: { id: string } }>('/api/v1/backtests/:id', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const doc =
      (await runs.findOne({ runId: request.params.id })) ??
      (await runs.findOne({ id: request.params.id }));
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Backtest run not found');
    return { status: 'ok', data: doc, timestamp: nowIso() };
  });

  app.post<{ Body: unknown }>('/api/v1/backtests', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const input = backtestRequestSchema.parse(request.body);
    const strategy: BacktestStrategy | undefined = getStrategy(input.strategyId);
    if (!strategy) {
      throw new AppError(
        400,
        'UNKNOWN_STRATEGY',
        `Unknown strategy '${input.strategyId}'. Use one of: ema-trend, rsi-reversion, breakout-20.`,
      );
    }

    const limit = candleLimit(input.from, input.to, input.timeframe);
    const batch = await marketData.getCandles(input.instrument, input.timeframe, limit);
    if (batch.series.candles.length === 0) {
      throw new AppError(
        503,
        'NO_CANDLE_DATA',
        'No candle history is available for the requested instrument and period.',
      );
    }

    const config = configFromRequest(input);
    const result = runBacktest({
      candles: batch.series.candles,
      config,
      strategy,
    });

    const stored: StoredBacktest = {
      runId: `run_${randomUUID()}`,
      ...result,
    };
    await runs.insertOne(stored);

    app.log.info(
      {
        runId: stored.runId,
        strategy: strategy.id,
        instrument: input.instrument,
        trades: stored.metrics.trades,
        verdict: stored.verdict,
      },
      'Backtest run stored',
    );

    reply.code(201);
    return { status: 'ok', data: stored, timestamp: nowIso() };
  });
}
