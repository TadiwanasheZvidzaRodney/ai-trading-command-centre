import { describe, expect, it } from 'vitest';
import {
  ageSeconds,
  bucketStart,
  formatInTimezone,
  isExpectedMarketGap,
  isStale,
  marketSessionState,
} from './time';

describe('time helpers', () => {
  it('calculates age and staleness from provider timestamps', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(ageSeconds('2026-10-27T11:59:30Z', now)).toBe(30);
    expect(isStale('2026-10-27T11:59:30Z', 15, now)).toBe(true);
    expect(isStale('2026-10-27T11:59:55Z', 15, now)).toBe(false);
  });

  it('formats in the configured IANA timezone', () => {
    expect(formatInTimezone('2026-10-27T12:00:00Z', 'Africa/Harare')).toBe('2026-10-27 14:00');
    expect(formatInTimezone('2026-10-27T12:00:00Z', 'America/New_York')).toBe('2026-10-27 08:00');
  });

  it('buckets candle timestamps to the timeframe boundary', () => {
    expect(bucketStart(Date.parse('2026-10-27T12:07:45Z'), '1h')).toBe(
      Date.parse('2026-10-27T12:00:00Z'),
    );
    expect(bucketStart(Date.parse('2026-10-27T12:07:45Z'), '15m')).toBe(
      Date.parse('2026-10-27T12:00:00Z'),
    );
  });

  it('treats weekend daily gaps as expected', () => {
    const friday = Date.parse('2026-10-23T00:00:00Z');
    const monday = Date.parse('2026-10-26T00:00:00Z');
    expect(isExpectedMarketGap(friday, monday, '1d')).toBe(true);
  });

  it('reports weekend session closure', () => {
    expect(marketSessionState('EUR/USD', Date.parse('2026-10-24T12:00:00Z')).open).toBe(false);
    expect(marketSessionState('EUR/USD', Date.parse('2026-10-27T12:00:00Z')).open).toBe(true);
  });
});
