import { describe, expect, it } from 'vitest';
import { NewsService } from './service';

function rss(items: Array<{ title: string; link: string; date: string }>): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel>${items
    .map(
      (item) =>
        `<item><title>${item.title}</title><link>${item.link}</link><pubDate>${item.date}</pubDate></item>`,
    )
    .join('')}</channel></rss>`;
}

const feedA = rss([
  {
    title: 'Fed holds rates steady',
    link: 'https://example.com/fed?utm_source=rss',
    date: 'Thu, 29 Oct 2026 12:00:00 GMT',
  },
  {
    title: 'Gold climbs on safe-haven demand',
    link: 'https://example.com/gold',
    date: 'Thu, 29 Oct 2026 11:00:00 GMT',
  },
]);

const feedB = rss([
  {
    title: 'Fed holds rates steady',
    link: 'https://other.example.com/fed',
    date: 'Thu, 29 Oct 2026 11:30:00 GMT',
  },
  {
    title: 'ECB signals patience',
    link: 'https://example.com/ecb',
    date: 'Thu, 29 Oct 2026 10:00:00 GMT',
  },
]);

const now = () => new Date('2026-10-29T12:30:00.000Z');

function fakeFetch(handler: (url: string) => Response): typeof fetch {
  return (async (input: string | URL | Request) => handler(String(input))) as typeof fetch;
}

describe('NewsService', () => {
  it('fetches feeds, deduplicates by title and reports source health', async () => {
    const service = new NewsService({
      env: { NEWS_RSS_FEEDS: ['https://a.example/rss', 'https://b.example/rss'], NEWS_POLL_MINUTES: 15 },
      now,
      fetch: fakeFetch((url) =>
        new Response(url.includes('a.example') ? feedA : feedB, { status: 200 }),
      ),
    });

    const feed = await service.getNews();
    expect(feed.items).toHaveLength(3);
    expect(feed.duplicatesRemoved).toBe(1);
    expect(feed.sources).toHaveLength(2);
    expect(feed.sources.every((source) => source.status === 'ok')).toBe(true);
    expect(service.getProviderHealth()[0]?.status).toBe('ok');
    expect(feed.items[0]?.publishedAt).toBe('2026-10-29T12:00:00.000Z');
  });

  it('marks the provider degraded when one feed fails and keeps successful items', async () => {
    const service = new NewsService({
      env: { NEWS_RSS_FEEDS: ['https://a.example/rss', 'https://bad.example/rss'], NEWS_POLL_MINUTES: 15 },
      now,
      fetch: fakeFetch((url) =>
        url.includes('bad.example')
          ? new Response('unavailable', { status: 503 })
          : new Response(feedA, { status: 200 }),
      ),
    });

    const feed = await service.getNews();
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.sources.find((source) => source.status === 'error')).toBeDefined();
    expect(service.getProviderHealth()[0]?.status).toBe('degraded');
    expect(feed.notes.join(' ')).toContain('feeds failed');
  });

  it('marks the provider error when every feed fails without fabricating items', async () => {
    const service = new NewsService({
      env: { NEWS_RSS_FEEDS: ['https://bad.example/rss'], NEWS_POLL_MINUTES: 15 },
      now,
      fetch: fakeFetch(() => new Response('unavailable', { status: 503 })),
    });

    const feed = await service.getNews();
    expect(feed.items).toHaveLength(0);
    expect(service.getProviderHealth()[0]?.status).toBe('error');
    expect(feed.notes.join(' ')).toContain('Nothing was fabricated');
  });

  it('reports not configured when no feeds are supplied', async () => {
    const service = new NewsService({
      env: { NEWS_RSS_FEEDS: [], NEWS_POLL_MINUTES: 15 },
      now,
    });
    const feed = await service.getNews();
    expect(feed.items).toHaveLength(0);
    expect(service.getProviderHealth()[0]?.status).toBe('not_configured');
  });

  it('caches the feed and filters by instrument and limit', async () => {
    let calls = 0;
    const service = new NewsService({
      env: { NEWS_RSS_FEEDS: ['https://a.example/rss', 'https://b.example/rss'], NEWS_POLL_MINUTES: 15 },
      now,
      fetch: fakeFetch((url) => {
        calls += 1;
        return new Response(url.includes('a.example') ? feedA : feedB, { status: 200 });
      }),
    });

    const first = await service.getNews({ instrument: 'XAU/USD', limit: 1 });
    expect(first.cached).toBe(false);
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.instruments).toContain('XAU/USD');

    const second = await service.getNews({ instrument: 'XAU/USD', limit: 1 });
    expect(second.cached).toBe(true);
    expect(calls).toBe(2);
  });
});
