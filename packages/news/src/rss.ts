import type { ParsedFeed, RawNewsItem } from './types';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

function fromCodePoint(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return '';
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

export function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name] ?? match);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ');
}

export function cleanText(value: string): string {
  return stripTags(decodeXml(value)).replace(/\s+/g, ' ').trim();
}

function extractTag(block: string, names: string[]): string | null {
  for (const name of names) {
    const pattern = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
    const match = pattern.exec(block);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
}

function extractLink(block: string): string | null {
  const attribute = /<link\b[^>]*href=["']([^"']+)["'][^>]*>/i.exec(block);
  if (attribute?.[1]) return decodeXml(attribute[1]).trim();
  const element = extractTag(block, ['link']);
  if (element) {
    const text = cleanText(element);
    if (text) return text;
  }
  const guid = extractTag(block, ['guid']);
  return guid ? cleanText(guid) : null;
}

function parsePublishedAt(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(cleanText(value));
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function sourceNameForUrl(feedUrl: string): string {
  let host: string;
  try {
    host = new URL(feedUrl).hostname.toLowerCase();
  } catch {
    return feedUrl;
  }
  if (host.includes('fxstreet')) return 'FXStreet';
  if (host.includes('dowjones') || host.includes('marketwatch')) return 'MarketWatch';
  if (host.includes('ecb.europa.eu')) return 'European Central Bank';
  if (host.includes('federalreserve')) return 'Federal Reserve';
  if (host.includes('bankofengland')) return 'Bank of England';
  if (host.includes('bbc')) return 'BBC Business';
  return host.replace(/^www\./, '');
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Parse RSS 2.0 or Atom XML into raw items. Items without a title, link or a
 * parseable published date are skipped rather than given a fabricated time.
 */
export function parseFeed(xml: string, feedUrl: string, source?: string): ParsedFeed {
  const itemBlocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(
    (match) => match[1] ?? '',
  );
  const blocks =
    itemBlocks.length > 0
      ? itemBlocks
      : [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(
          (match) => match[1] ?? '',
        );
  const resolvedSource = source ?? sourceNameForUrl(feedUrl);
  const items: RawNewsItem[] = [];
  let skipped = 0;

  for (const block of blocks) {
    const title = cleanText(extractTag(block, ['title']) ?? '');
    const url = extractLink(block);
    const publishedAt = parsePublishedAt(
      extractTag(block, ['pubDate', 'published', 'updated', 'dc:date', 'date']),
    );
    if (!title || !url || !publishedAt) {
      skipped += 1;
      continue;
    }
    const summary = truncate(
      cleanText(extractTag(block, ['description', 'summary', 'content:encoded', 'content']) ?? ''),
      600,
    );
    items.push({ title, summary, url, source: resolvedSource, publishedAt });
  }

  return { items, skipped };
}
