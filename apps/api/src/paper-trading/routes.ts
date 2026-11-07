import type { Env } from '@atc/config';
import type { CalendarService } from '@atc/economic-calendar';
import type { MarketDataService } from '@atc/market-data';
import { INSTRUMENTS, type InstrumentSymbol } from '@atc/shared';
import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { writeAudit } from '../audit/log.js';
import { AppError, zodDetails } from '../errors.js';
import {
  evaluatePositionsRequestSchema,
  evaluatePositionsResponseSchema,
  correlateRequestSchema,
  correlateResponseSchema,
  createPaperOrderRequestSchema,
  exposureResponseSchema,
  fillPaperOrderRequestSchema,
  fillPaperOrderResponseSchema,
  killSwitchRequestSchema,
  killSwitchStateSchema,
  listPaperOrdersQuerySchema,
  listPaperOrdersResponseSchema,
  listPaperPositionsResponseSchema,
  listPaperTradesQuerySchema,
  listPaperTradesResponseSchema,
  paperAnalyticsResponseSchema,
  paperOrderSchema,
  paperPositionSchema,
  paperTradeSchema,
  updatePaperOrderRequestSchema,
  updateTradeNotesRequestSchema,
  accountSnapshotResponseSchema,
  cancelPaperOrderResponseSchema,
  closePaperPositionRequestSchema,
  closePaperPositionResponseSchema,
  positionSizeRequestSchema,
  positionSizeResponseSchema,
  resetAccountRequestSchema,
  resetAccountResponseSchema,
  risksLimitsResponseSchema,
  validatePlanRequestSchema,
  validatePlanResponseSchema,
} from './types.js';
import { correlationBetween, evaluateRisk } from './risk-gate.js';
import { round, unitsFromLots } from './pricing.js';
import {
  PaperRiskRejectedError,
  PaperTradingService,
  type PaperTradingLogger,
} from './service.js';

interface PaperTradingRouteOptions {
  db: Db;
  env: Env;
  marketData?: MarketDataService;
  calendar?: CalendarService;
  service?: PaperTradingService;
  logger?: PaperTradingLogger;
}

const nowIso = (): string => new Date().toISOString();

function handleError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof ZodError) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
  }
  if (error instanceof PaperRiskRejectedError) {
    throw new AppError(422, error.code, error.message, error.details);
  }
  throw error;
}

export async function registerPaperTradingRoutes(
  app: FastifyInstance,
  options: PaperTradingRouteOptions,
): Promise<void> {
  const { db, env } = options;
  const service =
    options.service ??
    new PaperTradingService({
      db,
      env,
      marketData: options.marketData,
      calendar: options.calendar,
      logger: options.logger,
    });

  // ==========================================================================
  // Risk endpoints
  // ==========================================================================

  app.post<{ Body: unknown }>('/api/v1/risk/position-size', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const input = positionSizeRequestSchema.parse(request.body);
      const spec = INSTRUMENTS[input.instrument];
      const stopDistance = Math.abs(input.entryPrice - input.stopPrice);
      if (stopDistance === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Stop price cannot equal entry price');
      }
      const validSide =
        input.side === 'buy'
          ? input.stopPrice < input.entryPrice
          : input.stopPrice > input.entryPrice;
      if (!validSide) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `Stop price must be ${input.side === 'buy' ? 'below' : 'above'} entry price`,
        );
      }

      const riskAmount = (input.accountBalance * input.riskPct) / 100;
      const lots = riskAmount / (stopDistance * spec.contractSize);
      const roundedLots = Number(lots.toFixed(2));
      const quantity = unitsFromLots(input.instrument, roundedLots);
      const notional = input.entryPrice * quantity;

      return {
        status: 'ok',
        data: positionSizeResponseSchema.parse({
          quantity: round(quantity),
          contracts: roundedLots,
          cost: round(notional),
          maxLoss: round(stopDistance * quantity),
          leverage: round(notional / input.accountBalance),
          riskPct: input.riskPct,
        }),
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });

  app.post<{ Body: unknown }>('/api/v1/risk/validate-plan', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const input = validatePlanRequestSchema.parse(request.body);
      const spec = INSTRUMENTS[input.instrument];
      const account = await service.getAccountState();
      const quantityLots = input.quantity / spec.contractSize;
      const equity = input.accountBalance ?? account.equity;
      const [quote, nextHighImpactMinutes, killSwitch] = await Promise.all([
        service.getQuote(input.instrument),
        service.nextHighImpactMinutes(input.instrument),
        service.getKillSwitch(),
      ]);

      const risk = evaluateRisk({
        instrument: input.instrument,
        side: input.side,
        entry: input.entryPrice,
        stop: input.stopPrice,
        target: input.targetPrice,
        quantityLots,
        equity,
        dailyPnL: input.dailyLossUSD,
        openPositions: input.currentPositions.map((position) => {
          const positionSpec = INSTRUMENTS[position.instrument];
          return {
            instrument: position.instrument,
            side: position.side,
            quantityLots: position.quantity / positionSpec.contractSize,
            entryPrice: position.entryPrice,
            stopLoss: position.stopPrice ?? position.entryPrice,
            riskAmount: Math.abs(
              position.entryPrice - (position.stopPrice ?? position.entryPrice),
            ) * position.quantity,
          };
        }),
        openOrders: input.openOrders.map((order) => {
          const orderSpec = INSTRUMENTS[order.instrument];
          return {
            instrument: order.instrument,
            side: order.side,
            quantityLots: order.quantity / orderSpec.contractSize,
            entryPrice: order.entryPrice,
            stopLoss: order.stopPrice ?? order.entryPrice,
            targetPrice: order.targetPrice ?? order.entryPrice,
            createdAt: order.createdAt ?? nowIso(),
          };
        }),
        spreadPips: quote.spreadPips,
        nextHighImpactMinutes,
        killSwitch,
        riskConfig: service.riskConfig,
      });

      return {
        status: 'ok',
        data: validatePlanResponseSchema.parse({
          valid: risk.approved,
          code: risk.code,
          reason: risk.approved
            ? 'Trade plan passes all validation checks'
            : `Trade plan rejected: ${risk.reasons[0]}`,
          violations: risk.reasons,
          suggestions: risk.warnings,
          checks: risk.checks.map((check) => ({
            id: check.id,
            ok: check.ok,
            detail: check.detail,
          })),
          riskAmount: risk.riskAmount,
          riskPct: risk.riskPct,
          rewardRisk: risk.rewardRisk,
          leverage: risk.leverage,
        }),
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });

  app.get('/api/v1/risk/limits', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=60');
    const killSwitch = await service.getKillSwitch();
    return {
      status: 'ok',
      data: risksLimitsResponseSchema.parse({
        perTradeRiskPct: service.riskConfig.riskPerTradePct,
        dailyLossPct: service.riskConfig.maxDailyLossPct,
        maxOpenRiskPct: service.riskConfig.maxOpenRiskPct,
        maxPositions: service.riskConfig.maxPositions,
        minRR: service.riskConfig.minRewardRisk,
        correlationThreshold: 0.7,
        maxLeverage: service.riskConfig.maxLeverage ?? 30,
        eventBlackoutMinutes: service.riskConfig.eventBlackoutMinutes,
        killSwitchEnabled: killSwitch.enabled,
        killSwitchReason: killSwitch.reason ?? null,
        commissionPerLot: env.PAPER_COMMISSION_PER_LOT,
        slippagePips: env.PAPER_SLIPPAGE_PIPS,
      }),
      timestamp: nowIso(),
    };
  });

  app.get('/api/v1/risk/kill-switch', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    return {
      status: 'ok',
      data: killSwitchStateSchema.parse(await service.getKillSwitch()),
      timestamp: nowIso(),
    };
  });

  app.post<{ Body: unknown }>('/api/v1/risk/kill-switch', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const input = killSwitchRequestSchema.parse(request.body);
      const state = await service.setKillSwitch(input.enabled, input.reason ?? '');
      await writeAudit(db, {
        action: 'risk.kill_switch',
        actor: request.auth?.user.username ?? 'unknown',
        target: state.enabled ? 'engaged' : 'disengaged',
        metadata: { reason: state.reason, enabled: state.enabled },
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
        requestId: request.id,
      });
      app.log.warn(
        { enabled: state.enabled, reason: state.reason },
        'Paper trading kill switch changed',
      );
      return {
        status: 'ok',
        data: killSwitchStateSchema.parse(state),
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });

  app.post<{ Body: unknown }>('/api/v1/risk/correlate', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const input = correlateRequestSchema.parse(request.body);
      let maxCorrelation = 0;
      const pairs: Array<{ instrument: InstrumentSymbol; correlation: number }> = [];
      for (const position of input.positions) {
        const sameDirection = input.positions.filter(
          (other) => other.side === position.side,
        );
        const correlation = Math.max(
          0,
          ...sameDirection.map((other) =>
            correlationBetween(position.instrument, other.instrument),
          ),
        );
        maxCorrelation = Math.max(maxCorrelation, correlation);
        pairs.push({ instrument: position.instrument, correlation });
      }
      const risk = maxCorrelation >= 0.8 ? 'high' : maxCorrelation >= 0.7 ? 'medium' : 'low';
      return {
        status: 'ok',
        data: correlateResponseSchema.parse({
          correlation: round(maxCorrelation),
          risk,
          pairs,
        }),
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });

  app.get('/api/v1/risk/exposure', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    const [account, killSwitch] = await Promise.all([
      service.getAccountState(),
      service.getKillSwitch(),
    ]);
    const totalOpenRisk = round(
      account.openPositions.reduce((sum, position) => sum + position.riskAmount, 0),
    );
    const maxOpenRisk = round(
      (account.equity * service.riskConfig.maxOpenRiskPct) / 100,
    );
    return {
      status: 'ok',
      data: exposureResponseSchema.parse({
        totalOpenRisk,
        dailyLoss: account.dailyPnL,
        openPositions: account.openPositions.length,
        dailyTrades: 0,
        maxOpenRisk,
        riskUtilisationPct: maxOpenRisk > 0 ? round((totalOpenRisk / maxOpenRisk) * 100) : 0,
        killSwitchEnabled: killSwitch.enabled,
      }),
      timestamp: nowIso(),
    };
  });

  // ==========================================================================
  // Paper order endpoints
  // ==========================================================================

  app.post<{ Body: unknown }>('/api/v1/paper-orders', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const input = createPaperOrderRequestSchema.parse(request.body);
      const result = await service.createOrder({
        idempotencyKey: input.idempotencyKey,
        instrument: input.instrument,
        side: input.side,
        type: input.type,
        entryPrice: input.entryPrice,
        stopPrice: input.stopPrice,
        targetPrice: input.targetPrice,
        quantity: input.quantity,
        riskPct: input.riskPct,
        limitPrice: input.limitPrice,
        notes: input.notes,
      });
      const order = paperOrderSchema.parse(result.order);
      reply.code(result.duplicate ? 200 : 201);
      return {
        status: 'ok',
        data: order,
        position: result.position,
        risk: result.risk,
        duplicate: result.duplicate,
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });

  app.get<{ Querystring: unknown }>('/api/v1/paper-orders', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const query = listPaperOrdersQuerySchema.parse(request.query);
      const filter: Record<string, unknown> = {};
      if (query.status) filter.status = query.status;
      if (query.instrument) filter.instrument = query.instrument;
      const [orders, total] = await Promise.all([
        db.collection('paper_orders').find(filter).sort({ createdAt: -1 }).limit(query.limit).toArray(),
        db.collection('paper_orders').countDocuments(filter),
      ]);
      return {
        status: 'ok',
        data: listPaperOrdersResponseSchema.parse({
          orders: orders.map((order) => paperOrderSchema.parse(order)),
          total,
        }),
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/paper-orders/:id',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      try {
        const input = updatePaperOrderRequestSchema.parse(request.body);
        if (Object.keys(input).length === 0) {
          throw new AppError(400, 'VALIDATION_ERROR', 'No fields to update');
        }
        const order = await db.collection('paper_orders').findOne({ orderId: request.params.id });
        if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
        if (order.status !== 'pending') {
          throw new AppError(400, 'VALIDATION_ERROR', `Cannot modify ${order.status} order`);
        }
        const patch: Record<string, unknown> = {};
        if (input.stopPrice !== undefined) patch.stopPrice = input.stopPrice;
        if (input.targetPrice !== undefined) patch.targetPrice = input.targetPrice;
        if (input.quantity !== undefined) patch.quantity = input.quantity;
        if (input.notes !== undefined) patch.notes = input.notes;
        const updated = await db
          .collection('paper_orders')
          .findOneAndUpdate(
            { orderId: request.params.id, status: 'pending' },
            { $set: patch },
            { returnDocument: 'after' },
          );
        const doc = unwrap(updated);
        if (!doc) throw new AppError(409, 'CONFLICT', 'Order changed while updating');
        return {
          status: 'ok',
          data: paperOrderSchema.parse(doc),
          timestamp: nowIso(),
        };
      } catch (error) {
        handleError(error);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/paper-orders/:id',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      try {
        const order = await db.collection('paper_orders').findOne({ orderId: request.params.id });
        if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
        if (order.status !== 'pending') {
          throw new AppError(400, 'VALIDATION_ERROR', `Cannot cancel ${order.status} order`);
        }
        const result = await db
          .collection('paper_orders')
          .findOneAndUpdate(
            { orderId: request.params.id, status: 'pending' },
            { $set: { status: 'cancelled', closedAt: nowIso() } },
            { returnDocument: 'after' },
          );
        if (!unwrap(result)) throw new AppError(409, 'CONFLICT', 'Order changed while cancelling');
        return {
          status: 'ok',
          data: cancelPaperOrderResponseSchema.parse({
            cancelled: true,
            orderId: request.params.id,
          }),
          timestamp: nowIso(),
        };
      } catch (error) {
        handleError(error);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/paper-orders/:id/fill',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      try {
        const input = fillPaperOrderRequestSchema.parse(request.body);
        if (input.currentAsk < input.currentBid) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Ask cannot be below bid');
        }
        const result = await service.fillOrder(
          request.params.id,
          input.currentBid,
          input.currentAsk,
        );
        if (result.duplicate) {
          throw new AppError(409, 'ALREADY_FILLED', 'Order is not pending');
        }
        return {
          status: 'ok',
          data: fillPaperOrderResponseSchema.parse({
            filled: true,
            fillPrice: Number(result.order.filledPrice),
            cost: round(Number(result.order.filledPrice) * Number(result.order.quantity)),
            commission: Number(result.order.commission ?? 0),
            slippage: Number(result.order.slippage ?? 0),
            orderId: request.params.id,
            positionId: String(result.position.positionId),
          }),
          timestamp: nowIso(),
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
          handleError(new AppError(404, 'NOT_FOUND', 'Order not found'));
        }
        handleError(error);
      }
    },
  );

  // ==========================================================================
  // Positions
  // ==========================================================================

  app.get('/api/v1/paper-positions', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    await service.markToMarket();
    const positions = await db
      .collection('paper_positions')
      .find({ status: 'open' })
      .toArray();
    return {
      status: 'ok',
      data: listPaperPositionsResponseSchema.parse({
        positions: positions.map((position) => paperPositionSchema.parse(position)),
        total: positions.length,
      }),
      timestamp: nowIso(),
    };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/paper-positions/:id/close',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      try {
        const input = closePaperPositionRequestSchema.parse(request.body);
        const result = await service.closePosition(request.params.id, {
          closePrice: input.closePrice,
          reason: input.reason,
        });
        if (!result) throw new AppError(404, 'NOT_FOUND', 'Position not found');
        return {
          status: 'ok',
          data: closePaperPositionResponseSchema.parse({
            closed: true,
            realizedPnL: result.trade.realizedPnL,
            grossPnL: result.trade.grossPnL,
            costs: result.trade.costs,
            rMultiple: result.trade.rMultiple as number | null,
            positionId: request.params.id,
            tradeId: result.trade.tradeId,
          }),
          timestamp: nowIso(),
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
          handleError(new AppError(404, 'NOT_FOUND', 'Position not found'));
        }
        if (error instanceof Error && error.message === 'ALREADY_CLOSED') {
          handleError(new AppError(409, 'ALREADY_CLOSED', 'Position is already closed'));
        }
        if (error instanceof Error && error.message === 'QUOTE_UNAVAILABLE') {
          handleError(
            new AppError(503, 'QUOTE_UNAVAILABLE', 'A live quote is required to close this position'),
          );
        }
        handleError(error);
      }
    },
  );

  app.post<{ Body: unknown }>('/api/v1/paper/evaluate', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const input = evaluatePositionsRequestSchema.parse(request.body ?? {});
      const quotes = new Map<InstrumentSymbol, {
        instrument: InstrumentSymbol;
        bid: number | null;
        ask: number | null;
        spreadPips: number | null;
        quotedAt: string | null;
      }>();
      for (const quote of input.quotes) {
        quotes.set(quote.instrument, {
          instrument: quote.instrument,
          bid: quote.bid,
          ask: quote.ask,
          spreadPips: null,
          quotedAt: nowIso(),
        });
      }
      const result = await service.evaluateTriggers(quotes.size > 0 ? quotes : undefined);
      return {
        status: 'ok',
        data: evaluatePositionsResponseSchema.parse(result),
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });

  // ==========================================================================
  // Trades, analytics and account
  // ==========================================================================

  app.get<{ Querystring: unknown }>('/api/v1/paper-trades', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const query = listPaperTradesQuerySchema.parse(request.query);
      const filter: Record<string, unknown> = {};
      if (query.instrument) filter.instrument = query.instrument;
      const [trades, total] = await Promise.all([
        db
          .collection('paper_trades')
          .find(filter)
          .sort({ closedAt: -1 })
          .skip(query.offset)
          .limit(query.limit)
          .toArray(),
        db.collection('paper_trades').countDocuments(filter),
      ]);
      return {
        status: 'ok',
        data: listPaperTradesResponseSchema.parse({
          trades: trades.map((trade) => paperTradeSchema.parse(trade)),
          total,
          limit: query.limit,
          offset: query.offset,
        }),
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/paper-trades/:id/notes',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      try {
        const input = updateTradeNotesRequestSchema.parse(request.body);
        const result = await db
          .collection('paper_trades')
          .findOneAndUpdate(
            { tradeId: request.params.id },
            { $set: { notes: input.notes } },
            { returnDocument: 'after' },
          );
        const doc = unwrap(result);
        if (!doc) throw new AppError(404, 'NOT_FOUND', 'Trade not found');
        return {
          status: 'ok',
          data: paperTradeSchema.parse(doc),
          timestamp: nowIso(),
        };
      } catch (error) {
        handleError(error);
      }
    },
  );

  app.get('/api/v1/paper-analytics', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    await service.markToMarket();
    return {
      status: 'ok',
      data: paperAnalyticsResponseSchema.parse(await service.analytics()),
      timestamp: nowIso(),
    };
  });

  app.get('/api/v1/paper/account', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    await service.markToMarket();
    const account = await service.getAccountState();
    const openOrders = await db
      .collection('paper_orders')
      .countDocuments({ status: 'pending' });
    return {
      status: 'ok',
      data: accountSnapshotResponseSchema.parse({
        startingBalance: account.startingBalance,
        currentBalance: account.equity,
        realizedPnL: account.realizedPnL,
        unrealizedPnL: account.unrealizedPnL,
        totalPnL: round(account.realizedPnL + account.unrealizedPnL),
        accountPnLPct: round(
          ((account.realizedPnL + account.unrealizedPnL) / account.startingBalance) * 100,
        ),
        openPositions: account.openPositions.length,
        openOrders,
        dailyPnL: account.dailyPnL,
      }),
      timestamp: nowIso(),
    };
  });

  app.post<{ Body: unknown }>('/api/v1/paper/reset', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    try {
      const input = resetAccountRequestSchema.parse(request.body);
      if (!input.confirm) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Confirmation required to reset account');
      }
      await Promise.all([
        db.collection('paper_orders').deleteMany({}),
        db.collection('paper_positions').deleteMany({}),
        db.collection('paper_trades').deleteMany({}),
      ]);
      await writeAudit(db, {
        action: 'paper.account.reset',
        actor: request.auth?.user.username ?? 'unknown',
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
        requestId: request.id,
      });
      return {
        status: 'ok',
        data: resetAccountResponseSchema.parse({
          reset: true,
          newBalance: env.PAPER_STARTING_BALANCE,
        }),
        timestamp: nowIso(),
      };
    } catch (error) {
      handleError(error);
    }
  });
}

function unwrap<T>(result: unknown): T | null {
  if (!result) return null;
  const maybe = result as { value?: T };
  if (maybe.value !== undefined) return maybe.value;
  return result as T;
}
