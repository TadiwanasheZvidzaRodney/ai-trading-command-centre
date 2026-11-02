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
  cost: positiveNumberSchema,
  maxLoss: positiveNumberSchema,
  leverage: nonNegativeNumberSchema,
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
  currentPositions: z.array(
    z.object({
      instrument: instrumentSymbolSchema,
      side: sideSchema,
      quantity: positiveNumberSchema,
      entryPrice: positiveNumberSchema,
    }),
  ),
  dailyLossUSD: z.number(),
});

export const validatePlanResponseSchema = z.object({
  valid: z.boolean(),
  reason: z.string(),
  violations: z.array(z.string()),
  suggestions: z.array(z.string()),
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
});

// ============================================================================
// Paper Trading Endpoints
// ============================================================================

/**
 * POST /api/v1/paper-orders
 * Create a new paper order
 */
export const createPaperOrderRequestSchema = z.object({
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  entryPrice: positiveNumberSchema,
  stopPrice: positiveNumberSchema,
  targetPrice: positiveNumberSchema,
  quantity: positiveNumberSchema,
  notes: z.string().max(500).optional(),
});

export const paperOrderSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['pending', 'filled', 'closed', 'cancelled']),
  instrument: instrumentSymbolSchema,
  side: sideSchema,
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
});

/**
 * GET /api/v1/paper-orders
 * List paper orders with optional filters
 */
export const listPaperOrdersQuerySchema = z.object({
  status: z.enum(['pending', 'filled', 'closed', 'cancelled']).optional(),
  instrument: instrumentSymbolSchema.optional(),
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
  cost: positiveNumberSchema,
  orderId: z.string().min(1),
});

/**
 * GET /api/v1/paper-positions
 * Get current open positions
 */
export const paperPositionSchema = z.object({
  id: z.string().min(1),
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  quantity: positiveNumberSchema,
  entryPrice: positiveNumberSchema,
  currentPrice: positiveNumberSchema,
  unrealizedPnL: z.number(),
  unrealizedPnLPct: z.number(),
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
  closePrice: positiveNumberSchema,
  reason: z.enum(['manual', 'stop', 'target']),
});

export const closePaperPositionResponseSchema = z.object({
  closed: z.boolean(),
  realizedPnL: z.number(),
  rMultiple: z.number().nullable(),
  positionId: z.string().min(1),
});

/**
 * GET /api/v1/paper-trades
 * Get closed trades with pagination
 */
export const listPaperTradesQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0),
  instrument: instrumentSymbolSchema.optional(),
});

export const paperTradeSchema = z.object({
  id: z.string().min(1),
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  entryPrice: positiveNumberSchema,
  exitPrice: positiveNumberSchema,
  quantity: positiveNumberSchema,
  realizedPnL: z.number(),
  rMultiple: z.number().nullable(),
  createdAt: isoDateSchema,
  closedAt: isoDateSchema,
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
  profitFactor: nonNegativeNumberSchema,
  expectancy: z.number(),
  maxDD: z.number(),
  totalRealizedPnL: z.number(),
  accountBalance: positiveNumberSchema,
});

/**
 * GET /api/v1/paper/account
 * Get account snapshot
 */
export const accountSnapshotResponseSchema = z.object({
  startingBalance: positiveNumberSchema,
  currentBalance: positiveNumberSchema,
  realizedPnL: z.number(),
  unrealizedPnL: z.number(),
  totalPnL: z.number(),
  accountPnLPct: z.number(),
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

export type ListPaperTradesQuery = z.infer<typeof listPaperTradesQuerySchema>;
export type PaperTrade = z.infer<typeof paperTradeSchema>;
export type ListPaperTradesResponse = z.infer<typeof listPaperTradesResponseSchema>;
export type UpdateTradeNotesRequest = z.infer<typeof updateTradeNotesRequestSchema>;

export type PaperAnalyticsResponse = z.infer<typeof paperAnalyticsResponseSchema>;
export type AccountSnapshotResponse = z.infer<typeof accountSnapshotResponseSchema>;
export type ResetAccountRequest = z.infer<typeof resetAccountRequestSchema>;
export type ResetAccountResponse = z.infer<typeof resetAccountResponseSchema>;
