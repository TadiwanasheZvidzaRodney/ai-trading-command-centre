import {
  INSTRUMENT_LIST,
  INSTRUMENT_VALUES,
  candleQuerySchema,
  instrumentSymbolSchema,
  isInstrumentSymbol,
  nowIso,
  quoteQuerySchema,
  type InstrumentSymbol,
} from '@atc/shared';
import type { MarketDataService } from '@atc/market-data';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors.js';

function parseSymbols(raw: string | undefined): InstrumentSymbol[] {
  if (!raw) return [...INSTRUMENT_VALUES];
  const values = raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (values.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'symbols must contain at least one instrument',
      { supported: INSTRUMENT_VALUES },
    );
  }
  const invalid = values.filter((value) => !isInstrumentSymbol(value));
  if (invalid.length > 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `Unsupported instrument: ${invalid.join(', ')}`,
      { supported: INSTRUMENT_VALUES },
    );
  }
  return [...new Set(values as InstrumentSymbol[])];
}

export async function registerMarketRoutes(
  app: FastifyInstance,
  options: { marketData: MarketDataService },
): Promise<void> {
  const { marketData } = options;

  app.get('/api/v1/instruments', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return {
      instruments: INSTRUMENT_LIST,
      providers: marketData.getProviderMetadata(),
      timestamp: nowIso(),
    };
  });

  app.get('/api/v1/market/quotes', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const query = quoteQuerySchema.parse(request.query);
    const symbols = parseSymbols(query.symbols);
    const batch = await marketData.getQuotes(symbols);
    if (batch.quotes.length === 0) {
      throw new AppError(
        503,
        'MARKET_DATA_UNAVAILABLE',
        'No market quotes are available. No fallback or fabricated price was used.',
        {
          errors: batch.errors,
          provider: marketData.quoteProvider.id,
        },
      );
    }
    return { ...batch, timestamp: nowIso() };
  });

  // Instruments contain a slash (for example XAU/USD), so the wildcard captures
  // the full symbol rather than a single path segment.
  app.get('/api/v1/market/quotes/*', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const raw = (request.params as { '*'?: string })['*'] ?? '';
    const instrument = instrumentSymbolSchema.parse(raw);
    const quote = await marketData.getQuote(instrument);
    return { quote, timestamp: nowIso() };
  });

  app.get('/api/v1/market/candles/*', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const raw = (request.params as { '*'?: string })['*'] ?? '';
    const instrument = instrumentSymbolSchema.parse(raw);
    const query = candleQuerySchema.parse(request.query);
    const batch = await marketData.getCandles(instrument, query.timeframe, query.limit);
    return {
      series: batch.series,
      cached: batch.cached,
      timestamp: nowIso(),
    };
  });

  app.get('/api/v1/market/providers', async () => ({
    providers: marketData.getProviderHealth(),
    timestamp: nowIso(),
  }));
}
