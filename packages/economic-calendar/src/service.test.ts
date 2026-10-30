import { describe, expect, it } from 'vitest';
import { CalendarService } from './service';

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
];

const now = () => new Date('2026-10-29T12:00:00.000Z');

function fakeFetch(handler: () => Response): typeof fetch {
  return (async () => handler()) as typeof fetch;
}

describe('CalendarService', () => {
  it('fetches the current week, normalises UTC and reports success', async () => {
    const service = new CalendarService({
      env: { CALENDAR_POLL_MINUTES: 60 },
      now,
      fetch: fakeFetch(() => new Response(JSON.stringify(payload), { status: 200 })),
    });

    const feed = await service.getCalendar();
    expect(feed.weekStart).toBe('2026-10-25T00:00:00.000Z');
    expect(feed.weekEnd).toBe('2026-11-01T00:00:00.000Z');
    expect(feed.events).toHaveLength(2);
    expect(feed.error).toBeNull();
    expect(service.getProviderHealth()[0]?.status).toBe('ok');
  });

  it('filters by impact and instrument', async () => {
    const service = new CalendarService({
      env: { CALENDAR_POLL_MINUTES: 60 },
      now,
      fetch: fakeFetch(() => new Response(JSON.stringify(payload), { status: 200 })),
    });

    const high = await service.getCalendar({ impact: 'high' });
    expect(high.events).toHaveLength(1);
    expect(high.events[0]?.title).toBe('Federal Funds Rate');

    const euro = await service.getCalendar({ instrument: 'EUR/USD', impact: 'medium' });
    expect(euro.events).toHaveLength(1);
    expect(euro.events[0]?.currency).toBe('EUR');
  });

  it('returns a visible error and no events when the provider fails', async () => {
    const service = new CalendarService({
      env: { CALENDAR_POLL_MINUTES: 60 },
      now,
      fetch: fakeFetch(() => new Response('unavailable', { status: 503 })),
    });

    const feed = await service.getCalendar();
    expect(feed.events).toHaveLength(0);
    expect(feed.error).toContain('No calendar events were fabricated');
    expect(service.getProviderHealth()[0]?.status).toBe('error');
  });

  it('caches the feed between requests', async () => {
    let calls = 0;
    const service = new CalendarService({
      env: { CALENDAR_POLL_MINUTES: 60 },
      now,
      fetch: fakeFetch(() => {
        calls += 1;
        return new Response(JSON.stringify(payload), { status: 200 });
      }),
    });

    const first = await service.getCalendar();
    expect(first.cached).toBe(false);
    const second = await service.getCalendar();
    expect(second.cached).toBe(true);
    expect(calls).toBe(1);
  });
});
