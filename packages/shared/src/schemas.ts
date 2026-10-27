import { z } from 'zod';
import { INSTRUMENT_VALUES, TIMEFRAME_VALUES } from './constants.js';

export const instrumentSymbolSchema = z.enum(INSTRUMENT_VALUES);
export const timeframeSchema = z.enum(TIMEFRAME_VALUES);
export const sideSchema = z.enum(['buy', 'sell']);
export const orderTypeSchema = z.enum(['market', 'limit']);
export const impactSchema = z.enum(['high', 'medium', 'low', 'holiday', 'unknown']);

export const isoDateSchema = z
  .string()
  .min(10)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO timestamp');

export const positiveNumberSchema = z.number().finite().positive();
export const nonNegativeNumberSchema = z.number().finite().nonnegative();

export const providerInfoSchema = z.object({
  id: z.string().min(1).max(80),
  displayName: z.string().min(1).max(120),
  quality: z.enum(['live', 'delayed', 'reference', 'proxy']),
  delaySeconds: z.number().int().nonnegative().optional(),
  url: z.string().url().max(500).optional(),
  note: z.string().max(500).optional(),
});

export const quoteSchema = z.object({
  instrument: instrumentSymbolSchema,
  bid: positiveNumberSchema.nullable(),
  ask: positiveNumberSchema.nullable(),
  mid: positiveNumberSchema,
  spread: nonNegativeNumberSchema.nullable(),
  provider: providerInfoSchema,
  observedAt: isoDateSchema,
  fetchedAt: isoDateSchema,
  ageSeconds: z.number().int().nonnegative(),
  stale: z.boolean(),
  quality: z.enum(['live', 'delayed', 'reference', 'proxy']),
  proxy: z.boolean(),
  proxyFor: instrumentSymbolSchema.optional(),
  note: z.string().max(500).optional(),
});

export const candleSchema = z.object({
  time: z.number().int().nonnegative(),
  open: positiveNumberSchema,
  high: positiveNumberSchema,
  low: positiveNumberSchema,
  close: positiveNumberSchema,
  volume: nonNegativeNumberSchema.nullable(),
});

export const candleSeriesSchema = z.object({
  instrument: instrumentSymbolSchema,
  timeframe: timeframeSchema,
  provider: providerInfoSchema,
  candles: z.array(candleSchema),
  fetchedAt: isoDateSchema,
  from: isoDateSchema,
  to: isoDateSchema,
  quality: z.enum(['live', 'delayed', 'reference', 'proxy']),
  proxy: z.boolean(),
  proxyFor: instrumentSymbolSchema.optional(),
  duplicatesRemoved: z.number().int().nonnegative(),
  gaps: z.array(
    z.object({
      after: z.number().int().nonnegative(),
      before: z.number().int().nonnegative(),
      missing: z.number().int().nonnegative(),
      expected: z.boolean(),
    }),
  ),
  notes: z.array(z.string().max(500)),
});

export const providerHealthSchema = z.object({
  providerId: z.string().min(1).max(80),
  displayName: z.string().min(1).max(120),
  category: z.enum(['market-data', 'news', 'calendar', 'ai']),
  status: z.enum(['ok', 'degraded', 'error', 'not_configured']),
  configured: z.boolean(),
  quality: z.enum(['live', 'delayed', 'reference', 'proxy']),
  lastSuccessAt: isoDateSchema.nullable(),
  lastErrorAt: isoDateSchema.nullable(),
  lastError: z.string().max(1000).nullable(),
  latencyMs: z.number().nonnegative().nullable(),
  message: z.string().max(1000),
});

export const newsItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  summary: z.string().max(4000),
  url: z.string().url().max(2000),
  source: z.string().min(1).max(200),
  publishedAt: isoDateSchema,
  fetchedAt: isoDateSchema,
  currencies: z.array(z.string().max(3)).max(10),
  instruments: z.array(instrumentSymbolSchema).max(3),
  relevance: z.number().min(0).max(1),
  tags: z.array(z.string().max(80)).max(20),
});

export const calendarEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  currency: z.string().min(1).max(8),
  country: z.string().min(1).max(80),
  impact: impactSchema,
  scheduledAt: isoDateSchema,
  forecast: z.string().max(100).nullable(),
  previous: z.string().max(100).nullable(),
  actual: z.string().max(100).nullable(),
  source: z.string().min(1).max(120),
  sourceUrl: z.string().url().max(2000).optional(),
  fetchedAt: isoDateSchema,
  instruments: z.array(instrumentSymbolSchema).max(3),
  note: z.string().max(500).optional(),
});

export const quoteQuerySchema = z.object({
  symbols: z.string().max(200).optional(),
});

export const candleQuerySchema = z.object({
  timeframe: timeframeSchema.default('1d'),
  limit: z.coerce.number().int().min(10).max(5000).default(500),
});

export const newsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  instrument: instrumentSymbolSchema.optional(),
  currency: z.string().max(3).optional(),
});

export const calendarQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  impact: impactSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const analysisRequestSchema = z.object({
  instrument: instrumentSymbolSchema,
  timeframe: timeframeSchema.default('1h'),
});

export const riskConfigSchema = z.object({
  accountCurrency: z.literal('USD').default('USD'),
  startingBalance: positiveNumberSchema.default(10_000),
  riskPerTradePct: z.number().min(0.01).max(10).default(1),
  maxDailyLossPct: z.number().min(0.1).max(100).default(3),
  maxOpenRiskPct: z.number().min(0.1).max(100).default(5),
  maxPositions: z.number().int().min(1).max(50).default(3),
  minRewardRisk: z.number().min(0.1).max(20).default(1.5),
  maxSpreadPips: z.record(instrumentSymbolSchema, z.number().nonnegative()).default({
    'XAU/USD': 35,
    'EUR/USD': 2,
    'GBP/USD': 2.5,
  }),
  eventBlackoutMinutes: z.number().int().min(0).max(240).default(30),
  killSwitch: z.boolean().default(false),
});

export const tradePlanRequestSchema = z.object({
  instrument: instrumentSymbolSchema,
  side: sideSchema,
  entry: positiveNumberSchema,
  stop: positiveNumberSchema,
  target: positiveNumberSchema,
  riskPerTradePct: z.number().min(0.01).max(10).optional(),
  accountEquity: positiveNumberSchema.optional(),
});

export const paperOrderRequestSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(128),
    instrument: instrumentSymbolSchema,
    side: sideSchema,
    type: orderTypeSchema.default('market'),
    quantityLots: z.number().min(0.01).max(100).optional(),
    limitPrice: positiveNumberSchema.optional(),
    stopLoss: positiveNumberSchema,
    takeProfit: positiveNumberSchema,
    notes: z.string().max(2000).default(''),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'limit' && value.limitPrice === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'limitPrice is required for limit orders',
        path: ['limitPrice'],
      });
    }
    if (value.side === 'buy' && value.takeProfit <= value.stopLoss) {
      ctx.addIssue({
        code: 'custom',
        message: 'For a buy, takeProfit must be above stopLoss',
        path: ['takeProfit'],
      });
    }
    if (value.side === 'sell' && value.takeProfit >= value.stopLoss) {
      ctx.addIssue({
        code: 'custom',
        message: 'For a sell, takeProfit must be below stopLoss',
        path: ['takeProfit'],
      });
    }
  });

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(4000).default(''),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueAt: isoDateSchema.nullable().optional(),
  instrument: instrumentSymbolSchema.nullable().optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

export const setupCreateSchema = z.object({
  instrument: instrumentSymbolSchema,
  timeframe: timeframeSchema.default('1h'),
  direction: z.enum(['long', 'short']),
  status: z.enum(['watching', 'triggered', 'invalidated', 'expired', 'taken']).default('watching'),
  entry: positiveNumberSchema,
  stop: positiveNumberSchema,
  target: positiveNumberSchema,
  rationale: z.string().max(4000).default(''),
  invalidation: z.string().max(2000).default(''),
  source: z.enum(['manual', 'technical', 'analysis']).default('manual'),
});

export const setupUpdateSchema = setupCreateSchema.partial();

export const settingsUpdateSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  risk: riskConfigSchema.partial().optional(),
  notifications: z
    .object({
      highImpactEvents: z.boolean().optional(),
      staleData: z.boolean().optional(),
      paperFills: z.boolean().optional(),
    })
    .optional(),
});

export const killSwitchSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const backtestRequestSchema = z
  .object({
    instrument: instrumentSymbolSchema,
    timeframe: timeframeSchema.default('1d'),
    from: isoDateSchema,
    to: isoDateSchema,
    strategyId: z.string().min(1).max(80).default('ema-trend'),
    initialEquity: positiveNumberSchema.default(10_000),
    riskPerTradePct: z.number().min(0.01).max(10).default(1),
    spreadPips: z.number().nonnegative().max(500).default(1),
    commissionPerLot: z.number().nonnegative().max(1000).default(7),
    slippagePips: z.number().nonnegative().max(500).default(0.2),
    maxHoldBars: z.number().int().min(1).max(10_000).default(50),
  })
  .refine((value) => Date.parse(value.from) < Date.parse(value.to), {
    message: 'from must be before to',
    path: ['to'],
  });

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const aiAnalysisOutputSchema = z.object({
  marketContext: z.string().min(1).max(6000),
  trend: z.string().min(1).max(2000),
  technicalSummary: z.string().min(1).max(6000),
  macroContext: z.string().min(1).max(6000),
  eventRisk: z.string().min(1).max(3000),
  scenarios: z
    .array(
      z.object({
        name: z.enum(['bullish', 'bearish', 'neutral']),
        thesis: z.string().min(1).max(3000),
        evidenceFor: z.array(z.string().max(1000)).max(20),
        evidenceAgainst: z.array(z.string().max(1000)).max(20),
        conditions: z.array(z.string().max(1000)).max(20),
        invalidation: z.array(z.string().max(1000)).max(20),
        targetZone: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(3),
  riskNotes: z.array(z.string().max(1000)).max(20),
  missingData: z.array(z.string().max(500)).max(20),
  limitations: z.array(z.string().max(500)).max(20),
});

export type AiAnalysisOutput = z.infer<typeof aiAnalysisOutputSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type CandleSeriesInput = z.infer<typeof candleSeriesSchema>;
export type TradePlanRequest = z.infer<typeof tradePlanRequestSchema>;
export type PaperOrderRequest = z.infer<typeof paperOrderRequestSchema>;
export type BacktestRequest = z.infer<typeof backtestRequestSchema>;
