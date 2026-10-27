import { describe, expect, it } from 'vitest';
import { createEnv, DEV_SESSION_SECRET } from './env.js';

const base = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  AUTH_MODE: 'disabled',
  LIVE_TRADING_ENABLED: 'false',
};

describe('environment validation', () => {
  it('accepts a minimal test configuration', () => {
    const env = createEnv(base);
    expect(env.API_PORT).toBe(4000);
    expect(env.TRADING_MODE).toBe('research');
    expect(env.MARKET_DATA_QUOTE_PROVIDER).toBe('swissquote');
  });

  it('parses RSS feeds into an array', () => {
    const env = createEnv({
      ...base,
      NEWS_RSS_FEEDS: 'https://example.com/a.xml, https://example.com/b.xml',
    });
    expect(env.NEWS_RSS_FEEDS).toEqual([
      'https://example.com/a.xml',
      'https://example.com/b.xml',
    ]);
  });

  it('rejects an invalid timezone', () => {
    expect(() => createEnv({ ...base, DEFAULT_TIMEZONE: 'Mars/Olympus' })).toThrow(
      /DEFAULT_TIMEZONE/,
    );
  });

  it('rejects live trading', () => {
    expect(() => createEnv({ ...base, LIVE_TRADING_ENABLED: 'true' })).toThrow(/Live trading/);
  });

  it('rejects auth disabled in production', () => {
    expect(() =>
      createEnv({
        ...base,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-long-enough-123',
      }),
    ).toThrow(/AUTH_MODE/);
  });

  it('rejects the development secret in production', () => {
    expect(() =>
      createEnv({
        ...base,
        NODE_ENV: 'production',
        AUTH_MODE: 'session',
        AUTH_USERNAME: 'owner',
        AUTH_PASSWORD_HASH: '$2b$12$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        SESSION_SECRET: DEV_SESSION_SECRET,
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('requires a bcrypt hash when session auth is enabled', () => {
    expect(() =>
      createEnv({
        ...base,
        AUTH_MODE: 'session',
        AUTH_USERNAME: 'owner',
        AUTH_PASSWORD_HASH: 'plaintext',
      }),
    ).toThrow(/AUTH_PASSWORD_HASH/);
  });

  it('requires provider credentials when a keyed provider is selected', () => {
    expect(() =>
      createEnv({ ...base, MARKET_DATA_CANDLE_PROVIDER: 'twelvedata' }),
    ).toThrow(/TWELVE_DATA/);
    expect(() => createEnv({ ...base, MARKET_DATA_QUOTE_PROVIDER: 'oanda' })).toThrow(/OANDA/);
  });

  it('requires an AI key and model for hosted providers', () => {
    expect(() => createEnv({ ...base, AI_PROVIDER: 'gemini' })).toThrow(/AI_API_KEY/);
    expect(() => createEnv({ ...base, AI_PROVIDER: 'ollama' })).toThrow(/AI_MODEL/);
  });
});
