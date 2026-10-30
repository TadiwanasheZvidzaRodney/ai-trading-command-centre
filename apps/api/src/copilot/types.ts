import { z } from 'zod';

/**
 * Copilot API request/response schemas
 */

export const analyzeRequestSchema = z.object({
  instrument: z.enum(['XAU/USD', 'EUR/USD', 'GBP/USD']),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1wk']),
  lookback: z.number().int().min(1).max(500).default(200),
  model: z.enum(['gemini', 'ollama', 'auto']).optional().default('auto'),
  temperature: z.number().min(0).max(1).optional().default(0.7),
  include_history: z.boolean().optional().default(false),
});

export const historyRequestSchema = z.object({
  instrument: z.enum(['XAU/USD', 'EUR/USD', 'GBP/USD']),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1wk']),
  limit: z.number().int().min(1).max(100).optional().default(10),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type HistoryRequest = z.infer<typeof historyRequestSchema>;
