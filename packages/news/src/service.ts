import {
  ProviderHealthTracker,
  TtlCache,
  canonicalUrl,
  normaliseTitle,
  stableHash,
  type InstrumentSymbol,
  type NewsFeed,
  type NewsItem,
  type NewsSourceStatus,
} from '@atc/shared';
import { fetchText, type FetchTextOptions } from './fetch';
import { tagNews } from './relevance';
import { parseFeed } from './rss';
import {
  NEWS_PROVIDER,
  NEWS_PROVIDER_URL,
  type NewsLogger,
  type NewsServiceOptions,
  type NewsStore,
  type RawNewsItem,
} from './types';

const PROVIDER_ID = 'rss';
const MAX_ITEMS = 200;
const DEFAULT_USER_AGENT = 'ATC/0.1 (personal trading research; RSS headlines only)';

export interface NewsQuery {
  instrument?: InstrumentSymbol;
  currency?: string;
  limit?: number;
  force?: boolean;
}

function sourceId(feedUrl: string): string {
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, '');
  } catch {
    return feedUrl;
  }
}

function toNewsItem(raw: RawNewsItem, fetchedAt: string): NewsItem {
  const url = canonicalUrl(raw.url);
  const tagging = tagNews(raw.title, raw.summary);
  return {
    id: `news_${stableHash(url)}`,
    title: raw.title,
    summary: raw.summary,
    url,
    source: raw.source,
    publishedAt: raw.publishedAt,
    fetchedAt,
    currencies: tagging.currencies,
    instruments: tagging.instruments,
    relevance: tagging.relevance,
    tags: tagging.tags,
  };
}

function dedupe(items: NewsItem[]): { items: NewsItem[]; removed: number } {
  const ordered = [...items].sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt),
  );
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const kept: NewsItem[] = [];
  let removed = 0;

  for (const item of ordered) {
    const urlKey = canonicalUrl(item.url);
    const titleKey = normaliseTitle(item.title);
    if (seenUrls.has(urlKey) || (titleKey.length > 0 && seenTitles.has(titleKey))) {
      removed += 1;
      continue;
    }
    seenUrls.add(urlKey);
    if (titleKey.length > 0) seenTitles.add(titleKey);
    kept.push(item);
  }

  return { items: kept, removed };
}

export class NewsService {
  private readonly feedUrls: string[];
  private readonly ttlMs: number;
  private readonly cache = new TtlCache<NewsFeed>();
  private readonly health: ProviderHealthTracker;
  private readonly store: NewsStore | undefined;
  private readonly logger: NewsLogger | undefined;
  private readonly context: FetchTextOptions;
  private readonly now: () => Date;

  constructor(options: NewsServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.feedUrls = [...new Set(options.env.NEWS_RSS_FEEDS)];
    this.ttlMs = options.env.NEWS_POLL_MINUTES * 60_000;
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
      displayName: NEWS_PROVIDER.displayName,
      category: 'news',
      configured: this.feedUrls.length > 0,
      quality: NEWS_PROVIDER.quality,
      note: NEWS_PROVIDER.note,
    });
  }

  getProviderInfo() {
    return { ...NEWS_PROVIDER, url: NEWS_PROVIDER_URL };
  }

  getProviderHealth() {
    return this.health.list();
  }

  async getNews(query: NewsQuery = {}): Promise<NewsFeed> {
    const now = this.now().getTime();
    let feed = this.cache.get('feed', now);
    let cached = true;
    if (!feed || query.force) {
      feed = await this.refresh();
      cached = false;
    }

    const limit = Math.max(1, Math.min(MAX_ITEMS, query.limit ?? 50));
    const currency = query.currency?.toUpperCase();
    const items = feed.items
      .filter((item) => !query.instrument || item.instruments.includes(query.instrument))
      .filter((item) => !currency || item.currencies.includes(currency))
      .slice(0, limit);

    return { ...feed, items, cached };
  }

  async refresh(): Promise<NewsFeed> {
    const fetchedAt = this.now().toISOString();

    if (this.feedUrls.length === 0) {
      this.health.markNotConfigured(PROVIDER_ID, 'No RSS feeds are configured.');
      const feed: NewsFeed = {
        items: [],
        provider: this.getProviderInfo(),
        sources: [],
        fetchedAt,
        cached: false,
        duplicatesRemoved: 0,
        skippedCount: 0,
        error: 'No RSS feeds are configured.',
        notes: ['No RSS feeds are configured. No headlines were fabricated.'],
      };
      this.cache.set('feed', feed, this.ttlMs, this.now().getTime());
      return feed;
    }

    const results = await Promise.allSettled(
      this.feedUrls.map(async (feedUrl) => {
        const result = await fetchText(feedUrl, this.context);
        const parsed = parseFeed(result.text, feedUrl);
        return { feedUrl, ...result, parsed };
      }),
    );

    const sources: NewsSourceStatus[] = [];
    const rawItems: RawNewsItem[] = [];
    let skippedCount = 0;
    let failures = 0;
    const latencies: number[] = [];

    results.forEach((result, index) => {
      const feedUrl = this.feedUrls[index] ?? '';
      const id = sourceId(feedUrl);
      if (result.status === 'fulfilled') {
        const { latencyMs, parsed } = result.value;
        latencies.push(latencyMs);
        skippedCount += parsed.skipped;
        rawItems.push(...parsed.items);
        sources.push({
          id,
          url: feedUrl,
          status: 'ok',
          itemCount: parsed.items.length,
          skippedCount: parsed.skipped,
          latencyMs,
          error: null,
        });
        return;
      }
      failures += 1;
      const message =
        result.reason instanceof Error ? result.reason.message : 'Feed request failed';
      sources.push({
        id,
        url: feedUrl,
        status: 'error',
        itemCount: 0,
        skippedCount: 0,
        latencyMs: 0,
        error: message,
      });
      this.logger?.warn({ feedUrl, error: message }, 'RSS feed failed');
    });

    const fetchedItems = rawItems.map((item) => toNewsItem(item, fetchedAt));
    const deduped = dedupe(fetchedItems);
    const items = deduped.items.slice(0, MAX_ITEMS);
    const averageLatency =
      latencies.length > 0
        ? latencies.reduce((total, value) => total + value, 0) / latencies.length
        : 0;

    if (failures === this.feedUrls.length) {
      this.health.recordFailure(
        PROVIDER_ID,
        new Error(`All ${this.feedUrls.length} RSS feeds failed`),
        averageLatency,
      );
    } else if (failures > 0) {
      this.health.recordDegraded(
        PROVIDER_ID,
        new Error(`${failures} of ${this.feedUrls.length} RSS feeds failed`),
        averageLatency,
      );
    } else {
      this.health.recordSuccess(
        PROVIDER_ID,
        averageLatency,
        `${this.feedUrls.length} RSS feed(s) fetched; ${items.length} unique item(s).`,
      );
    }

    const notes = [
      'Headlines and links only; no article bodies are stored.',
      'Relevance is deterministic keyword tagging, not sentiment or a prediction.',
    ];
    if (failures > 0) {
      notes.push(`${failures} of ${this.feedUrls.length} feeds failed; see source statuses.`);
    }
    if (skippedCount > 0) {
      notes.push(`${skippedCount} item(s) were skipped because title, link or date was missing.`);
    }
    if (items.length === 0) {
      notes.push('No usable headlines were returned. Nothing was fabricated.');
    }

    const feed: NewsFeed = {
      items,
      provider: this.getProviderInfo(),
      sources,
      fetchedAt,
      cached: false,
      duplicatesRemoved: deduped.removed,
      skippedCount,
      error:
        failures === this.feedUrls.length
          ? `All ${this.feedUrls.length} RSS feeds failed. No headlines were fabricated.`
          : null,
      notes,
    };

    if (this.store) {
      try {
        await this.store.save(items);
      } catch (error) {
        this.logger?.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Could not persist news items',
        );
      }
    }

    this.cache.set('feed', feed, this.ttlMs, this.now().getTime());
    return feed;
  }
}
