import { z } from 'zod';
import {
  instrumentSymbolSchema,
  sideSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  isoDateSchema,
} from '@atc/shared';

/**
 * Paper Trading API request/response schemas
 */

const riskDecisionSchema = z.object({
  approved: z.boolean(),
  code: z.string().nullable(),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  riskAmount: z.number(),
  riskPct: z.number(),
  rewardRisk: z.number(),
  notionalUSD: z.number(),
  leverage: z.number(),
  computedAt: isoDateSchema,
});

// ============================================================================
// Risk Engine Endpoints
// ============================================================================

/**
 * POST /api/v1/risk/position-size
 * Calculate optimal position size based on risk parameters
 */
export const positionSizeRequestSchema = z.object({
  instrument: instrumentSymbolSchema,
  accountBalance: positiveNumberSchema,
  riskPct: z.number().positive().max(100),
  entryPrice: positiveNumberSchema,
  stopPrice: positiveNumberSchema,
  side: sideSchema,
});

export const positionSizeResponseSchema = z.object({
  quantity: z.number().nonnegative(),
  contracts: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  maxLoss: z.number().nonnegative(),
  leverage: nonNegativeNumberSchema,
  riskPct: z.number(),
});

/**
 * POST /api/v1/risk/validate-plan
 * Validate a complete trade plan against risk limits
 */
export const validatePlanRequestSchema = z.object({
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  entryPrice: positiveNumberSchema,
  stopPrice: positiveNumberSchema,
  targetPrice: positiveNumberSchema,
  quantity: positiveNumberSchema,
  currentPositions: z
    .array(
      z.object({
        instrument: instrumentSymbolSchema,
        side: sideSchema,
        quantity: positiveNumberSchema,
        entryPrice: positiveNumberSchema,
        stopPrice: positiveNumberSchema.optional(),
      }),
    )
    .default([]),
  openOrders: z
    .array(
      z.object({
        instrument: instrumentSymbolSchema,
        side: sideSchema,
        quantity: positiveNumberSchema,
        entryPrice: positiveNumberSchema,
        stopPrice: positiveNumberSchema.optional(),
        targetPrice: positiveNumberSchema.optional(),
        createdAt: isoDateSchema.optional(),
      }),
    )
    .default([]),
  dailyLossUSD: z.number().default(0),
  accountBalance: positiveNumberSchema.optional(),
});

export const validatePlanResponseSchema = z.object({
  valid: z.boolean(),
  reason: z.string(),
  code: z.string().nullable().optional(),
  violations: z.array(z.string()),
  suggestions: z.array(z.string()),
  checks: z
    .array(
      z.object({
        id: z.string(),
        ok: z.boolean(),
        detail: z.string(),
      }),
    )
    .optional(),
  riskAmount: z.number().optional(),
  riskPct: z.number().optional(),
  rewardRisk: z.number().optional(),
  leverage: z.number().optional(),
});

/**
 * GET /api/v1/risk/limits
 * Retrieve current risk limit configuration
 */
export const risksLimitsResponseSchema = z.object({
  perTradeRiskPct: positiveNumberSchema,
  dailyLossPct: positiveNumberSchema,
  maxOpenRiskPct: positiveNumberSchema,
  maxPositions: z.number().int().positive(),
  minRR: positiveNumberSchema,
  correlationThreshold: z.number().min(0).max(1),
  maxLeverage: z.number().positive().optional(),
  eventBlackoutMinutes: z.number().int().nonnegative().optional(),
  killSwitchEnabled: z.boolean().optional(),
  killSwitchReason: z.string().nullable().optional(),
  commissionPerLot: z.number().nonnegative().optional(),
  slippagePips: z.number().nonnegative().optional(),
});

/**
 * GET/POST /api/v1/risk/kill-switch
 */
export const killSwitchStateSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional().default(''),
  updatedAt: isoDateSchema.nullable().optional(),
});

export const killSwitchRequestSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/v1/risk/correlate
 * Calculate correlation between open positions
 */
export const correlateRequestSchema = z.object({
  positions: z.array(
    z.object({
      instrument: instrumentSymbolSchema,
      side: sideSchema,
      quantity: positiveNumberSchema,
      currentPrice: positiveNumberSchema,
    }),
  ),
});

export const correlateResponseSchema = z.object({
  correlation: z.number().min(-1).max(1),
  risk: z.enum(['low', 'medium', 'high']),
  pairs: z
    .array(
      z.object({
        instrument: instrumentSymbolSchema,
        correlation: z.number(),
      }),
    )
    .optional(),
});

/**
 * GET /api/v1/risk/exposure
 * Get current risk exposure snapshot
 */
export const exposureResponseSchema = z.object({
  totalOpenRisk: nonNegativeNumberSchema,
  dailyLoss: z.number(),
  openPositions: z.number().int().nonnegative(),
  dailyTrades: z.number().int().nonnegative(),
  maxOpenRisk: nonNegativeNumberSchema.optional(),
  riskUtilisationPct: z.number().optional(),
  killSwitchEnabled: z.boolean().optional(),
});

// ============================================================================
// Paper Trading Endpoints
// ============================================================================

/**
 * POST /api/v1/paper-orders
 * Create a new paper order
 */
export const createPaperOrderRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  type: z.enum(['market', 'limit']).default('market'),
  entryPrice: positiveNumberSchema,
  stopPrice: positiveNumberSchema,
  targetPrice: positiveNumberSchema,
  quantity: positiveNumberSchema.optional(),
  riskPct: z.number().positive().max(100).optional(),
  limitPrice: positiveNumberSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const paperOrderSchema = z.object({
  orderId: z.string().min(1),
  idempotencyKey: z.string().optional(),
  status: z.enum(['pending', 'filled', 'closed', 'cancelled', 'rejected']),
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  type: z.enum(['market', 'limit']).optional(),
  entryPrice: positiveNumberSchema,
  stopPrice: positiveNumberSchema,
  targetPrice: positiveNumberSchema,
  quantity: positiveNumberSchema,
  createdAt: isoDateSchema,
  filledAt: isoDateSchema.nullable(),
  filledPrice: positiveNumberSchema.nullable(),
  closedAt: isoDateSchema.nullable(),
  closePrice: positiveNumberSchema.nullable(),
  notes: z.string().max(500),
  commission: z.number().nonnegative().optional(),
  slippage: z.number().nonnegative().optional(),
  riskDecision: riskDecisionSchema.nullable().optional(),
});

/**
 * GET /api/v1/paper-orders
 * List paper orders with optional filters
 */
export const listPaperOrdersQuerySchema = z.object({
  status: z.enum(['pending', 'filled', 'closed', 'cancelled', 'rejected']).optional(),
  instrument: instrumentSymbolSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export const listPaperOrdersResponseSchema = z.object({
  orders: z.array(paperOrderSchema),
  total: z.number().int().nonnegative(),
});

/**
 * PATCH /api/v1/paper-orders/{id}
 * Modify a pending paper order
 */
export const updatePaperOrderRequestSchema = z.object({
  stopPrice: positiveNumberSchema.optional(),
  targetPrice: positiveNumberSchema.optional(),
  quantity: positiveNumberSchema.optional(),
  notes: z.string().max(500).optional(),
});

/**
 * DELETE /api/v1/paper-orders/{id}
 * Cancel a pending paper order
 */
export const cancelPaperOrderResponseSchema = z.object({
  cancelled: z.boolean(),
  orderId: z.string().min(1),
});

/**
 * POST /api/v1/paper-orders/{id}/fill
 * Fill a pending paper order (internal, called by scheduler)
 */
export const fillPaperOrderRequestSchema = z.object({
  currentBid: positiveNumberSchema,
  currentAsk: positiveNumberSchema,
});

export const fillPaperOrderResponseSchema = z.object({
  filled: z.boolean(),
  fillPrice: positiveNumberSchema,
  cost: nonNegativeNumberSchema,
  commission: nonNegativeNumberSchema.optional(),
  slippage: nonNegativeNumberSchema.optional(),
  orderId: z.string().min(1),
  positionId: z.string().optional(),
});

/**
 * GET /api/v1/paper-positions
 * Get current open positions
 */
export const paperPositionSchema = z.object({
  id: z.string().min(1),
  positionId: z.string().optional(),
  orderId: z.string().optional(),
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  quantity: positiveNumberSchema,
  entryPrice: positiveNumberSchema,
  currentPrice: positiveNumberSchema,
  stopPrice: positiveNumberSchema.optional(),
  targetPrice: positiveNumberSchema.optional(),
  unrealizedPnL: z.number(),
  unrealizedPnLPct: z.number(),
  riskAmount: z.number().optional(),
  openedAt: isoDateSchema.optional(),
  status: z.string().optional(),
});

export const listPaperPositionsResponseSchema = z.object({
  positions: z.array(paperPositionSchema),
  total: z.number().int().nonnegative(),
});

/**
 * PATCH /api/v1/paper-positions/{id}/close
 * Close an open position
 */
export const closePaperPositionRequestSchema = z.object({
  closePrice: positiveNumberSchema.optional(),
  reason: z.enum(['manual', 'stop', 'target']).default('manual'),
});

export const closePaperPositionResponseSchema = z.object({
  closed: z.boolean(),
  realizedPnL: z.number(),
  grossPnL: z.number().optional(),
  costs: z.number().optional(),
  rMultiple: z.number().nullable(),
  positionId: z.string().min(1),
  tradeId: z.string().optional(),
});

/**
 * POST /api/v1/paper/evaluate
 * Evaluate open positions against current quotes and close on stop/target.
 */
export const evaluatePositionsRequestSchema = z.object({
  quotes: z
    .array(
      z.object({
        instrument: instrumentSymbolSchema,
        bid: positiveNumberSchema,
        ask: positiveNumberSchema,
      }),
    )
    .default([]),
});

export const evaluatePositionsResponseSchema = z.object({
  evaluated: z.number().int().nonnegative(),
  closed: z.array(
    z.object({
      positionId: z.string(),
      instrument: instrumentSymbolSchema,
      reason: z.enum(['stop', 'target']),
      exitPrice: positiveNumberSchema,
      realizedPnL: z.number(),
    }),
  ),
});

/**
 * GET /api/v1/paper-trades
 * Get closed trades with pagination
 */
export const listPaperTradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  instrument: instrumentSymbolSchema.optional(),
});

export const paperTradeSchema = z.object({
  id: z.string().min(1),
  tradeId: z.string().optional(),
  orderId: z.string().optional(),
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  entryPrice: positiveNumberSchema,
  exitPrice: positiveNumberSchema,
  quantity: positiveNumberSchema,
  grossPnL: z.number().optional(),
  costs: z.number().optional(),
  realizedPnL: z.number(),
  pnLPct: z.number().optional(),
  rMultiple: z.number().nullable(),
  createdAt: isoDateSchema,
  closedAt: isoDateSchema,
  closeReason: z.enum(['stop', 'target', 'manual']).optional(),
  notes: z.string().max(500),
});

export const listPaperTradesResponseSchema = z.object({
  trades: z.array(paperTradeSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

/**
 * PATCH /api/v1/paper-trades/{id}/notes
 * Add or update notes on a closed trade
 */
export const updateTradeNotesRequestSchema = z.object({
  notes: z.string().max(500),
});

/**
 * GET /api/v1/paper-analytics
 * Get aggregated performance metrics
 */
export const paperAnalyticsResponseSchema = z.object({
  totalTrades: z.number().int().nonnegative(),
  openTrades: z.number().int().nonnegative(),
  closedTrades: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(100),
  profitFactor: nonNegativeNumberSchema.nullable(),
  expectancy: z.number(),
  maxDD: z.number(),
  totalRealizedPnL: z.number(),
  accountBalance: z.number(),
  averageR: z.number().nullable().optional(),
  totalR: z.number().nullable().optional(),
  averageWin: z.number().optional(),
  averageLoss: z.number().optional(),
});

/**
 * GET /api/v1/paper/account
 * Get account snapshot
 */
export const accountSnapshotResponseSchema = z.object({
  startingBalance: positiveNumberSchema,
  currentBalance: z.number(),
  realizedPnL: z.number(),
  unrealizedPnL: z.number(),
  totalPnL: z.number(),
  accountPnLPct: z.number(),
  openPositions: z.number().int().nonnegative().optional(),
  openOrders: z.number().int().nonnegative().optional(),
  dailyPnL: z.number().optional(),
});

/**
 * POST /api/v1/paper/reset
 * Reset paper trading account
 */
export const resetAccountRequestSchema = z.object({
  confirm: z.literal(true),
});

export const resetAccountResponseSchema = z.object({
  reset: z.boolean(),
  newBalance: positiveNumberSchema,
});

// Type exports
export type PositionSizeRequest = z.infer<typeof positionSizeRequestSchema>;
export type PositionSizeResponse = z.infer<typeof positionSizeResponseSchema>;
export type ValidatePlanRequest = z.infer<typeof validatePlanRequestSchema>;
export type ValidatePlanResponse = z.infer<typeof validatePlanResponseSchema>;
export type RiskLimitsResponse = z.infer<typeof risksLimitsResponseSchema>;
export type KillSwitchState = z.infer<typeof killSwitchStateSchema>;
export type CorrelateRequest = z.infer<typeof correlateRequestSchema>;
export type CorrelateResponse = z.infer<typeof correlateResponseSchema>;
export type ExposureResponse = z.infer<typeof exposureResponseSchema>;

export type CreatePaperOrderRequest = z.infer<typeof createPaperOrderRequestSchema>;
export type PaperOrder = z.infer<typeof paperOrderSchema>;
export type ListPaperOrdersQuery = z.infer<typeof listPaperOrdersQuerySchema>;
export type ListPaperOrdersResponse = z.infer<typeof listPaperOrdersResponseSchema>;
export type UpdatePaperOrderRequest = z.infer<typeof updatePaperOrderRequestSchema>;
export type CancelPaperOrderResponse = z.infer<typeof cancelPaperOrderResponseSchema>;
export type FillPaperOrderRequest = z.infer<typeof fillPaperOrderRequestSchema>;
export type FillPaperOrderResponse = z.infer<typeof fillPaperOrderResponseSchema>;

export type PaperPosition = z.infer<typeof paperPositionSchema>;
export type ListPaperPositionsResponse = z.infer<typeof listPaperPositionsResponseSchema>;
export type ClosePaperPositionRequest = z.infer<typeof closePaperPositionRequestSchema>;
export type ClosePaperPositionResponse = z.infer<typeof closePaperPositionResponseSchema>;
export type EvaluatePositionsRequest = z.infer<typeof evaluatePositionsRequestSchema>;
export type EvaluatePositionsResponse = z.infer<typeof evaluatePositionsResponseSchema>;

export type ListPaperTradesQuery = z.infer<typeof listPaperTradesQuerySchema>;
export type PaperTrade = z.infer<typeof paperTradeSchema>;
export type ListPaperTradesResponse = z.infer<typeof listPaperTradesResponseSchema>;
export type UpdateTradeNotesRequest = z.infer<typeof updateTradeNotesRequestSchema>;

export type PaperAnalyticsResponse = z.infer<typeof paperAnalyticsResponseSchema>;
export type AccountSnapshotResponse = z.infer<typeof accountSnapshotResponseSchema>;
export type ResetAccountRequest = z.infer<typeof resetAccountRequestSchema>;
export type ResetAccountResponse = z.infer<typeof resetAccountResponseSchema>;
