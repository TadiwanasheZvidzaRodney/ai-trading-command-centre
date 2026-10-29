import { describe, expect, it } from 'vitest';
import { ProviderHealthTracker } from './health.js';

describe('provider health tracker', () => {
  it('starts configured providers as degraded until the first sample', () => {
    const tracker = new ProviderHealthTracker();
    tracker.register({
      providerId: 'quote',
      displayName: 'Quote provider',
      category: 'market-data',
      configured: true,
      quality: 'reference',
    });
    expect(tracker.get('quote')?.status).toBe('degraded');
    expect(tracker.get('quote')?.lastSuccessAt).toBeNull();
  });

  it('marks unconfigured providers explicitly', () => {
    const tracker = new ProviderHealthTracker();
    tracker.register({
      providerId: 'optional',
      displayName: 'Optional provider',
      category: 'market-data',
      configured: false,
      quality: 'reference',
    });
    expect(tracker.get('optional')?.status).toBe('not_configured');
    expect(tracker.get('optional')?.message).toContain('not configured');
  });

  it('records success and failure while redacting credentials', () => {
    const tracker = new ProviderHealthTracker({
      now: () => new Date('2026-10-27T12:00:00.000Z'),
    });
    tracker.register({
      providerId: 'quote',
      displayName: 'Quote provider',
      category: 'market-data',
      configured: true,
      quality: 'reference',
    });
    tracker.recordSuccess('quote', 42.4);
    expect(tracker.get('quote')).toMatchObject({
      status: 'ok',
      latencyMs: 42,
      lastSuccessAt: '2026-10-27T12:00:00.000Z',
    });

    tracker.recordFailure(
      'quote',
      new Error('request failed: apikey=secret&token=secret Bearer abc.def'),
      12,
    );
    const health = tracker.get('quote');
    expect(health?.status).toBe('error');
    expect(health?.lastError).not.toContain('secret');
    expect(health?.lastError).not.toContain('abc.def');
    expect(health?.lastError).toContain('[redacted]');
  });
});
