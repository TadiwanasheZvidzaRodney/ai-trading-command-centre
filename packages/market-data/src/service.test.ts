import type { CandleSeries, InstrumentSymbol, Quote } from '@atc/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  MarketDataUnavailableError,
  ProviderRequestError,
} from './errors.js';
import { createCandleSeries, createQuote } from './normalize.js';
import { MarketDataService } from './service.js';
import type {
  CandleProvider,
  MarketDataEnv,
  MarketDataStore,
  ProviderContext,
  QuoteProvider,
} from './types.js';

const env: MarketDataEnv = {
  MARKET_DATA_QUOTE_PROVIDER: 'swissquote',
  MARKET_DATA_CANDLE_PROVIDER: 'yahoo',
  MARKET_DATA_CACHE_QUOTE_SECONDS: 60,
  MARKET_DATA_CACHE_CANDLE_SECONDS: 300,
  MARKET_DATA_OANDA_ENVIRONMENT: 'practice',
};

class FakeQuoteProvider implements QuoteProvider {
  readonly id = 'fake-quote';
  readonly displayName = 'Fake quote provider';
  readonly quality = 'reference' as const;
  readonly note = 'test';
  configured = true;
  calls = 0;
  failFor: InstrumentSymbol | null = null;

  async fetchQuote(instrument: InstrumentSymbol, context: ProviderContext) {
    this.calls += 1;
    if (this.failFor === instrument) {
      throw new ProviderRequestError(
        this.id,
        'PROVIDER_UNAVAILABLE',
        'Simulated provider failure',
        { retryable: false },
      );
    }
    return createQuote({
      instrument,
      bid: 100,
      ask: 100.1,
      provider: {
        id: this.id,
        displayName: this.displayName,
        quality: this.quality,
      },
      observedAt: context.now(),
      fetchedAt: context.now(),
      quality: 'reference',
    });
  }
}

class FakeCandleProvider implements CandleProvider {
  readonly id = 'fake-candle';
  readonly displayName = 'Fake candle provider';
  readonly quality = 'reference' as const;
  readonly note = 'test';
  configured = true;
  calls = 0;
  fail = false;

  async fetchCandles(
    instrument: InstrumentSymbol,
    timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1wk',
    _limit: number,
    context: ProviderContext,
  ) {
    this.calls += 1;
    if (this.fail) {
      throw new ProviderRequestError(
        this.id,
        'PROVIDER_UNAVAILABLE',
        'Simulated candle failure',
        { retryable: false },
      );
    }
    const isProxy = instrument === 'XAU/USD';
    return createCandleSeries({
      instrument,
      timeframe,
      provider: {
        id: this.id,
        displayName: this.displayName,
        quality: this.quality,
      },
      raw: [
        {
          time: Date.UTC(2026, 9, 27),
          open: 100,
          high: 102,
          low: 99,
          close: 101,
          volume: null,
        },
      ],
      fetchedAt: context.now(),
      quality: 'reference',
      proxy: isProxy,
      proxyFor: isProxy ? 'XAU/USD' : undefined,
      notes: [],
    });
  }
}

class FakeStore implements MarketDataStore {
  quotes: Quote[] = [];
  series: CandleSeries[] = [];
  fail = false;

  async saveQuotes(quotes: Quote[]): Promise<void> {
    if (this.fail) throw new Error('store unavailable');
    this.quotes.push(...quotes);
  }

  async saveCandleSeries(series: CandleSeries): Promise<void> {
    if (this.fail) throw new Error('store unavailable');
    this.series.push(series);
  }
}

function setup() {
  let current = new Date('2026-10-27T12:00:00.000Z');
  const quoteProvider = new FakeQuoteProvider();
  const candleProvider = new FakeCandleProvider();
  const store = new FakeStore();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const service = new MarketDataService({
    env,
    quoteProvider,
    candleProvider,
    store,
    now: () => current,
    logger,
  });
  return {
    service,
    quoteProvider,
    candleProvider,
    store,
    logger,
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe('market data service', () => {
  it('fetches quotes, sorts them and persists them', async () => {
    const { service, quoteProvider, store } = setup();
    const batch = await service.getQuotes(['GBP/USD', 'XAU/USD', 'EUR/USD']);

    expect(batch.errors).toHaveLength(0);
    expect(batch.quotes.map((quote) => quote.instrument)).toEqual([
      'XAU/USD',
      'EUR/USD',
      'GBP/USD',
    ]);
    expect(batch.quotes.every((quote) => quote.cached === false)).toBe(true);
    expect(quoteProvider.calls).toBe(3);
    expect(store.quotes).toHaveLength(3);
    expect(
      service.getProviderHealth().find((item) => item.providerId === 'fake-quote')
        ?.status,
    ).toBe('ok');
  });

  it('serves cached quotes and refreshes their age', async () => {
    const { service, quoteProvider, advance } = setup();
    await service.getQuotes(['EUR/USD']);
    advance(30_000);
    const batch = await service.getQuotes(['EUR/USD']);

    expect(quoteProvider.calls).toBe(1);
    expect(batch.quotes[0]?.cached).toBe(true);
    expect(batch.quotes[0]?.ageSeconds).toBe(30);
  });

  it('refetches after the quote cache expires', async () => {
    const { service, quoteProvider, advance } = setup();
    await service.getQuotes(['EUR/USD']);
    advance(61_000);
    await service.getQuotes(['EUR/USD']);
    expect(quoteProvider.calls).toBe(2);
  });

  it('returns partial quotes with an explicit error when one instrument fails', async () => {
    const { service, quoteProvider } = setup();
    quoteProvider.failFor = 'EUR/USD';
    const batch = await service.getQuotes(['XAU/USD', 'EUR/USD', 'GBP/USD']);

    expect(batch.quotes).toHaveLength(2);
    expect(batch.errors).toHaveLength(1);
    expect(batch.errors[0]).toMatchObject({
      instrument: 'EUR/USD',
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(
      service.getProviderHealth().find((item) => item.providerId === 'fake-quote')
        ?.status,
    ).toBe('degraded');
  });

  it('fails closed for a single quote when the provider fails', async () => {
    const { service, quoteProvider } = setup();
    quoteProvider.failFor = 'XAU/USD';
    await expect(service.getQuote('XAU/USD')).rejects.toBeInstanceOf(
      MarketDataUnavailableError,
    );
  });

  it('does not call an unconfigured quote provider', async () => {
    const { service, quoteProvider } = setup();
    quoteProvider.configured = false;
    const batch = await service.getQuotes(['EUR/USD']);
    expect(batch.quotes).toHaveLength(0);
    expect(batch.errors[0]?.code).toBe('PROVIDER_NOT_CONFIGURED');
    expect(quoteProvider.calls).toBe(0);
    expect(
      service.getProviderHealth().find((item) => item.providerId === 'fake-quote')
        ?.status,
    ).toBe('not_configured');
  });

  it('fetches, caches and persists candles with proxy metadata', async () => {
    const { service, candleProvider, store } = setup();
    const first = await service.getCandles('XAU/USD', '1d', 100);
    const second = await service.getCandles('XAU/USD', '1d', 100);

    expect(first.cached).toBe(false);
    expect(first.series.proxy).toBe(true);
    expect(first.series.proxyFor).toBe('XAU/USD');
    expect(first.series.notes.join(' ')).toContain('Proxy data');
    expect(second.cached).toBe(true);
    expect(candleProvider.calls).toBe(1);
    expect(store.series).toHaveLength(1);
    expect(service.getProviderHealth().find((item) => item.providerId === 'fake-candle')?.status).toBe('ok');
  });

  it('fails closed when candle retrieval fails', async () => {
    const { service, candleProvider } = setup();
    candleProvider.fail = true;
    await expect(service.getCandles('EUR/USD', '1d', 100)).rejects.toBeInstanceOf(
      MarketDataUnavailableError,
    );
    expect(service.getProviderHealth().find((item) => item.providerId === 'fake-candle')?.status).toBe('error');
  });

  it('keeps serving quotes when persistence fails', async () => {
    const { service, store, logger } = setup();
    store.fail = true;
    const batch = await service.getQuotes(['EUR/USD']);
    expect(batch.quotes).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('exposes provider metadata for the instruments endpoint', () => {
    const { service } = setup();
    const metadata = service.getProviderMetadata();
    expect(metadata.quote.id).toBe('fake-quote');
    expect(metadata.candle.id).toBe('fake-candle');
    expect(metadata.quote.configured).toBe(true);
  });
});
