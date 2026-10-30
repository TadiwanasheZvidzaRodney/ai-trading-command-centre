import {
  ProviderHealthTracker,
  TtlCache,
  type CalendarFeed,
  type CalendarEvent,
  type Impact,
  type InstrumentSymbol,
} from '@atc/shared';
import { fetchJson, type FetchJsonOptions } from './fetch';
import { parseForexFactory } from './forexfactory';
import {
  CALENDAR_PROVIDER,
  CALENDAR_SOURCE_URL,
  type CalendarLogger,
  type CalendarServiceOptions,
  type CalendarStore,
} from './types';

const PROVIDER_ID = 'forexfactory';
const DEFAULT_USER_AGENT = 'ATC/0.1 (personal trading research; calendar reference only)';
const DAY_MS = 86_400_000;

export interface CalendarQuery {
  from?: string;
  to?: string;
  impact?: Impact;
  instrument?: InstrumentSymbol;
  limit?: number;
  force?: boolean;
}

function weekWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - now.getUTCDay(),
    ),
  );
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

export class CalendarService {
  private readonly ttlMs: number;
  private readonly cache = new TtlCache<CalendarFeed>();
  private readonly health: ProviderHealthTracker;
  private readonly store: CalendarStore | undefined;
  private readonly logger: CalendarLogger | undefined;
  private readonly context: FetchJsonOptions;
  private readonly now: () => Date;

  constructor(options: CalendarServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.ttlMs = options.env.CALENDAR_POLL_MINUTES * 60_000;
    this.store = options.store;
    this.logger = options.logger;
    this.context = {
      fetch: options.fetch ?? fetch,
      timeoutMs: options.timeoutMs ?? 10_000,
      retries: options.retries ?? 1,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    };
    this.health = new ProviderHealthTracker({ now: this.now });
    this.health.register({
      providerId: PROVIDER_ID,
      displayName: CALENDAR_PROVIDER.displayName,
      category: 'calendar',
      configured: true,
      quality: CALENDAR_PROVIDER.quality,
      note: CALENDAR_PROVIDER.note,
    });
  }

  getProviderInfo() {
    return { ...CALENDAR_PROVIDER, url: CALENDAR_SOURCE_URL };
  }

  getProviderHealth() {
    return this.health.list();
  }

  async getCalendar(query: CalendarQuery = {}): Promise<CalendarFeed> {
    const now = this.now().getTime();
    let feed = this.cache.get('feed', now);
    let cached = true;
    if (!feed || query.force) {
      feed = await this.refresh();
      cached = false;
    }

    const limit = Math.max(1, Math.min(500, query.limit ?? 100));
    const from = query.from ? Date.parse(query.from) : Number.NEGATIVE_INFINITY;
    const to = query.to ? Date.parse(query.to) : Number.POSITIVE_INFINITY;
    const events = feed.events
      .filter((event) => {
        const scheduled = Date.parse(event.scheduledAt);
        return scheduled >= from && scheduled <= to;
      })
      .filter((event) => !query.impact || event.impact === query.impact)
      .filter((event) => !query.instrument || event.instruments.includes(query.instrument))
      .slice(0, limit);

    return { ...feed, events, cached };
  }

  async refresh(): Promise<CalendarFeed> {
    const now = this.now();
    const fetchedAt = now.toISOString();
    const { start, end } = weekWindow(now);

    try {
      const result = await fetchJson<unknown>(CALENDAR_SOURCE_URL, this.context);
      const parsed = parseForexFactory(result.data, fetchedAt);
      const events = parsed.events.filter((event) => {
        const scheduled = Date.parse(event.scheduledAt);
        return scheduled >= start.getTime() && scheduled < end.getTime();
      });
      this.health.recordSuccess(
        PROVIDER_ID,
        result.latencyMs,
        `Current-week calendar fetched; ${events.length} relevant event(s).`,
      );

      const feed: CalendarFeed = {
        events,
        provider: this.getProviderInfo(),
        weekStart: start.toISOString(),
        weekEnd: end.toISOString(),
        fetchedAt,
        cached: false,
        skippedCount: parsed.skipped,
        error: null,
        notes: [
          'Unofficial community mirror of Forex Factory data.',
          'Current week only; no actual values are provided.',
          'Verify high-impact events against the primary statistical agency before trading.',
        ],
      };
      await this.persist(events);
      this.cache.set('feed', feed, this.ttlMs, this.now().getTime());
      return feed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calendar request failed';
      this.health.recordFailure(PROVIDER_ID, error);
      this.logger?.warn({ error: message }, 'Calendar refresh failed');
      const feed: CalendarFeed = {
        events: [],
        provider: this.getProviderInfo(),
        weekStart: start.toISOString(),
        weekEnd: end.toISOString(),
        fetchedAt,
        cached: false,
        skippedCount: 0,
        error: `${message}. No calendar events were fabricated.`,
        notes: [
          'The calendar provider failed. No placeholder events were generated.',
          'Check /health/providers and retry before relying on this week view.',
        ],
      };
      this.cache.set('feed', feed, this.ttlMs, this.now().getTime());
      return feed;
    }
  }

  private async persist(events: CalendarEvent[]): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.save(events);
    } catch (error) {
      this.logger?.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Could not persist calendar events',
      );
    }
  }
}
