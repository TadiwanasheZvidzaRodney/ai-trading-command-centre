import { describe, expect, it, vi } from 'vitest';
import candlesFixture from '../fixtures/oanda-candles-xauusd.json';
import pricingFixture from '../fixtures/oanda-pricing-xauusd.json';
import { ProviderNotConfiguredError, ProviderResponseError } from '../errors.js';
import { jsonResponse, providerContext } from '../test-helpers.js';
import { OandaProvider } from './oanda.js';

const config = {
  apiToken: 'test-token',
  accountId: '101-001-1234567-001',
  environment: 'practice' as const,
};

describe('OANDA practice adapter', () => {
  it('parses practice pricing and sends the bearer token only in the request header', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        jsonResponse(pricingFixture),
    );
    const provider = new OandaProvider(config);
    const quote = await provider.fetchQuote(
      'XAU/USD',
      providerContext(fetchImpl as unknown as typeof fetch),
    );

    expect(quote.bid).toBe(4014.494);
    expect(quote.ask).toBe(4015.156);
    expect(quote.mid).toBeCloseTo(4014.825, 6);
    expect(quote.provider.id).toBe('oanda');
    expect(quote.quality).toBe('reference');
    expect(quote.observedAt).toBe('2026-10-27T12:00:00.123Z');
    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.stringify(request?.headers)).toContain('Bearer test-token');
  });

  it('parses practice candles and notes an incomplete final candle', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(candlesFixture));
    const provider = new OandaProvider(config);
    const series = await provider.fetchCandles(
      'XAU/USD',
      '1d',
      100,
      providerContext(fetchImpl as unknown as typeof fetch),
    );

    expect(series.candles).toHaveLength(3);
    expect(series.candles[0]?.open).toBe(3998);
    expect(series.candles.at(-1)?.close).toBe(4014.8);
    expect(series.proxy).toBe(false);
    expect(series.notes.join(' ')).toContain('current incomplete candle');
    expect(series.gaps[0]).toMatchObject({ missing: 2, expected: true });
  });

  it('fails closed without practice credentials', async () => {
    const provider = new OandaProvider({ environment: 'practice' });
    await expect(
      provider.fetchQuote('EUR/USD', providerContext(vi.fn() as unknown as typeof fetch)),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it('surfaces provider error payloads', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ errorMessage: 'Invalid account', errorCode: 'ACCOUNT_INVALID' }),
    );
    const provider = new OandaProvider(config);
    await expect(
      provider.fetchQuote(
        'EUR/USD',
        providerContext(fetchImpl as unknown as typeof fetch),
      ),
    ).rejects.toBeInstanceOf(ProviderResponseError);
  });
});
