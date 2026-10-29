import type {
  CandleSeries,
  DataQuality,
  InstrumentSymbol,
  ProviderHealth,
  Quote,
  Timeframe,
} from '@atc/shared';

export type MarketDataLogger = {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
};

export interface ProviderContext {
  fetch: typeof fetch;
  now: () => Date;
  timeoutMs: number;
  retries: number;
  userAgent: string;
}

export interface ProviderMetadata {
  id: string;
  displayName: string;
  quality: DataQuality;
  configured: boolean;
  note?: string;
}

export interface QuoteProvider extends ProviderMetadata {
  fetchQuote(instrument: InstrumentSymbol, context: ProviderContext): Promise<Quote>;
}

export interface CandleProvider extends ProviderMetadata {
  fetchCandles(
    instrument: InstrumentSymbol,
    timeframe: Timeframe,
    limit: number,
    context: ProviderContext,
  ): Promise<CandleSeries>;
}

export interface QuoteError {
  instrument: InstrumentSymbol;
  code: string;
  message: string;
}

export interface MarketQuote extends Quote {
  cached: boolean;
}

export interface QuoteBatch {
  quotes: MarketQuote[];
  errors: QuoteError[];
  fetchedAt: string;
}

export interface CandleBatch {
  series: CandleSeries;
  cached: boolean;
}

export interface MarketDataStore {
  saveQuotes(quotes: Quote[]): Promise<void>;
  saveCandleSeries(series: CandleSeries): Promise<void>;
}

/**
 * The subset of runtime configuration the market-data layer needs. The full
 * application Env object is structurally compatible with this type.
 */
export interface MarketDataEnv {
  MARKET_DATA_QUOTE_PROVIDER: 'swissquote' | 'twelvedata' | 'oanda';
  MARKET_DATA_CANDLE_PROVIDER: 'yahoo' | 'twelvedata' | 'oanda';
  MARKET_DATA_CACHE_QUOTE_SECONDS: number;
  MARKET_DATA_CACHE_CANDLE_SECONDS: number;
  MARKET_DATA_TWELVE_DATA_API_KEY?: string;
  MARKET_DATA_OANDA_API_TOKEN?: string;
  MARKET_DATA_OANDA_ACCOUNT_ID?: string;
  MARKET_DATA_OANDA_ENVIRONMENT: 'practice' | 'live';
}

export interface MarketDataServiceOptions {
  env: MarketDataEnv;
  store?: MarketDataStore;
  fetch?: typeof fetch;
  now?: () => Date;
  logger?: MarketDataLogger;
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
  quoteProvider?: QuoteProvider;
  candleProvider?: CandleProvider;
}

export type ProviderHealthSnapshot = ProviderHealth;
