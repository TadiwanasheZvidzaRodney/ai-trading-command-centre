import type {
  InstrumentSymbol,
  ProviderInfo,
  Timeframe,
} from '@atc/shared';
import {
  ProviderNotConfiguredError,
  ProviderResponseError,
} from '../errors.js';
import { fetchJson } from '../http.js';
import { createCandleSeries, createQuote, type RawCandle } from '../normalize.js';
import type {
  CandleProvider,
  ProviderContext,
  QuoteProvider,
} from '../types.js';

const BASE_URL = 'https://api.twelvedata.com';

const INTERVALS: Record<Timeframe, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '4h': '4h',
  '1d': '1day',
  '1wk': '1week',
};

interface TwelveDataQuoteResponse {
  status?: string;
  code?: number | string;
  message?: string;
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  datetime?: string;
  timestamp?: number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  price?: string | number;
}

interface TwelveDataCandleValue {
  datetime?: string;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
}

interface TwelveDataCandleResponse {
  status?: string;
  code?: number | string;
  message?: string;
  values?: TwelveDataCandleValue[];
}

export interface TwelveDataConfig {
  apiKey?: string;
  baseUrl?: string;
}

const PROVIDER: ProviderInfo = {
  id: 'twelvedata',
  displayName: 'Twelve Data (free tier)',
  quality: 'reference',
  url: 'https://twelvedata.com/',
  note: 'Free-tier data; verify delay, symbol coverage and licensing before relying on it.',
};

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateTime(value: string | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes('T')
    ? value
    : value.includes(' ')
      ? `${value.replace(' ', 'T')}Z`
      : `${value}T00:00:00Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function providerError(data: { status?: string; code?: number | string; message?: string }): void {
  if (data.status === 'error' || data.code !== undefined) {
    throw new ProviderResponseError(
      'twelvedata',
      `Twelve Data error: ${data.message ?? String(data.code ?? 'unknown error')}`,
    );
  }
}

export class TwelveDataProvider implements QuoteProvider, CandleProvider {
  readonly id = PROVIDER.id;
  readonly displayName = PROVIDER.displayName;
  readonly quality = PROVIDER.quality;
  readonly configured: boolean;
  readonly note = PROVIDER.note;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(config: TwelveDataConfig = {}) {
    this.apiKey = config.apiKey?.trim() || undefined;
    this.baseUrl = config.baseUrl ?? BASE_URL;
    this.configured = Boolean(this.apiKey);
  }

  private requireKey(): string {
    if (!this.apiKey) {
      throw new ProviderNotConfiguredError(
        this.id,
        'Twelve Data requires MARKET_DATA_TWELVE_DATA_API_KEY.',
      );
    }
    return this.apiKey;
  }

  async fetchQuote(instrument: InstrumentSymbol, context: ProviderContext) {
    const apiKey = this.requireKey();
    const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(instrument)}&timezone=UTC&apikey=${encodeURIComponent(apiKey)}`;
    const { data } = await fetchJson<TwelveDataQuoteResponse>(url, context, this.id);
    providerError(data);

    const price = toNumber(data.close) ?? toNumber(data.price);
    if (price === null) {
      throw new ProviderResponseError(this.id, 'Twelve Data returned no close price');
    }
    const observedAt =
      typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)
        ? new Date(data.timestamp * 1000)
        : parseDateTime(data.datetime);
    if (!observedAt) {
      throw new ProviderResponseError(this.id, 'Twelve Data returned no observation time');
    }

    return createQuote({
      instrument,
      bid: null,
      ask: null,
      mid: price,
      provider: PROVIDER,
      observedAt,
      fetchedAt: context.now(),
      quality: 'reference',
      note: 'Twelve Data quote close/mid price; no bid/ask on the free endpoint. Reference quality.',
      staleAfterSeconds: 300,
    });
  }

  async fetchCandles(
    instrument: InstrumentSymbol,
    timeframe: Timeframe,
    limit: number,
    context: ProviderContext,
  ) {
    const apiKey = this.requireKey();
    const interval = INTERVALS[timeframe];
    if (!interval) {
      throw new ProviderResponseError(this.id, `Unsupported timeframe: ${timeframe}`);
    }
    const outputsize = Math.min(Math.max(limit, 10), 5000);
    const url = `${this.baseUrl}/time_series?symbol=${encodeURIComponent(instrument)}&interval=${interval}&outputsize=${outputsize}&timezone=UTC&apikey=${encodeURIComponent(apiKey)}`;
    const { data } = await fetchJson<TwelveDataCandleResponse>(url, context, this.id);
    providerError(data);
    if (!Array.isArray(data.values) || data.values.length === 0) {
      throw new ProviderResponseError(this.id, 'Twelve Data returned no candles');
    }

    const raw: RawCandle[] = [];
    for (const value of [...data.values].reverse()) {
      const time = parseDateTime(value.datetime);
      if (!time) {
        throw new ProviderResponseError(this.id, 'Twelve Data returned an invalid candle time');
      }
      const volume = toNumber(value.volume);
      raw.push({
        time: time.getTime(),
        open: toNumber(value.open),
        high: toNumber(value.high),
        low: toNumber(value.low),
        close: toNumber(value.close),
        volume: volume !== null && volume > 0 ? volume : null,
      });
    }

    return createCandleSeries({
      instrument,
      timeframe,
      provider: PROVIDER,
      raw,
      fetchedAt: context.now(),
      quality: 'reference',
      proxy: false,
      notes: [
        'Twelve Data free-tier candles; verify delay and symbol coverage against the provider documentation.',
      ],
    });
  }
}
