import { z } from 'zod';

/**
 * Technical analysis API request/response schemas
 */

export const technicalQuerySchema = z.object({
  lookback: z
    .string()
    .default('200')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(500)),
});

export type TechnicalQuery = z.infer<typeof technicalQuerySchema>;

/**
 * Response envelope for technical analysis endpoints
 */
export interface ApiResponse<T> {
  status: 'ok' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp?: string;
}
