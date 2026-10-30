import type {
  TechnicalIndicators,
  Structure,
  PatternDetection,
} from '@atc/technical-analysis';
import { TechnicalAnalysisService } from '@atc/technical-analysis';
import type { MarketDataService } from '@atc/market-data';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nowIso, timeframeSchema, instrumentSymbolSchema } from '@atc/shared';
import { AppError } from '../errors.js';
import { technicalQuerySchema } from './types.js';

interface TechnicalRouteOptions {
  marketData: MarketDataService;
}

/**
 * Parse technical route params from wildcard path
 * Instruments contain a slash (e.g., XAU/USD) so we need special parsing
 * Supports: /instrument/timeframe or /instrument/timeframe/structure or /instrument/timeframe/patterns
 */
function parseTechnicalPath(
  path: string,
): { instrument: string; timeframe: string; subpath?: string } | null {
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  // Check if last segment is 'structure' or 'patterns'
  let subpath: string | undefined;
  let timeframeIndex = segments.length - 1;

  if (segments[segments.length - 1] === 'structure') {
    subpath = 'structure';
    timeframeIndex = segments.length - 2;
  } else if (segments[segments.length - 1] === 'patterns') {
    subpath = 'patterns';
    timeframeIndex = segments.length - 2;
  }

  if (timeframeIndex < 1) return null;

  const instrument = segments.slice(0, timeframeIndex).join('/');
  const timeframe = segments[timeframeIndex];

  if (!instrument || !timeframe) return null;

  return {
    instrument: instrument.toUpperCase(),
    timeframe: timeframe.toLowerCase(),
    subpath,
  };
}

export async function registerTechnicalRoutes(
  app: FastifyInstance,
  options: TechnicalRouteOptions,
): Promise<void> {
  const { marketData } = options;

  // Initialize technical analysis service with app logger
  const technicalAnalysis = new TechnicalAnalysisService(app.log);

  /**
   * Helper to fetch candles and validate
   */
  async function fetchAndValidateCandles(
    instrument: string,
    timeframe: string,
    lookback: number,
  ) {
    try {
      const batch = await marketData.getCandles(instrument, timeframe, lookback);
      if (!batch.series.candles || batch.series.candles.length === 0) {
        throw new AppError(
          503,
          'NO_CANDLES_AVAILABLE',
          `No candles available for ${instrument} ${timeframe}`,
          {
            provider: marketData.candleProvider.id,
            instrument,
            timeframe,
          },
        );
      }

      // Normalize candles to the format expected by technical analysis
      return batch.series.candles.map((candle) => ({
        timestamp: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? undefined,
      }));
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error) {
        throw new AppError(503, 'CANDLE_FETCH_ERROR', error.message, {
          instrument,
          timeframe,
        });
      }
      throw error;
    }
  }

  /**
   * GET /api/v1/technical/* - Unified technical analysis route
   * Handles:
   *   - /api/v1/technical/:instrument/:timeframe
   *   - /api/v1/technical/:instrument/:timeframe/structure
   *   - /api/v1/technical/:instrument/:timeframe/patterns
   */
  app.get('/api/v1/technical/*', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('cache-control', 'no-store');

    try {
      const rawPath = (request.params as { '*'?: string })['*'] ?? '';
      const parsed = parseTechnicalPath(rawPath);

      if (!parsed) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid technical analysis endpoint format. Expected: /api/v1/technical/:instrument/:timeframe[/structure|/patterns]',
        );
      }

      // Validate instrument and timeframe
      const instrument = instrumentSymbolSchema.parse(parsed.instrument);
      const timeframe = timeframeSchema.parse(parsed.timeframe);
      const query = technicalQuerySchema.parse(request.query);

      // Fetch and validate candles
      const candles = await fetchAndValidateCandles(instrument, timeframe, query.lookback);

      // Perform technical analysis
      let analysis: TechnicalIndicators;
      try {
        analysis = await technicalAnalysis.analyze(instrument, timeframe, candles);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Technical analysis failed';
        throw new AppError(500, 'ANALYSIS_ERROR', message, {
          instrument,
          timeframe,
        });
      }

      // Return based on subpath
      if (parsed.subpath === 'structure') {
        const structure: Structure = analysis.structure;
        return {
          status: 'ok',
          data: {
            trend: structure.trend,
            resistance_levels: structure.resistance_levels,
            support_levels: structure.support_levels,
            swing_high: structure.swing_high,
            swing_low: structure.swing_low,
          },
          timestamp: nowIso(),
        };
      }

      if (parsed.subpath === 'patterns') {
        const patterns: PatternDetection[] = analysis.patterns;
        return {
          status: 'ok',
          data: {
            patterns,
          },
          timestamp: nowIso(),
        };
      }

      // Default: return complete analysis
      return {
        status: 'ok',
        data: analysis,
        timestamp: nowIso(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw error;
    }
  });
}
