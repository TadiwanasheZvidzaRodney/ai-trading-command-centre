import { describe, expect, it, vi } from 'vitest';
import candlesFixture from '../fixtures/twelvedata-candles-xauusd.json';
import quoteFixture from '../fixtures/twelvedata-quote-xauusd.json';
import { ProviderNotConfiguredError, ProviderResponseError } from '../errors.js';
import { jsonResponse, providerContext } from '../test-helpers.js';
import { TwelveDataProvider } from './twelvedata.js';

describe('Twelve Data adapter', () => {
  it('parses a mid-only quote when the free endpoint has no bid/ask', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        jsonResponse(quoteFixture),
    );
    const provider = new TwelveDataProvider({ apiKey: 'test-key' });
    const quote = await provider.fetchQuote(
      'XAU/USD',
      providerContext(fetchImpl as unknown as typeof fetch),
    );

    expect(quote.bid).toBeNull();
    expect(quote.ask).toBeNull();
    expect(quote.mid).toBe(4014.8);
    expect(quote.spread).toBeNull();
    expect(quote.provider.id).toBe('twelvedata');
    expect(quote.quality).toBe('reference');
    expect(quote.observedAt).toBe('2026-10-27T12:00:00.000Z');
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('apikey=test-key');
  });

  it('parses and sorts daily candles', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(candlesFixture));
    const provider = new TwelveDataProvider({ apiKey: 'test-key' });
    const series = await provider.fetchCandles(
      'XAU/USD',
      '1d',
      100,
      providerContext(fetchImpl as unknown as typeof fetch),
    );

    expect(series.candles).toHaveLength(3);
    expect(series.candles[0]?.time).toBe(Date.parse('2026-10-23T00:00:00Z'));
    expect(series.candles.at(-1)?.time).toBe(Date.parse('2026-10-27T00:00:00Z'));
    expect(series.candles.every((candle) => candle.volume === null)).toBe(true);
    expect(series.proxy).toBe(false);
    expect(series.quality).toBe('reference');
    expect(series.gaps[0]).toMatchObject({ missing: 2, expected: true });
  });

  it('fails closed without an API key', async () => {
    const provider = new TwelveDataProvider();
    await expect(
      provider.fetchQuote('EUR/USD', providerContext(vi.fn() as unknown as typeof fetch)),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it('surfaces provider error payloads without pretending they are quotes', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 'error', code: 429, message: 'API limit reached' }),
    );
    const provider = new TwelveDataProvider({ apiKey: 'test-key' });
    await expect(
      provider.fetchQuote(
        'EUR/USD',
        providerContext(fetchImpl as unknown as typeof fetch),
      ),
    ).rejects.toBeInstanceOf(ProviderResponseError);
  });
});
