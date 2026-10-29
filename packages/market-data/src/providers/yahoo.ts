import {
  TIMEFRAME_MS,
  type Candle,
  type InstrumentSymbol,
  type ProviderInfo,
  type Timeframe,
} from '@atc/shared';
import { ProviderResponseError } from '../errors.js';
import { fetchJson } from '../http.js';
import { aggregateCandles, createCandleSeries, type RawCandle } from '../normalize.js';
import type { CandleProvider, ProviderContext } from '../types.js';

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const SYMBOLS: Record<InstrumentSymbol, string> = {
  'XAU/USD': 'GC=F',
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
};

const INTERVALS: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '1h',
  '1d': '1d',
  '1wk': '1wk',
};

const RANGES: Record<Timeframe, string> = {
  '1m': '5d',
  '5m': '1mo',
  '15m': '1mo',
  '30m': '1mo',
  '1h': '3mo',
  '4h': '6mo',
  '1d': '2y',
  '1wk': '5y',
};

interface YahooQuoteArrays {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
}

interface YahooResult {
  meta?: {
    symbol?: string;
    instrumentType?: string;
    dataGranularity?: string;
    regularMarketTime?: number;
  };
  timestamp?: number[];
  indicators?: { quote?: YahooQuoteArrays[] };
}

interface YahooResponse {
  chart?: {
    result?: YahooResult[];
    error?: { code?: string; description?: string } | null;
  };
}

const PROVIDER: ProviderInfo = {
  id: 'yahoo',
  displayName: 'Yahoo Finance chart (reference)',
  quality: 'reference',
  url: 'https://finance.yahoo.com/',
  note: 'Unofficial public chart endpoint. Reference quality, not trading-grade.',
};

function at<T>(values: T[] | undefined, index: number): T | null {
  return values && index < values.length ? (values[index] ?? null) : null;
}

export class YahooCandleProvider implements CandleProvider {
  readonly id = PROVIDER.id;
  readonly displayName = PROVIDER.displayName;
  readonly quality = PROVIDER.quality;
  readonly configured = true;
  readonly note = PROVIDER.note;

  async fetchCandles(
    instrument: InstrumentSymbol,
    timeframe: Timeframe,
    limit: number,
    context: ProviderContext,
  ) {
    const symbol = SYMBOLS[instrument];
    if (!symbol) {
      throw new ProviderResponseError(this.id, `Unsupported instrument: ${instrument}`);
    }
    const interval = INTERVALS[timeframe];
    const range = RANGES[timeframe];
    if (!interval || !range) {
      throw new ProviderResponseError(this.id, `Unsupported timeframe: ${timeframe}`);
    }

    const url = `${BASE_URL}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false&events=div%2Csplits`;
    const { data } = await fetchJson<YahooResponse>(url, context, this.id);
    const error = data.chart?.error;
    if (error) {
      throw new ProviderResponseError(
        this.id,
        `Yahoo returned an error: ${error.description ?? error.code ?? 'unknown error'}`,
      );
    }
    const result = data.chart?.result?.[0];
    if (!result) {
      throw new ProviderResponseError(this.id, 'Yahoo returned no chart result');
    }
    const timestamps = result.timestamp;
    const arrays = result.indicators?.quote?.[0];
    if (!Array.isArray(timestamps) || timestamps.length === 0 || !arrays) {
      throw new ProviderResponseError(this.id, 'Yahoo returned no candle arrays');
    }

    const isProxy = instrument === 'XAU/USD';
    const raw: RawCandle[] = timestamps.map((timestamp, index) => {
      const volume = at(arrays.volume, index);
      return {
        time: Math.trunc(timestamp) * 1000,
        open: at(arrays.open, index),
        high: at(arrays.high, index),
        low: at(arrays.low, index),
        close: at(arrays.close, index),
        volume: isProxy ? (volume !== null && volume > 0 ? volume : null) : null,
      };
    });

    let normalized: Candle[] = raw
      .filter((candle): candle is RawCandle & { open: number; high: number; low: number; close: number } =>
        candle.open !== null && candle.high !== null && candle.low !== null && candle.close !== null,
      )
      .map((candle) => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }));

    if (timeframe === '4h') {
      normalized = aggregateCandles(normalized, TIMEFRAME_MS['1h'], TIMEFRAME_MS['4h']);
    }
    normalized.sort((left, right) => left.time - right.time);
    const limited = normalized.slice(-limit);

    const notes = [
      'Yahoo Finance public chart endpoint. Reference quality, not trading-grade.',
      'The final candle may be incomplete while the market is open.',
    ];
    if (isProxy) {
      notes.push('COMEX gold futures (GC=F) proxy. Not spot XAU/USD.');
    }
    if (timeframe === '4h') {
      notes.push('4h candles aggregated from Yahoo 1h candles in UTC buckets.');
    }

    return createCandleSeries({
      instrument,
      timeframe,
      provider: PROVIDER,
      raw: limited,
      fetchedAt: context.now(),
      quality: 'reference',
      proxy: isProxy,
      proxyFor: isProxy ? 'XAU/USD' : undefined,
      notes,
    });
  }
}
