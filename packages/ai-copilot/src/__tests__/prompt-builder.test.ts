import { describe, it, expect, beforeEach } from 'vitest';
import { PromptBuilder } from '../prompt/builder.js';
import type { Evidence } from '../types.js';

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
      },
    ],
    support_levels: [
      {
        price: 1.0900,
        touches: 2,
      },
    ],
  },
  macro_events: [],
  recent_news_themes: [],
};

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  it('should create a prompt from evidence', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should include system prompt', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    expect(prompt).toContain('technical analyst');
  });

  it('should include data markers', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    expect(prompt).toContain('[DATA START]');
    expect(prompt).toContain('[DATA END]');
  });

  it('should include evidence data between markers', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    const startIdx = prompt.indexOf('[DATA START]');
    const endIdx = prompt.indexOf('[DATA END]');

    expect(startIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(startIdx);

    const dataSection = prompt.substring(startIdx, endIdx);
    expect(dataSection).toContain('EUR/USD');
  });

  it('should include analysis request in prompt', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    expect(prompt).toContain('Current Market State');
    expect(prompt).toContain('Indicator Confluence');
    expect(prompt).toContain('Trade Setups');
  });

  it('should not exceed token limit', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    // Rough estimate: 4 chars per token
    const estimatedTokens = Math.ceil(prompt.length / 4);

    expect(estimatedTokens).toBeLessThan(4000);
  });

  it('should serialize evidence as valid JSON', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    const startIdx = prompt.indexOf('[DATA START]') + '[DATA START]'.length;
    const endIdx = prompt.indexOf('[DATA END]');

    const jsonStr = prompt.substring(startIdx, endIdx).trim();

    expect(() => {
      JSON.parse(jsonStr);
    }).not.toThrow();
  });

  it('should round-trip evidence through serialization', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    const startIdx = prompt.indexOf('[DATA START]') + '[DATA START]'.length;
    const endIdx = prompt.indexOf('[DATA END]');

    const jsonStr = prompt.substring(startIdx, endIdx).trim();
    const parsed = JSON.parse(jsonStr) as Evidence;

    expect(parsed.instrument).toBe(mockEvidence.instrument);
    expect(parsed.timeframe).toBe(mockEvidence.timeframe);
    expect(parsed.quote.bid).toBe(mockEvidence.quote.bid);
  });

  it('should include indicators in prompt', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    expect(prompt).toContain('sma_20');
    expect(prompt).toContain('rsi_14');
    expect(prompt).toContain('macd');
  });

  it('should include patterns in prompt', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    expect(prompt).toContain('bullish_divergence');
  });

  it('should include quote data in prompt', () => {
    const prompt = builder.buildAnalysisPrompt(mockEvidence);

    expect(prompt).toContain('1.0950'); // bid
    expect(prompt).toContain('1.0951'); // ask
  });

  it('should throw on evidence exceeding token limit', () => {
    // Create oversized evidence
    const hugeEvidence = {
      ...mockEvidence,
      recent_news_themes: Array(2000).fill('very long news theme text '.repeat(50)),
    };

    expect(() => {
      builder.buildAnalysisPrompt(hugeEvidence);
    }).toThrow();
  });

  it('should return consistent prompt for same input', () => {
    const prompt1 = builder.buildAnalysisPrompt(mockEvidence);
    const prompt2 = builder.buildAnalysisPrompt(mockEvidence);

    expect(prompt1).toBe(prompt2);
  });

  it('should expose system prompt', () => {
    const systemPrompt = builder.getSystemPrompt();

    expect(systemPrompt).toBeDefined();
    expect(typeof systemPrompt).toBe('string');
    expect(systemPrompt.length).toBeGreaterThan(0);
  });

  it('should expose data markers', () => {
    const markers = builder.getDataMarkers();

    expect(markers.start).toBe('[DATA START]');
    expect(markers.end).toBe('[DATA END]');
  });
});
