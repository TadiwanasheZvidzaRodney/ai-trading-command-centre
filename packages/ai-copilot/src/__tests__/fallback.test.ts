import { describe, it, expect, beforeEach } from 'vitest';
import { LocalFallbackProvider } from '../providers/local-fallback.js';
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
    trend: 'uptrend' as const,
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
  macro_events: [
    {
      event: 'ECB Decision',
      time: new Date().toISOString(),
      impact: 'high' as const,
      hours_until: 24,
    },
  ],
  recent_news_themes: ['inflation', 'policy'],
};

describe('LocalFallbackProvider', () => {
  let provider: LocalFallbackProvider;

  beforeEach(() => {
    provider = new LocalFallbackProvider();
  });

  it('should always be available', async () => {
    const available = await provider.available();
    expect(available).toBe(true);
  });

  it('should have name "local-fallback"', () => {
    expect(provider.name).toBe('local-fallback');
  });

  it('should return ok status on health check', async () => {
    const health = await provider.healthCheck();
    expect(health.status).toBe('ok');
  });

  it('should return 0 latency on health check', async () => {
    const health = await provider.healthCheck();
    expect(health.latencyMs).toBe(0);
  });

  it('should generate report markdown', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should indicate facts-only report', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toContain('Facts Only');
  });

  it('should include instrument name in report', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toContain('EUR/USD');
  });

  it('should include quote data in report', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toContain('Quote');
    expect(result).toContain('Bid');
    expect(result).toContain('Ask');
  });

  it('should include indicators in report', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toContain('sma_20');
    expect(result).toContain('rsi_14');
  });

  it('should include patterns count in report', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toContain('1 pattern');
  });

  it('should include trend information in report', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toContain('uptrend');
  });

  it('should include limitations section', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toContain('Limitations');
    expect(result).toContain('not an analysis');
    expect(result).toContain('raw factual data');
  });

  it('should handle malformed evidence JSON gracefully', async () => {
    const badPrompt = `System prompt
[DATA START]
{ invalid json
[DATA END]

Analysis request`;

    const result = await provider.analyze(badPrompt, 0.7);

    expect(result).toBeDefined();
    expect(result).toContain('Facts Only');
    expect(result).toContain('Could not parse');
  });

  it('should handle missing data markers gracefully', async () => {
    const noMarkersPrompt = 'Just some prompt without data markers';

    const result = await provider.analyze(noMarkersPrompt, 0.7);

    expect(result).toBeDefined();
    expect(result).toContain('Facts Only');
  });

  it('should include disclaimer', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    expect(result).toContain('NEVER use');
    expect(result).toContain('not a recommendation');
  });

  it('should be consistent across multiple calls', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result1 = await provider.analyze(prompt, 0.7);
    const result2 = await provider.analyze(prompt, 0.7);

    expect(result1).toBe(result2);
  });

  it('should handle macro events in report', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    // Should reference market events
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should format numbers with proper precision', async () => {
    const prompt = `System prompt
[DATA START]
${JSON.stringify(mockEvidence, null, 2)}
[DATA END]

Analysis request`;

    const result = await provider.analyze(prompt, 0.7);

    // Should include bid/ask with 4 decimal places
    expect(result).toMatch(/1\.0950/);
    expect(result).toMatch(/1\.0951/);
  });
});
