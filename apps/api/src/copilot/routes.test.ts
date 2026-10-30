import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';
import { createEnv } from '@atc/config';
import { buildServer } from '../server.js';
import type { DatabaseLike } from '../db/mongo.js';
import type { AIAnalysisService } from './routes.js';

const baseEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  AUTH_MODE: 'disabled',
  LIVE_TRADING_ENABLED: 'false',
  ENABLE_SCHEDULER: 'false',
};

function stubDb(): DatabaseLike {
  return {
    db: null as Db | null,
    ping: async () => true,
  };
}

function createMockAIService(): AIAnalysisService {
  return {
    analyze: vi.fn().mockResolvedValue({
      report: '# Analysis Report\n\nThis is a test report.',
      model: 'gemini',
      temperature: 0.7,
      generated_at: new Date().toISOString(),
      inference_time_ms: 2340,
      input_hash: 'abc123def456',
      fallback: false,
      evidence: {
        instrument: 'EUR/USD',
        timeframe: '4h',
        lookback: 200,
        candle_count: 200,
        latest_candle_time: new Date().toISOString(),
        indicators_used: ['RSI', 'MACD', 'Bollinger Bands'],
        patterns_detected: [
          {
            type: 'morning_star',
            confidence: 0.85,
            candle_index: 5,
          },
        ],
        quote: {
          bid: 1.0845,
          ask: 1.0847,
          mid: 1.0846,
          spread: 0.0002,
          fetched_at: new Date().toISOString(),
        },
        structure: {
          trend: 'uptrend',
          trend_strength: 0.72,
          resistance_levels: [
            {
              price: 1.0900,
              touches: 3,
              recent_bounce: new Date().toISOString(),
            },
          ],
          support_levels: [
            {
              price: 1.0750,
              touches: 2,
            },
          ],
        },
        macro_events: [
          {
            event: 'ECB Interest Rate Decision',
            time: new Date(Date.now() + 86400000).toISOString(),
            impact: 'high',
            hours_until: 24,
          },
        ],
        recent_news_themes: ['ECB policy', 'USD weakness'],
      },
    }),
    getHistory: vi.fn().mockResolvedValue([
      {
        input_hash: 'abc123def456',
        generated_at: new Date().toISOString(),
        model: 'gemini',
        summary: 'Uptrend with morning star pattern',
      },
      {
        input_hash: 'xyz789',
        generated_at: new Date(Date.now() - 3600000).toISOString(),
        model: 'gemini',
        summary: 'Consolidation near support',
      },
    ]),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'ok',
      latencyMs: 45,
    }),
  };
}

describe('Copilot Routes', () => {
  let app: FastifyInstance;
  let mockAIService: AIAnalysisService;

  beforeEach(async () => {
    mockAIService = createMockAIService();

    const env = createEnv(baseEnv);
    app = await buildServer({
      env,
      db: stubDb(),
      aiAnalysis: mockAIService,
    });
  });

  describe('POST /api/v1/copilot/analyze', () => {
    it('returns analysis report for valid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 200,
          model: 'gemini',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.data.report).toBeDefined();
      expect(body.data.model).toBe('gemini');
      expect(body.data.evidence).toBeDefined();
      expect(body.data.evidence.instrument).toBe('EUR/USD');
      expect(body.data.evidence.timeframe).toBe('4h');
      expect(body.timestamp).toBeDefined();
    });

    it('rejects invalid instrument with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'INVALID/XXX',
          timeframe: '4h',
          lookback: 200,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
      expect(Array.isArray(body.error.details)).toBe(true);
    });

    it('rejects invalid timeframe with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '99m',
          lookback: 200,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('uses fallback when model unavailable', async () => {
      (mockAIService.analyze as any).mockResolvedValueOnce({
        report: '# Analysis Report (Facts Only)\n\nAI unavailable. Showing deterministic evidence.',
        model: null,
        fallback: true,
        fallback_reason: 'Gemini API unavailable',
        temperature: 0.7,
        generated_at: new Date().toISOString(),
        inference_time_ms: 340,
        input_hash: 'abc123',
        evidence: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 200,
          candle_count: 200,
          latest_candle_time: new Date().toISOString(),
          indicators_used: [],
          patterns_detected: [],
          quote: {
            bid: 1.0845,
            ask: 1.0847,
            mid: 1.0846,
            spread: 0.0002,
            fetched_at: new Date().toISOString(),
          },
          structure: {
            trend: 'range',
            trend_strength: 0.0,
            resistance_levels: [],
            support_levels: [],
          },
          macro_events: [],
          recent_news_themes: [],
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 200,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.fallback).toBe(true);
      expect(body.data.model).toBeNull();
      expect(body.data.fallback_reason).toBe('Gemini API unavailable');
    });

    it('defaults temperature to 0.7', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 200,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.temperature).toBe(0.7);
    });

    it('defaults lookback to 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.evidence.lookback).toBe(200);
    });

    it('respects lookback min (1)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 0,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('respects lookback max (500)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 501,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts all valid timeframes', async () => {
      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1wk'];

      for (const timeframe of timeframes) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/copilot/analyze',
          payload: {
            instrument: 'EUR/USD',
            timeframe,
            lookback: 200,
          },
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('accepts all valid instruments', async () => {
      const instruments = ['XAU/USD', 'EUR/USD', 'GBP/USD'];

      for (const instrument of instruments) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/copilot/analyze',
          payload: {
            instrument,
            timeframe: '4h',
            lookback: 200,
          },
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('accepts temperature between 0 and 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 200,
          temperature: 0.3,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('rejects temperature > 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 200,
          temperature: 1.5,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('sets cache-control to no-store', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 200,
        },
      });

      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('includes request ID in response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/analyze',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          lookback: 200,
        },
      });

      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('POST /api/v1/copilot/history', () => {
    it('returns past reports for instrument/timeframe', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/history',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          limit: 10,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(Array.isArray(body.data.reports)).toBe(true);
      expect(body.data.reports.length).toBeGreaterThan(0);
      expect(body.data.reports[0].input_hash).toBeDefined();
      expect(body.data.reports[0].generated_at).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    it('limits results to specified count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/history',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          limit: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      // Verify that aiAnalysis.getHistory was called with limit: 5
      expect(mockAIService.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 })
      );
    });

    it('defaults limit to 10', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/history',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAIService.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });

    it('rejects invalid limit (< 1)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/history',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          limit: 0,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid limit (> 100)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/history',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          limit: 101,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid instrument', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/history',
        payload: {
          instrument: 'INVALID/XXX',
          timeframe: '4h',
          limit: 10,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts all valid instruments', async () => {
      const instruments = ['XAU/USD', 'EUR/USD', 'GBP/USD'];

      for (const instrument of instruments) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/copilot/history',
          payload: {
            instrument,
            timeframe: '4h',
            limit: 10,
          },
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('accepts all valid timeframes', async () => {
      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1wk'];

      for (const timeframe of timeframes) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/copilot/history',
          payload: {
            instrument: 'EUR/USD',
            timeframe,
            limit: 10,
          },
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('sets cache-control to no-store', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/copilot/history',
        payload: {
          instrument: 'EUR/USD',
          timeframe: '4h',
          limit: 10,
        },
      });

      expect(response.headers['cache-control']).toBe('no-store');
    });
  });
});
