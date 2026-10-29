import {
  INSTRUMENT_VALUES,
  type InstrumentSymbol,
  type Quote,
  type Timeframe,
} from '@atc/shared';
import { TtlCache } from './cache.js';
import {
  MarketDataError,
  MarketDataUnavailableError,
  ProviderNotConfiguredError,
} from './errors.js';
import { ProviderHealthTracker } from './health.js';
import { refreshQuoteAge } from './normalize.js';
import { createCandleProvider, createQuoteProvider } from './registry.js';
import type {
  CandleBatch,
  CandleProvider,
  MarketDataLogger,
  MarketDataServiceOptions,
  MarketDataStore,
  MarketQuote,
  ProviderContext,
  ProviderMetadata,
  QuoteBatch,
  QuoteError,
  QuoteProvider,
} from './types.js';

const DEFAULT_USER_AGENT =
  'ATC/0.1 (personal trading research; reference data only)';

function instrumentOrder(instrument: InstrumentSymbol): number {
  return INSTRUMENT_VALUES.indexOf(instrument);
}

function errorCode(error: unknown): string {
  return error instanceof MarketDataError ? error.code : 'PROVIDER_UNAVAILABLE';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Provider request failed';
}

function metadata(provider: QuoteProvider | CandleProvider): ProviderMetadata {
  return {
    id: provider.id,
    displayName: provider.displayName,
    quality: provider.quality,
    configured: provider.configured,
    note: provider.note,
  };
}

export class MarketDataService {
  readonly quoteProvider: QuoteProvider;
  readonly candleProvider: CandleProvider;
  private readonly quoteCache = new TtlCache<Quote>();
  private readonly candleCache = new TtlCache<
    Awaited<ReturnType<CandleProvider['fetchCandles']>>
  >();
  private readonly health: ProviderHealthTracker;
  private readonly context: ProviderContext;
  private readonly quoteTtlMs: number;
  private readonly candleTtlMs: number;
  private readonly store?: MarketDataStore;
  private readonly logger?: MarketDataLogger;
  private readonly now: () => Date;

  constructor(options: MarketDataServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.store = options.store;
    this.logger = options.logger;
    this.quoteProvider = options.quoteProvider ?? createQuoteProvider(options.env);
    this.candleProvider = options.candleProvider ?? createCandleProvider(options.env);
    this.quoteTtlMs = options.env.MARKET_DATA_CACHE_QUOTE_SECONDS * 1000;
    this.candleTtlMs = options.env.MARKET_DATA_CACHE_CANDLE_SECONDS * 1000;
    this.context = {
      fetch: options.fetch ?? fetch,
      now: this.now,
      timeoutMs: options.timeoutMs ?? 10_000,
      retries: options.retries ?? 2,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    };
    this.health = new ProviderHealthTracker({ now: this.now });
    this.health.register({
      providerId: this.quoteProvider.id,
      displayName: this.quoteProvider.displayName,
      category: 'market-data',
      configured: this.quoteProvider.configured,
      quality: this.quoteProvider.quality,
      note: this.quoteProvider.note,
    });
    this.health.register({
      providerId: this.candleProvider.id,
      displayName: this.candleProvider.displayName,
      category: 'market-data',
      configured: this.candleProvider.configured,
      quality: this.candleProvider.quality,
      note: this.candleProvider.note,
    });
  }

  getProviderMetadata(): { quote: ProviderMetadata; candle: ProviderMetadata } {
    return {
      quote: metadata(this.quoteProvider),
      candle: metadata(this.candleProvider),
    };
  }

  getProviderHealth() {
    return this.health.list();
  }

  async getQuotes(instruments: readonly InstrumentSymbol[]): Promise<QuoteBatch> {
    const unique = [...new Set(instruments)];
    const quotes: MarketQuote[] = [];
    const errors: QuoteError[] = [];
    const fresh: Quote[] = [];
    const failures: Array<{ error: unknown; latencyMs: number }> = [];
    const latencies: number[] = [];

    await Promise.all(
      unique.map(async (instrument) => {
        const cacheKey = `${this.quoteProvider.id}:${instrument}`;
        const cached = this.quoteCache.get(cacheKey, this.now().getTime());
        if (cached) {
          quotes.push({
            ...refreshQuoteAge(cached, this.now()),
            cached: true,
          });
          return;
        }

        if (!this.quoteProvider.configured) {
          this.health.markNotConfigured(
            this.quoteProvider.id,
            `${this.quoteProvider.displayName} is not configured.`,
          );
          errors.push({
            instrument,
            code: 'PROVIDER_NOT_CONFIGURED',
            message: `${this.quoteProvider.displayName} is not configured.`,
          });
          return;
        }

        const started = performance.now();
        try {
          const quote = await this.quoteProvider.fetchQuote(instrument, this.context);
          const latencyMs = performance.now() - started;
          latencies.push(latencyMs);
          this.quoteCache.set(cacheKey, quote, this.quoteTtlMs, this.now().getTime());
          fresh.push(quote);
          quotes.push({ ...quote, cached: false });
        } catch (error) {
          failures.push({ error, latencyMs: performance.now() - started });
          errors.push({
            instrument,
            code: errorCode(error),
            message: errorMessage(error),
          });
        }
      }),
    );

    if (fresh.length > 0 || failures.length > 0) {
      const latencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;
      if (fresh.length > 0 && failures.length === 0) {
        this.health.recordSuccess(this.quoteProvider.id, latencyMs);
      } else if (fresh.length > 0) {
        this.health.recordDegraded(
          this.quoteProvider.id,
          failures[0]?.error,
          latencyMs,
        );
      } else {
        this.health.recordFailure(
          this.quoteProvider.id,
          failures[0]?.error,
          failures[0]?.latencyMs ?? latencyMs,
        );
      }
    }

    if (fresh.length > 0 && this.store) {
      try {
        await this.store.saveQuotes(fresh);
      } catch (error) {
        this.logger?.warn(
          { err: error, providerId: this.quoteProvider.id },
          'Failed to persist quotes; returning live data without persistence',
        );
      }
    }

    quotes.sort((left, right) => instrumentOrder(left.instrument) - instrumentOrder(right.instrument));
    errors.sort((left, right) => instrumentOrder(left.instrument) - instrumentOrder(right.instrument));
    return {
      quotes,
      errors,
      fetchedAt: this.now().toISOString(),
    };
  }

  async getQuote(instrument: InstrumentSymbol): Promise<MarketQuote> {
    const batch = await this.getQuotes([instrument]);
    const quote = batch.quotes[0];
    if (quote) return quote;
    const error = batch.errors[0];
    throw new MarketDataUnavailableError(
      error?.message ?? `No quote available for ${instrument}`,
      {
        providerId: this.quoteProvider.id,
        instrument,
        originalCode: error?.code,
      },
    );
  }

  async getCandles(
    instrument: InstrumentSymbol,
    timeframe: Timeframe,
    limit: number,
  ): Promise<CandleBatch> {
    const cacheKey = `${this.candleProvider.id}:${instrument}:${timeframe}:${limit}`;
    const cached = this.candleCache.get(cacheKey, this.now().getTime());
    if (cached) {
      return { series: cached, cached: true };
    }

    if (!this.candleProvider.configured) {
      this.health.markNotConfigured(
        this.candleProvider.id,
        `${this.candleProvider.displayName} is not configured.`,
      );
      throw new ProviderNotConfiguredError(
        this.candleProvider.id,
        `${this.candleProvider.displayName} is not configured.`,
      );
    }

    const started = performance.now();
    try {
      const series = await this.candleProvider.fetchCandles(
        instrument,
        timeframe,
        limit,
        this.context,
      );
      this.health.recordSuccess(this.candleProvider.id, performance.now() - started);
      this.candleCache.set(
        cacheKey,
        series,
        this.candleTtlMs,
        this.now().getTime(),
      );
      if (this.store) {
        try {
          await this.store.saveCandleSeries(series);
        } catch (error) {
          this.logger?.warn(
            { err: error, providerId: this.candleProvider.id, instrument, timeframe },
            'Failed to persist candles; returning live data without persistence',
          );
        }
      }
      return { series, cached: false };
    } catch (error) {
      this.health.recordFailure(
        this.candleProvider.id,
        error,
        performance.now() - started,
      );
      throw new MarketDataUnavailableError(
        errorMessage(error),
        {
          providerId: this.candleProvider.id,
          instrument,
          timeframe,
          originalCode: errorCode(error),
        },
      );
    }
  }

  invalidateCaches(): void {
    this.quoteCache.clear();
    this.candleCache.clear();
  }
}
