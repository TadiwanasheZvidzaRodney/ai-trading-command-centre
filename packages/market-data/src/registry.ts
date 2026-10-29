import { MarketDataError } from './errors.js';
import { OandaProvider } from './providers/oanda.js';
import { SwissquoteQuoteProvider } from './providers/swissquote.js';
import { TwelveDataProvider } from './providers/twelvedata.js';
import { YahooCandleProvider } from './providers/yahoo.js';
import type { CandleProvider, MarketDataEnv, QuoteProvider } from './types.js';

export function createQuoteProvider(env: MarketDataEnv): QuoteProvider {
  switch (env.MARKET_DATA_QUOTE_PROVIDER) {
    case 'swissquote':
      return new SwissquoteQuoteProvider();
    case 'twelvedata':
      return new TwelveDataProvider({
        apiKey: env.MARKET_DATA_TWELVE_DATA_API_KEY,
      });
    case 'oanda':
      return new OandaProvider({
        apiToken: env.MARKET_DATA_OANDA_API_TOKEN,
        accountId: env.MARKET_DATA_OANDA_ACCOUNT_ID,
        environment: env.MARKET_DATA_OANDA_ENVIRONMENT,
      });
    default:
      throw new MarketDataError(
        'PROVIDER_NOT_CONFIGURED',
        `Unsupported quote provider: ${String(env.MARKET_DATA_QUOTE_PROVIDER)}`,
      );
  }
}

export function createCandleProvider(env: MarketDataEnv): CandleProvider {
  switch (env.MARKET_DATA_CANDLE_PROVIDER) {
    case 'yahoo':
      return new YahooCandleProvider();
    case 'twelvedata':
      return new TwelveDataProvider({
        apiKey: env.MARKET_DATA_TWELVE_DATA_API_KEY,
      });
    case 'oanda':
      return new OandaProvider({
        apiToken: env.MARKET_DATA_OANDA_API_TOKEN,
        accountId: env.MARKET_DATA_OANDA_ACCOUNT_ID,
        environment: env.MARKET_DATA_OANDA_ENVIRONMENT,
      });
    default:
      throw new MarketDataError(
        'PROVIDER_NOT_CONFIGURED',
        `Unsupported candle provider: ${String(env.MARKET_DATA_CANDLE_PROVIDER)}`,
      );
  }
}
