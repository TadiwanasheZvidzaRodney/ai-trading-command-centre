import { describe, expect, it } from 'vitest';
import { parseForexFactory } from './forexfactory';

const payload = [
  {
    title: 'Federal Funds Rate',
    country: 'USD',
    date: '2026-10-28T14:00:00-04:00',
    impact: 'High',
    forecast: '4.00%',
    previous: '4.25%',
  },
  {
    title: 'German Prelim CPI m/m',
    country: 'EUR',
    date: '2026-10-30T03:29:00-04:00',
    impact: 'Medium',
    forecast: '',
    previous: '0.2%',
  },
  {
    title: 'Annual Budget Release',
    country: 'GBP',
    date: '2026-10-28T08:30:00-04:00',
    impact: 'High',
    forecast: '',
    previous: '',
  },
  {
    title: 'RBA Assist Gov Jones Speaks',
    country: 'AUD',
    date: '2026-10-25T17:10:00-04:00',
    impact: 'Low',
    forecast: '',
    previous: '',
  },
  {
    title: 'Broken date',
    country: 'USD',
    date: 'not-a-date',
    impact: 'Low',
  },
];

describe('Forex Factory parser', () => {
  it('normalises supported events to UTC and sorts them', () => {
    const parsed = parseForexFactory(payload, '2026-10-29T12:00:00.000Z');
    expect(parsed.events).toHaveLength(3);
    expect(parsed.skipped).toBe(2);
    expect(parsed.events.map((event) => event.scheduledAt)).toEqual([
      '2026-10-28T12:30:00.000Z',
      '2026-10-28T18:00:00.000Z',
      '2026-10-30T07:29:00.000Z',
    ]);
  });

  it('maps currencies to instruments and impact labels', () => {
    const parsed = parseForexFactory(payload, '2026-10-29T12:00:00.000Z');
    const fed = parsed.events.find((event) => event.title === 'Federal Funds Rate');
    expect(fed).toMatchObject({
      currency: 'USD',
      impact: 'high',
      forecast: '4.00%',
      previous: '4.25%',
      actual: null,
      source: 'forexfactory',
    });
    expect(fed?.instruments).toEqual(['XAU/USD', 'EUR/USD', 'GBP/USD']);
    const euro = parsed.events.find((event) => event.currency === 'EUR');
    expect(euro?.instruments).toEqual(['EUR/USD']);
    expect(euro?.forecast).toBeNull();
  });

  it('rejects a non-array payload instead of inventing events', () => {
    expect(() => parseForexFactory({}, '2026-10-29T12:00:00.000Z')).toThrow(
      'Calendar response is not a JSON array',
    );
  });

  it('normalises offsets across a US daylight-saving change', () => {
    const parsed = parseForexFactory(
      [
        {
          title: 'Before DST ends',
          country: 'USD',
          date: '2026-10-30T03:29:00-04:00',
          impact: 'Low',
        },
        {
          title: 'After DST ends',
          country: 'USD',
          date: '2026-11-02T03:29:00-05:00',
          impact: 'Low',
        },
      ],
      '2026-11-02T12:00:00.000Z',
    );
    expect(parsed.events.map((event) => event.scheduledAt)).toEqual([
      '2026-10-30T07:29:00.000Z',
      '2026-11-02T08:29:00.000Z',
    ]);
  });
});
