import { describe, expect, it } from 'vitest';
import { cleanText, parseFeed, sourceNameForUrl } from './rss';

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example feed</title>
    <item>
      <title><![CDATA[Fed holds rates as &amp; inflation cools]]></title>
      <link>https://example.com/a?utm_source=rss</link>
      <description><![CDATA[<p>The Federal Reserve kept rates steady.</p>]]></description>
      <pubDate>Thu, 29 Oct 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Missing date</title>
      <link>https://example.com/b</link>
    </item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>ECB press conference</title>
    <link rel="alternate" href="https://example.com/ecb"/>
    <summary>Lagarde speaks in Frankfurt.</summary>
    <updated>2026-10-29T10:30:00Z</updated>
  </entry>
</feed>`;

describe('RSS parsing', () => {
  it('parses RSS items and skips entries without a published date', () => {
    const parsed = parseFeed(rss, 'https://example.com/rss');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.skipped).toBe(1);
    expect(parsed.items[0]).toMatchObject({
      title: 'Fed holds rates as & inflation cools',
      url: 'https://example.com/a?utm_source=rss',
      publishedAt: '2026-10-29T12:00:00.000Z',
      source: 'example.com',
    });
    expect(parsed.items[0]?.summary).toBe('The Federal Reserve kept rates steady.');
  });

  it('parses Atom entries with href links', () => {
    const parsed = parseFeed(atom, 'https://www.ecb.europa.eu/rss/press.html');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      title: 'ECB press conference',
      url: 'https://example.com/ecb',
      publishedAt: '2026-10-29T10:30:00.000Z',
      source: 'European Central Bank',
    });
  });

  it('decodes entities and strips markup without inventing content', () => {
    expect(cleanText('&lt;p&gt;A &amp; B&#33;&lt;/p&gt;')).toBe('A & B!');
    expect(cleanText('   spaced   text  ')).toBe('spaced text');
  });

  it('derives readable source names from feed hosts', () => {
    expect(sourceNameForUrl('https://feeds.bbci.co.uk/news/business/rss.xml')).toBe(
      'BBC Business',
    );
    expect(sourceNameForUrl('https://unknown.example/rss')).toBe('unknown.example');
  });
});
