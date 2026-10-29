import { describe, expect, it, vi } from 'vitest';
import fixture from '../fixtures/swissquote-xauusd.json';
import { ProviderResponseError } from '../errors.js';
import { jsonResponse, providerContext } from '../test-helpers.js';
import { SwissquoteQuoteProvider } from './swissquote.js';

describe('Swissquote quote adapter', () => {
  it('parses a real public quote payload with provider and timestamp provenance', async () => {
    const entry =
      fixture.find((item) => item.topo?.platform === 'SwissquoteLtd') ?? fixture[0];
    if (!entry) throw new Error('Swissquote fixture is empty');
    const price =
      entry.spreadProfilePrices.find((item) => item.spreadProfile === 'premium') ??
      entry.spreadProfilePrices[0];
    if (!price || price.bid === undefined || price.ask === undefined) {
      throw new Error('Swissquote fixture has no usable price');
    }
    const observedAt = new Date(entry.ts);
    const fetchedAt = new Date(entry.ts + 21_000);

    const fetchImpl = vi.fn(async () => jsonResponse(fixture));
    const provider = new SwissquoteQuoteProvider();
    const quote = await provider.fetchQuote(
      'XAU/USD',
      providerContext(fetchImpl as unknown as typeof fetch, fetchedAt),
    );

    expect(quote.instrument).toBe('XAU/USD');
    expect(quote.bid).toBe(price.bid);
    expect(quote.ask).toBe(price.ask);
    expect(quote.mid).toBeCloseTo((price.bid + price.ask) / 2, 6);
    expect(quote.spread).toBeCloseTo(price.ask - price.bid, 6);
    expect(quote.provider.id).toBe('swissquote');
    expect(quote.quality).toBe('reference');
    expect(quote.proxy).toBe(false);
    expect(quote.stale).toBe(false);
    expect(quote.observedAt).toBe(observedAt.toISOString());
    expect(quote.fetchedAt).toBe(fetchedAt.toISOString());
    expect(quote.ageSeconds).toBe(21);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty payload instead of fabricating a quote', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]));
    const provider = new SwissquoteQuoteProvider();
    await expect(
      provider.fetchQuote('EUR/USD', providerContext(fetchImpl as unknown as typeof fetch)),
    ).rejects.toBeInstanceOf(ProviderResponseError);
  });

  it('rejects an inverted bid/ask pair', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        {
          topo: { platform: 'SwissquoteLtd' },
          spreadProfilePrices: [{ spreadProfile: 'premium', bid: 1.2, ask: 1.1 }],
          ts: 1793102648935,
        },
      ]),
    );
    const provider = new SwissquoteQuoteProvider();
    await expect(
      provider.fetchQuote('EUR/USD', providerContext(fetchImpl as unknown as typeof fetch)),
    ).rejects.toThrow(/ask below the bid/i);
  });
});
