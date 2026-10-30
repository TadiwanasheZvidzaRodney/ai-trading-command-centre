import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { analyzeRequestSchema, historyRequestSchema } from './types.js';
import { AppError, zodDetails } from '../errors.js';

export interface AIAnalysisService {
  analyze(query: unknown): Promise<unknown>;
  getHistory(query: unknown): Promise<unknown[]>;
  healthCheck(): Promise<{ status: string; latencyMs: number }>;
}

interface CopilotRouteOptions {
  aiAnalysis: AIAnalysisService;
}

export async function registerCopilotRoutes(
  app: FastifyInstance,
  options: CopilotRouteOptions,
): Promise<void> {
  const { aiAnalysis } = options;

  // POST /api/v1/copilot/analyze
  app.post<{ Body: unknown }>('/api/v1/copilot/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('cache-control', 'no-store');

    try {
      const query = analyzeRequestSchema.parse(request.body);

      // Call AIAnalysisService.analyze()
      const report = await aiAnalysis.analyze(query);

      return {
        status: 'ok',
        data: report,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });

  // POST /api/v1/copilot/history
  app.post<{ Body: unknown }>('/api/v1/copilot/history', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('cache-control', 'no-store');

    try {
      const query = historyRequestSchema.parse(request.body);

      // Query past reports for this instrument/timeframe
      const reports = await aiAnalysis.getHistory(query);

      return {
        status: 'ok',
        data: { reports },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', zodDetails(error));
      }
      throw error;
    }
  });
}
