import { z } from 'zod';

export const tradePlanInputSchema = z.object({
  instrument: z.enum(['XAU/USD', 'EUR/USD', 'GBP/USD']),
  side: z.enum(['buy', 'sell']),
  entry: z.number().positive(),
  stop: z.number().positive(),
  target: z.number().positive(),
  accountEquity: z.number().positive(),
  accountCurrency: z.literal('USD'),
});

export const positionSizeOutputSchema = z.object({
  quantityLots: z.number().nonnegative(),
  notionalUSD: z.number().nonnegative(),
  riskAmount: z.number().nonnegative(),
  riskPct: z.number().nonnegative(),
  rewardAmount: z.number().nonnegative(),
  rewardRisk: z.number().nonnegative(),
  stopDistance: z.number().nonnegative(),
  targetDistance: z.number().nonnegative(),
  pipValuePerLot: z.number().positive(),
});

export const riskLimitsSchema = z.object({
  perTradeLimitUSD: z.number().positive(),
  dailyLossLimitUSD: z.number().positive(),
  openRiskLimitUSD: z.number().positive(),
  maxPositions: z.number().int().positive(),
  minRewardRisk: z.number().positive(),
});

export const limitCheckResultSchema = z.object({
  perTradeOk: z.boolean(),
  dailyLossOk: z.boolean(),
  openRiskOk: z.boolean(),
  maxPositionsOk: z.boolean(),
  minRROk: z.boolean(),
  allOk: z.boolean(),
  violations: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const riskValidationResultSchema = z.object({
  approved: z.boolean(),
  positionSize: positionSizeOutputSchema,
  limitCheck: limitCheckResultSchema,
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  inputsUsed: z.record(z.unknown()),
  computedAt: z.string().datetime(),
});

export const accountStateSchema = z.object({
  equity: z.number().positive(),
  dailyPnL: z.number(),
  openPositions: z.array(
    z.object({
      id: z.string(),
      instrument: z.enum(['XAU/USD', 'EUR/USD', 'GBP/USD']),
      side: z.enum(['buy', 'sell']),
      quantityLots: z.number().positive(),
      entryPrice: z.number().positive(),
      currentPrice: z.number().positive(),
      unrealizedPnL: z.number(),
      riskAmount: z.number().nonnegative(),
    }),
  ),
  openOrders: z.array(
    z.object({
      id: z.string(),
      instrument: z.enum(['XAU/USD', 'EUR/USD', 'GBP/USD']),
      side: z.enum(['buy', 'sell']),
      quantityLots: z.number().positive(),
      requestedPrice: z.number().positive().nullable(),
      stopLoss: z.number().positive(),
      takeProfit: z.number().positive(),
      createdAt: z.string().datetime(),
    }),
  ),
});
