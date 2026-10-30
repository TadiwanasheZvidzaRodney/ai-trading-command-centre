import type { NewsItem, ProviderInfo } from '@atc/shared';

export type NewsLogger = {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
};

export interface NewsEnv {
  NEWS_RSS_FEEDS: string[];
  NEWS_POLL_MINUTES: number;
}

export interface NewsStore {
  save(items: NewsItem[]): Promise<void>;
}

export interface NewsServiceOptions {
  env: NewsEnv;
  store?: NewsStore;
  logger?: NewsLogger;
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
}

export interface RawNewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface ParsedFeed {
  items: RawNewsItem[];
  skipped: number;
}

export const NEWS_PROVIDER: ProviderInfo = {
  id: 'rss',
  displayName: 'Public RSS news',
  quality: 'reference',
  note: 'Public RSS feeds; headline, link and published time only. Relevance is deterministic keyword tagging, not sentiment or a prediction.',
};

export const NEWS_PROVIDER_URL = 'https://www.fxstreet.com/rss/news';
