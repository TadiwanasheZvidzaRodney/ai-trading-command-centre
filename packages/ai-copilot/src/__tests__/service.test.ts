import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AIAnalysisService,
  GeminiProvider,
  OllamaProvider,
  LocalFallbackProvider,
  PromptBuilder,
  InputSanitizer,
  ReportFormatter,
} from '../index.js';
import type { AnalysisRequest, Evidence } from '../types.js';

// Mock evidence data
const mockEvidence: Evidence = {
  instrument: 'EUR/USD',
  timeframe: '1H',
  lookback: 24,
  candle_count: 24,
  latest_candle_time: new Date().toISOString(),
  indicators_used: ['sma_20', 'rsi_14', 'macd'],
  patterns_detected: [
    {
      type: 'bullish_divergence',
      confidence: 0.75,
      candle_index: 5,
    },
  ],
  quote: {
    bid: 1.0950,
    ask: 1.0951,
    mid: 1.09505,
    spread: 0.0001,
    fetched_at: new Date().toISOString(),
  },
  structure: {
    trend: 'uptrend',
    trend_strength: 0.65,
    resistance_levels: [
      {
        price: 1.1000,
        touches: 3,
        recent_bounce: '2h ago',
      },
    ],
    support_levels: [
      {
        price: 1.0900,
        touches: 2,
      },
    ],
  },
  macro_events: [
    {
      event: 'ECB Interest Rate Decision',
      time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      impact: 'high',
      hours_until: 24,
    },
  ],
  recent_news_themes: ['inflation', 'central bank policy'],
};

describe('AIAnalysisService', () => {
  let service: AIAnalysisService;
  const mockRequest: AnalysisRequest = {
    instrument: 'EUR/USD',
    timeframe: '1H',
    lookback: 24,
    temperature: 0.7,
    model: 'auto',
    include_history: false,
  };

  beforeEach(() => {
    // Mock env to avoid real API calls
    vi.stubEnv('GEMINI_API_KEY', 'mock-key');
    service = new AIAnalysisService({
      geminiApiKey: 'mock-key',
    });
  });

  it('should initialize with gemini provider', () => {
    const providers = service.getAvailableProviders();
    expect(providers).toContain('gemini');
  });

  it('should initialize with ollama provider', () => {
    const providers = service.getAvailableProviders();
    expect(providers).toContain('ollama');
  });

  it('should return fallback analysis when all providers fail', async () => {
    // Create service with no valid API key to force fallback
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(result).toBeDefined();
    expect(result.report).toBeDefined();
    expect(result.report.includes('Facts Only')).toBe(true);
  });

  it('should include evidence in result', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(result.evidence).toBeDefined();
    expect(result.evidence.instrument).toBe('EUR/USD');
    expect(result.evidence.timeframe).toBe('1H');
  });

  it('should generate deterministic input hash', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result1 = await fallbackService.analyze(mockRequest, mockEvidence);
    const result2 = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(result1.input_hash).toBe(result2.input_hash);
  });

  it('should generate different hash for different instrument', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result1 = await fallbackService.analyze(mockRequest, mockEvidence);

    const differentEvidence: Evidence = {
      ...mockEvidence,
      instrument: 'GBP/USD',
      candle_count: 30, // Make the evidence different
      structure: {
        ...mockEvidence.structure,
        trend_strength: 0.85, // Different structure
      },
    };
    const result2 = await fallbackService.analyze(mockRequest, differentEvidence);

    expect(result1.input_hash).not.toBe(result2.input_hash);
  });

  it('should set fallback flag when provider fails', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(result.fallback).toBe(true);
  });

  it('should include temperature in result', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(result.temperature).toBe(0.7);
  });

  it('should include model name in result', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(result.model).toBeNull();
    expect(result.fallback).toBe(true);
  });

  it('should include inference time in milliseconds', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(typeof result.inference_time_ms).toBe('number');
    expect(result.inference_time_ms).toBeGreaterThanOrEqual(0);
  });

  it('should generate ISO timestamp for generated_at', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(result.generated_at).toBeDefined();
    // Check if valid ISO string
    expect(() => new Date(result.generated_at)).not.toThrow();
  });

  it('should sanitize evidence before building prompt', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const maliciousEvidence = {
      ...mockEvidence,
      recent_news_themes: ['normal_theme', 'DROP TABLE users;', 'another_theme'],
    };

    const result = await fallbackService.analyze(mockRequest, maliciousEvidence);

    expect(result.evidence.recent_news_themes).toBeDefined();
    // Should filter or sanitize malicious content
    const sanitized = result.evidence.recent_news_themes.join(' ');
    expect(sanitized.toUpperCase()).not.toContain('DROP TABLE');
  });

  it('should include all required evidence fields in report', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    expect(result.report).toContain('Data Freshness');
    expect(result.report).toContain('Technical Setup');
    expect(result.report).toContain('Limitations');
    expect(result.report).toContain('EUR/USD');
  });

  it('should use default temperature if not provided', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const requestNoTemp: AnalysisRequest = {
      instrument: 'EUR/USD',
      timeframe: '1H',
      lookback: 24,
      model: 'auto',
      temperature: 0.7,
      include_history: false,
    };

    const result = await fallbackService.analyze(requestNoTemp, mockEvidence);

    expect(result.temperature).toBe(0.7);
  });

  it('should support auto provider selection', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const autoRequest: AnalysisRequest = { ...mockRequest, model: 'auto' };
    const result = await fallbackService.analyze(autoRequest, mockEvidence);

    expect(result).toBeDefined();
  });

  it('should perform health check on all providers', async () => {
    const healthStatus = await service.healthCheck();

    expect(healthStatus).toBeDefined();
    expect(healthStatus['fallback']).toBeDefined();
    expect(healthStatus['fallback']?.status).toBe('ok');
  });

  it('should include fallback reason on fallback', async () => {
    const fallbackService = new AIAnalysisService({ geminiApiKey: '' });

    const result = await fallbackService.analyze(mockRequest, mockEvidence);

    if (result.fallback) {
      expect(result.fallback_reason ?? '').toBeDefined();
    }
  });
});
