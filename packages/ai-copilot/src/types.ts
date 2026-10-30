import { z } from 'zod';

export const AnalysisRequestSchema = z.object({
  instrument: z.string().min(1, 'Instrument required'),
  timeframe: z.string().min(1, 'Timeframe required'),
  lookback: z.number().int().positive('Lookback must be positive'),
  model: z.enum(['gemini', 'ollama', 'auto']).optional().default('auto'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  include_history: z.boolean().optional().default(false),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export const EvidenceSchema = z.object({
  instrument: z.string(),
  timeframe: z.string(),
  lookback: z.number(),
  candle_count: z.number(),
  latest_candle_time: z.string().datetime(),
  indicators_used: z.array(z.string()),
  patterns_detected: z.array(
    z.object({
      type: z.string(),
      confidence: z.number().min(0).max(1),
      candle_index: z.number(),
    })
  ),
  quote: z.object({
    bid: z.number().positive(),
    ask: z.number().positive(),
    mid: z.number().positive(),
    spread: z.number().nonnegative(),
    fetched_at: z.string().datetime(),
  }),
  structure: z.object({
    trend: z.enum(['uptrend', 'downtrend', 'range']),
    trend_strength: z.number().min(0).max(1),
    resistance_levels: z.array(
      z.object({
        price: z.number().positive(),
        touches: z.number().int().nonnegative(),
        recent_bounce: z.string().optional(),
      })
    ),
    support_levels: z.array(
      z.object({
        price: z.number().positive(),
        touches: z.number().int().nonnegative(),
        recent_bounce: z.string().optional(),
      })
    ),
  }),
  macro_events: z.array(
    z.object({
      event: z.string(),
      time: z.string().datetime(),
      impact: z.enum(['high', 'medium', 'low']),
      hours_until: z.number(),
    })
  ),
  recent_news_themes: z.array(z.string()),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export const AnalysisReportSchema = z.object({
  report: z.string(),
  model: z.string().nullable(),
  model_version: z.string().optional(),
  temperature: z.number().min(0).max(2),
  generated_at: z.string().datetime(),
  inference_time_ms: z.number().nonnegative(),
  input_hash: z.string(),
  fallback: z.boolean().optional().default(false),
  fallback_reason: z.string().optional(),
  evidence: EvidenceSchema,
});

export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;

export interface AIProvider {
  name: string;
  available(): Promise<boolean>;
  analyze(prompt: string, temperature: number): Promise<string>;
  healthCheck(): Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  status: 'ok' | 'error';
  latencyMs: number;
  message?: string;
}

export interface ProviderConfig {
  geminiApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}
