import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { loadEnv } from '@atc/config';
import type { Db } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { AppError, zodDetails } from '../errors.js';
import {
  positionSizeRequestSchema,
  positionSizeResponseSchema,
  validatePlanRequestSchema,
  validatePlanResponseSchema,
  risksLimitsResponseSchema,
  correlateRequestSchema,
  correlateResponseSchema,
  exposureResponseSchema,
  createPaperOrderRequestSchema,
  paperOrderSchema,
  listPaperOrdersQuerySchema,
  listPaperOrdersResponseSchema,
  updatePaperOrderRequestSchema,
  cancelPaperOrderResponseSchema,
  fillPaperOrderRequestSchema,
  fillPaperOrderResponseSchema,
  paperPositionSchema,
  listPaperPositionsResponseSchema,
  closePaperPositionRequestSchema,
  closePaperPositionResponseSchema,
  listPaperTradesQuerySchema,
  paperTradeSchema,
  listPaperTradesResponseSchema,
  updateTradeNotesRequestSchema,
  paperAnalyticsResponseSchema,
  accountSnapshotResponseSchema,
  resetAccountRequestSchema,
  resetAccountResponseSchema,
} from './types.js';

interface PaperTradingRouteOptions {
  db: Db;
  env: ReturnType<typeof loadEnv>;
}

const nowIso = (): string => new Date().toISOString();

/**
 * Register all paper trading and risk engine routes
 */
export async function registerPaperTradingRoutes(
  app: FastifyInstance,
  options: PaperTradingRouteOptions,
): Promise<void> {
  const { db, env } = options;

  // ============================================================================
  // Risk Engine Endpoints
  // ============================================================================

  /**
   * POST /api/v1/risk/position-size
   * Calculate optimal position size based on risk parameters
   */
  app.post<{ Body: unknown }>('/api/v1/risk/position-size', async (request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const input = positionSizeRequestSchema.parse(request.body);

      // Calculate position size using simple risk formula:
      // quantity = (account × risk%) / (entry - stop)
      const riskAmount = (input.accountBalance * input.riskPct) / 100;
      const stopDistance = Math.abs(input.entryPrice - input.stopPrice);

      if (stopDistance === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Stop price cannot equal entry price');
      }

      const quantity = riskAmount / stopDistance;
      const contracts = Math.floor(quantity);
      const cost = input.entryPrice * quantity;
      const maxLoss = stopDistance * quantity;
      const leverage = cost / input.accountBalance;

      const response = positionSizeResponseSchema.parse({
        quantity,
        contracts,
        cost,
        maxLoss,
        leverage,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });

  /**
   * POST /api/v1/risk/validate-plan
   * Validate a complete trade plan against risk limits
   */
  app.post<{ Body: unknown }>('/api/v1/risk/validate-plan', async (request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const input = validatePlanRequestSchema.parse(request.body);
      const violations: string[] = [];
      const suggestions: string[] = [];

      // Get risk limits from config
      const perTradeRiskPct = env.PAPER_RISK_PER_TRADE_PCT ?? 1;
      const dailyLossPct = env.PAPER_MAX_DAILY_LOSS_PCT ?? 3;
      const maxOpenRiskPct = env.PAPER_MAX_OPEN_RISK_PCT ?? 5;
      const maxPositions = env.PAPER_MAX_POSITIONS ?? 3;
      const minRR = env.PAPER_MIN_RR ?? 1.5;

      // Check 1: Per-trade risk
      const tradeRisk = Math.abs(input.entryPrice - input.stopPrice) * input.quantity;
      const accountBalance = 10000; // TODO: Get from account state
      const tradeRiskPct = (tradeRisk / accountBalance) * 100;

      if (tradeRiskPct > perTradeRiskPct) {
        violations.push(`Per-trade risk ${tradeRiskPct.toFixed(2)}% exceeds limit ${perTradeRiskPct}%`);
      }

      // Check 2: Daily loss limit
      if (input.dailyLossUSD > (accountBalance * dailyLossPct) / 100) {
        violations.push(
          `Daily loss $${input.dailyLossUSD.toFixed(2)} exceeds limit $${((accountBalance * dailyLossPct) / 100).toFixed(2)}`,
        );
      }

      // Check 3: R:R ratio
      const rewardDistance = Math.abs(input.targetPrice - input.entryPrice);
      const stopDistance = Math.abs(input.entryPrice - input.stopPrice);
      const rr = rewardDistance / stopDistance;

      if (rr < minRR) {
        violations.push(`R:R ratio ${rr.toFixed(2)} below minimum ${minRR}`);
        suggestions.push(`Increase target price or decrease stop distance to improve R:R`);
      }

      // Check 4: Max positions
      if (input.currentPositions.length >= maxPositions) {
        violations.push(`Max open positions (${maxPositions}) reached`);
      }

      // Check 5: Same instrument
      const sameInstrument = input.currentPositions.filter((p) => p.instrument === input.instrument);
      if (sameInstrument.length > 0) {
        suggestions.push(`Already have ${sameInstrument.length} open position(s) in ${input.instrument}`);
      }

      const valid = violations.length === 0;
      const reason = valid
        ? 'Trade plan passes all validation checks'
        : `Trade plan rejected: ${violations[0]}`;

      const response = validatePlanResponseSchema.parse({
        valid,
        reason,
        violations,
        suggestions,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });

  /**
   * GET /api/v1/risk/limits
   * Retrieve current risk limit configuration
   */
  app.get('/api/v1/risk/limits', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=60');

    const response = risksLimitsResponseSchema.parse({
      perTradeRiskPct: env.PAPER_RISK_PER_TRADE_PCT ?? 1,
      dailyLossPct: env.PAPER_MAX_DAILY_LOSS_PCT ?? 3,
      maxOpenRiskPct: env.PAPER_MAX_OPEN_RISK_PCT ?? 5,
      maxPositions: env.PAPER_MAX_POSITIONS ?? 3,
      minRR: env.PAPER_MIN_RR ?? 1.5,
      correlationThreshold: 0.7,
    });

    return {
      status: 'ok',
      data: response,
      timestamp: nowIso(),
    };
  });

  /**
   * POST /api/v1/risk/correlate
   * Calculate correlation between open positions
   */
  app.post<{ Body: unknown }>('/api/v1/risk/correlate', async (request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const input = correlateRequestSchema.parse(request.body);

      // Simple correlation: if all same direction, high correlation
      // If mixed directions, low correlation
      const sides = input.positions.map((p) => p.side);
      const allBuy = sides.every((s) => s === 'buy');
      const allSell = sides.every((s) => s === 'sell');

      let correlation = 0;
      let risk: 'low' | 'medium' | 'high' = 'low';

      if (allBuy || allSell) {
        correlation = 0.8; // Same direction = high correlation
        risk = input.positions.length > 2 ? 'high' : 'medium';
      } else {
        correlation = 0.2; // Mixed direction = low correlation
        risk = 'low';
      }

      const response = correlateResponseSchema.parse({
        correlation,
        risk,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });

  /**
   * GET /api/v1/risk/exposure
   * Get current risk exposure snapshot
   */
  app.get('/api/v1/risk/exposure', async (_request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const positionsCollection = db.collection('paper_positions');
      const ordersCollection = db.collection('paper_orders');
      const tradesCollection = db.collection('paper_trades');

      const [positions, orders, trades] = await Promise.all([
        positionsCollection.find({ status: 'open' }).toArray(),
        ordersCollection.find({ status: 'pending' }).toArray(),
        tradesCollection
          .find({
            closedAt: {
              $gte: new Date(new Date().toDateString()),
            },
          })
          .toArray(),
      ]);

      // Calculate total open risk from positions
      const totalOpenRisk = positions.reduce((sum, pos) => {
        return sum + Math.abs(pos.unrealizedPnL);
      }, 0);

      // Calculate daily loss from today's trades
      const dailyLoss = trades.reduce((sum, trade) => {
        return sum + (trade.realizedPnL || 0);
      }, 0);

      const response = exposureResponseSchema.parse({
        totalOpenRisk,
        dailyLoss,
        openPositions: positions.length,
        dailyTrades: trades.length,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw error;
    }
  });

  // ============================================================================
  // Paper Trading Endpoints
  // ============================================================================

  /**
   * POST /api/v1/paper-orders
   * Create a new paper order
   */
  app.post<{ Body: unknown }>('/api/v1/paper-orders', async (request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const input = createPaperOrderRequestSchema.parse(request.body);
      const ordersCollection = db.collection('paper_orders');

      const order = {
        orderId: `order_${randomUUID()}`,
        status: 'pending' as const,
        instrument: input.instrument,
        side: input.side,
        entryPrice: input.entryPrice,
        stopPrice: input.stopPrice,
        targetPrice: input.targetPrice,
        quantity: input.quantity,
        createdAt: nowIso(),
        filledAt: null,
        filledPrice: null,
        closedAt: null,
        closePrice: null,
        notes: input.notes || '',
      };

      await ordersCollection.insertOne(order);

      const response = paperOrderSchema.parse(order);

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });

  /**
   * GET /api/v1/paper-orders
   * List paper orders with optional filters
   */
  app.get<{ Querystring: unknown }>('/api/v1/paper-orders', async (request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const query = listPaperOrdersQuerySchema.parse(request.query);
      const ordersCollection = db.collection('paper_orders');

      const filter: Record<string, unknown> = {};
      if (query.status) filter.status = query.status;
      if (query.instrument) filter.instrument = query.instrument;

      const orders = await ordersCollection.find(filter).toArray();

      const response = listPaperOrdersResponseSchema.parse({
        orders,
        total: orders.length,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });

  /**
   * PATCH /api/v1/paper-orders/{id}
   * Modify a pending paper order
   */
  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/paper-orders/:id',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');

      try {
        const { id } = request.params;
        const input = updatePaperOrderRequestSchema.parse(request.body);
        const ordersCollection = db.collection('paper_orders');

        const order = await ordersCollection.findOne({ orderId: id });

        if (!order) {
          throw new AppError(404, 'NOT_FOUND', 'Order not found');
        }

        if (order.status !== 'pending') {
          throw new AppError(400, 'VALIDATION_ERROR', `Cannot modify ${order.status} order`);
        }

        const update: Record<string, unknown> = {};
        if (input.stopPrice !== undefined) update.stopPrice = input.stopPrice;
        if (input.targetPrice !== undefined) update.targetPrice = input.targetPrice;
        if (input.quantity !== undefined) update.quantity = input.quantity;
        if (input.notes !== undefined) update.notes = input.notes;

        const result = await ordersCollection.findOneAndUpdate(
          { orderId: id },
          { $set: update },
          { returnDocument: 'after' },
        );

        if (!result || !result.value) {
          throw new AppError(404, 'NOT_FOUND', 'Order not found');
        }

        const response = paperOrderSchema.parse(result.value);

        return {
          status: 'ok',
          data: response,
          timestamp: nowIso(),
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof ZodError) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
        }
        throw error;
      }
    },
  );

  /**
   * DELETE /api/v1/paper-orders/{id}
   * Cancel a pending paper order
   */
  app.delete<{ Params: { id: string } }>('/api/v1/paper-orders/:id', async (request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const { id } = request.params;
      const ordersCollection = db.collection('paper_orders');

      const order = await ordersCollection.findOne({ orderId: id });

      if (!order) {
        throw new AppError(404, 'NOT_FOUND', 'Order not found');
      }

      if (order.status !== 'pending') {
        throw new AppError(400, 'VALIDATION_ERROR', `Cannot cancel ${order.status} order`);
      }

      await ordersCollection.updateOne({ orderId: id }, { $set: { status: 'cancelled' } });

      const response = cancelPaperOrderResponseSchema.parse({
        cancelled: true,
        orderId: id,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw error;
    }
  });

  /**
   * POST /api/v1/paper-orders/{id}/fill
   * Fill a pending paper order (internal endpoint)
   */
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/paper-orders/:id/fill',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');

      try {
        const { id } = request.params;
        const input = fillPaperOrderRequestSchema.parse(request.body);
        const ordersCollection = db.collection('paper_orders');
        const positionsCollection = db.collection('paper_positions');

        const order = await ordersCollection.findOne({ orderId: id });

        if (!order) {
          throw new AppError(404, 'NOT_FOUND', 'Order not found');
        }

        if (order.status !== 'pending') {
          throw new AppError(400, 'VALIDATION_ERROR', `Cannot fill ${order.status} order`);
        }

        // Determine fill price based on side
        const fillPrice = order.side === 'buy' ? input.currentAsk : input.currentBid;
        const cost = fillPrice * order.quantity;

        // Update order status
        await ordersCollection.updateOne(
          { orderId: id },
          {
            $set: {
              status: 'filled',
              filledAt: nowIso(),
              filledPrice: fillPrice,
            },
          },
        );

        // Create position
        const position = {
          positionId: `pos_${randomUUID()}`,
          orderId: id,
          instrument: order.instrument,
          side: order.side,
          quantity: order.quantity,
          entryPrice: fillPrice,
          currentPrice: fillPrice,
          stopPrice: order.stopPrice,
          targetPrice: order.targetPrice,
          unrealizedPnL: 0,
          unrealizedPnLPct: 0,
          openedAt: nowIso(),
          status: 'open',
        };

        await positionsCollection.insertOne(position);

        const response = fillPaperOrderResponseSchema.parse({
          filled: true,
          fillPrice,
          cost,
          orderId: id,
        });

        return {
          status: 'ok',
          data: response,
          timestamp: nowIso(),
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof ZodError) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
        }
        throw error;
      }
    },
  );

  /**
   * GET /api/v1/paper-positions
   * Get current open positions
   */
  app.get('/api/v1/paper-positions', async (_request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const positionsCollection = db.collection('paper_positions');

      const positions = await positionsCollection.find({ status: 'open' }).toArray();

      const response = listPaperPositionsResponseSchema.parse({
        positions,
        total: positions.length,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw error;
    }
  });

  /**
   * PATCH /api/v1/paper-positions/{id}/close
   * Close an open position
   */
  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/paper-positions/:id/close',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');

      try {
        const { id } = request.params;
        const input = closePaperPositionRequestSchema.parse(request.body);
        const positionsCollection = db.collection('paper_positions');
        const tradesCollection = db.collection('paper_trades');
        const ordersCollection = db.collection('paper_orders');

        const position = await positionsCollection.findOne({ positionId: id });

        if (!position) {
          throw new AppError(404, 'NOT_FOUND', 'Position not found');
        }

        if (position.status !== 'open') {
          throw new AppError(400, 'VALIDATION_ERROR', `Cannot close ${position.status} position`);
        }

        // Calculate P&L
        const priceChange = position.side === 'buy' ? input.closePrice - position.entryPrice : position.entryPrice - input.closePrice;
        const realizedPnL = priceChange * position.quantity;
        const rMultiple = realizedPnL / Math.abs((position.entryPrice - position.stopPrice) * position.quantity);

        // Close position
        await positionsCollection.updateOne(
          { positionId: id },
          {
            $set: {
              status: 'closed',
              currentPrice: input.closePrice,
              closedAt: nowIso(),
            },
          },
        );

        // Get order to retrieve entry price
        const order = await ordersCollection.findOne({ orderId: position.orderId });

        // Create closed trade record
        const trade = {
          tradeId: `trade_${randomUUID()}`,
          orderId: position.orderId,
          positionId: id,
          instrument: position.instrument,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice: input.closePrice,
          quantity: position.quantity,
          realizedPnL,
          rMultiple: realizedPnL > 0 ? rMultiple : rMultiple, // Can be negative
          createdAt: order?.createdAt || nowIso(),
          closedAt: nowIso(),
          closeReason: input.reason,
          notes: '',
        };

        await tradesCollection.insertOne(trade);

        const response = closePaperPositionResponseSchema.parse({
          closed: true,
          realizedPnL,
          rMultiple: realizedPnL !== 0 ? rMultiple : null,
          positionId: id,
        });

        return {
          status: 'ok',
          data: response,
          timestamp: nowIso(),
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof ZodError) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
        }
        throw error;
      }
    },
  );

  /**
   * GET /api/v1/paper-trades
   * Get closed trades with pagination
   */
  app.get<{ Querystring: unknown }>('/api/v1/paper-trades', async (request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const query = listPaperTradesQuerySchema.parse(request.query);
      const tradesCollection = db.collection('paper_trades');

      const filter: Record<string, unknown> = {};
      if (query.instrument) filter.instrument = query.instrument;

      const trades = await tradesCollection
        .find(filter)
        .sort({ closedAt: -1 })
        .skip(query.offset)
        .limit(query.limit)
        .toArray();

      const total = await tradesCollection.countDocuments(filter);

      const response = listPaperTradesResponseSchema.parse({
        trades,
        total,
        limit: query.limit,
        offset: query.offset,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });

  /**
   * PATCH /api/v1/paper-trades/{id}/notes
   * Add or update notes on a closed trade
   */
  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/paper-trades/:id/notes',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');

      try {
        const { id } = request.params;
        const input = updateTradeNotesRequestSchema.parse(request.body);
        const tradesCollection = db.collection('paper_trades');

        const result = await tradesCollection.findOneAndUpdate(
          { tradeId: id },
          { $set: { notes: input.notes } },
          { returnDocument: 'after' },
        );

        if (!result || !result.value) {
          throw new AppError(404, 'NOT_FOUND', 'Trade not found');
        }

        const response = paperTradeSchema.parse(result.value);

        return {
          status: 'ok',
          data: response,
          timestamp: nowIso(),
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof ZodError) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
        }
        throw error;
      }
    },
  );

  /**
   * GET /api/v1/paper-analytics
   * Get aggregated performance metrics
   */
  app.get('/api/v1/paper-analytics', async (_request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const tradesCollection = db.collection('paper_trades');
      const positionsCollection = db.collection('paper_positions');

      const [closedTrades, openPositions] = await Promise.all([
        tradesCollection.find({}).toArray(),
        positionsCollection.find({ status: 'open' }).toArray(),
      ]);

      const totalRealizedPnL = closedTrades.reduce((sum, trade) => sum + (trade.realizedPnL || 0), 0);
      const unrealizedPnL = openPositions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);

      const winningTrades = closedTrades.filter((t) => (t.realizedPnL || 0) > 0);
      const losingTrades = closedTrades.filter((t) => (t.realizedPnL || 0) < 0);

      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

      const totalWins = winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
      const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0));
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

      const expectancy = closedTrades.length > 0 ? totalRealizedPnL / closedTrades.length : 0;

      // Calculate max drawdown (simplified)
      let maxDD = 0;
      let runningBalance = env.PAPER_STARTING_BALANCE ?? 10000;
      let peak = runningBalance;

      for (const trade of closedTrades) {
        runningBalance += trade.realizedPnL || 0;
        if (runningBalance > peak) peak = runningBalance;
        const dd = ((peak - runningBalance) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
      }

      const accountBalance = (env.PAPER_STARTING_BALANCE ?? 10000) + totalRealizedPnL + unrealizedPnL;

      const response = paperAnalyticsResponseSchema.parse({
        totalTrades: closedTrades.length,
        openTrades: openPositions.length,
        closedTrades: closedTrades.length,
        winRate,
        profitFactor,
        expectancy,
        maxDD,
        totalRealizedPnL,
        accountBalance,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw error;
    }
  });

  /**
   * GET /api/v1/paper/account
   * Get account snapshot
   */
  app.get('/api/v1/paper/account', async (_request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const tradesCollection = db.collection('paper_trades');
      const positionsCollection = db.collection('paper_positions');

      const [trades, positions] = await Promise.all([
        tradesCollection.find({}).toArray(),
        positionsCollection.find({ status: 'open' }).toArray(),
      ]);

      const startingBalance = env.PAPER_STARTING_BALANCE ?? 10000;
      const realizedPnL = trades.reduce((sum, trade) => sum + (trade.realizedPnL || 0), 0);
      const unrealizedPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);
      const totalPnL = realizedPnL + unrealizedPnL;
      const currentBalance = startingBalance + totalPnL;
      const accountPnLPct = (totalPnL / startingBalance) * 100;

      const response = accountSnapshotResponseSchema.parse({
        startingBalance,
        currentBalance,
        realizedPnL,
        unrealizedPnL,
        totalPnL,
        accountPnLPct,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw error;
    }
  });

  /**
   * POST /api/v1/paper/reset
   * Reset paper trading account
   */
  app.post<{ Body: unknown }>('/api/v1/paper/reset', async (request, reply) => {
    reply.header('cache-control', 'no-store');

    try {
      const input = resetAccountRequestSchema.parse(request.body);

      if (!input.confirm) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Confirmation required to reset account');
      }

      const [ordersCollection, positionsCollection, tradesCollection] = [
        db.collection('paper_orders'),
        db.collection('paper_positions'),
        db.collection('paper_trades'),
      ];

      // Delete all trading data
      await Promise.all([
        ordersCollection.deleteMany({}),
        positionsCollection.deleteMany({}),
        tradesCollection.deleteMany({}),
      ]);

      const newBalance = env.PAPER_STARTING_BALANCE ?? 10000;

      const response = resetAccountResponseSchema.parse({
        reset: true,
        newBalance,
      });

      return {
        status: 'ok',
        data: response,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });
}
