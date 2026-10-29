import type { InstrumentSymbol, ProviderInfo, Timeframe } from '@atc/shared';
import {
  ProviderNotConfiguredError,
  ProviderResponseError,
} from '../errors.js';
import { fetchJson } from '../http.js';
import { createCandleSeries, createQuote, type RawCandle } from '../normalize.js';
import type { CandleProvider, ProviderContext, QuoteProvider } from '../types.js';

const SYMBOLS: Record<InstrumentSymbol, string> = {
  'XAU/USD': 'XAU_USD',
  'EUR/USD': 'EUR_USD',
  'GBP/USD': 'GBP_USD',
};

const GRANULARITIES: Record<Timeframe, string> = {
  '1m': 'M1',
  '5m': 'M5',
  '15m': 'M15',
  '30m': 'M30',
  '1h': 'H1',
  '4h': 'H4',
  '1d': 'D',
  '1wk': 'W',
};

interface OandaPrice {
  instrument?: string;
  time?: string;
  tradeable?: boolean;
  bids?: Array<{ price?: string }>;
  asks?: Array<{ price?: string }>;
  closeoutBid?: string;
  closeoutAsk?: string;
}

interface OandaPricingResponse {
  prices?: OandaPrice[];
  errorMessage?: string;
  errorCode?: string;
}

interface OandaCandle {
  complete?: boolean;
  volume?: number;
  time?: string;
  mid?: { o?: string; h?: string; l?: string; c?: string };
}

interface OandaCandlesResponse {
  instrument?: string;
  granularity?: string;
  candles?: OandaCandle[];
  errorMessage?: string;
  errorCode?: string;
}

export interface OandaConfig {
  apiToken?: string;
  accountId?: string;
  environment?: 'practice' | 'live';
  baseUrl?: string;
}

const PROVIDER: ProviderInfo = {
  id: 'oanda',
  displayName: 'OANDA practice',
  quality: 'reference',
  url: 'https://www.oanda.com/',
  note: 'Practice feed only. Reference quality; not a live execution connection.',
};

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOandaTime(value: string | undefined): Date | null {
  if (!value) return null;
  const normalized = value.replace(/(\.\d{3})\d+Z$/, '$1Z');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function throwIfError(data: { errorMessage?: string; errorCode?: string }): void {
  if (data.errorMessage || data.errorCode) {
    throw new ProviderResponseError(
      'oanda',
      `OANDA error: ${data.errorMessage ?? data.errorCode ?? 'unknown error'}`,
    );
  }
}

export class OandaProvider implements QuoteProvider, CandleProvider {
  readonly id = PROVIDER.id;
  readonly displayName = PROVIDER.displayName;
  readonly quality = PROVIDER.quality;
  readonly configured: boolean;
  readonly note = PROVIDER.note;
  private readonly apiToken: string | undefined;
  private readonly accountId: string | undefined;
  private readonly baseUrl: string;

  constructor(config: OandaConfig = {}) {
    this.apiToken = config.apiToken?.trim() || undefined;
    this.accountId = config.accountId?.trim() || undefined;
    const environment = config.environment ?? 'practice';
    this.baseUrl =
      config.baseUrl ??
      (environment === 'live'
        ? 'https://api-fxtrade.oanda.com'
        : 'https://api-fxpractice.oanda.com');
    this.configured = Boolean(
      this.apiToken && this.accountId && environment === 'practice',
    );
  }

  private requireConfig(): { token: string; accountId: string } {
    if (!this.apiToken || !this.accountId || !this.configured) {
      throw new ProviderNotConfiguredError(
        this.id,
        'OANDA requires MARKET_DATA_OANDA_API_TOKEN, MARKET_DATA_OANDA_ACCOUNT_ID and the practice environment.',
      );
    }
    return { token: this.apiToken, accountId: this.accountId };
  }

  private headers(token: string): Record<string, string> {
    return { authorization: `Bearer ${token}` };
  }

  async fetchQuote(instrument: InstrumentSymbol, context: ProviderContext) {
    const { token, accountId } = this.requireConfig();
    const symbol = SYMBOLS[instrument];
    if (!symbol) {
      throw new ProviderResponseError(this.id, `Unsupported instrument: ${instrument}`);
    }
    const url = `${this.baseUrl}/v3/accounts/${encodeURIComponent(accountId)}/pricing?instruments=${encodeURIComponent(symbol)}`;
    const { data } = await fetchJson<OandaPricingResponse>(url, context, this.id, {
      headers: this.headers(token),
    });
    throwIfError(data);
    const price = data.prices?.[0];
    if (!price) {
      throw new ProviderResponseError(this.id, 'OANDA returned no price');
    }
    const bid = toNumber(price.bids?.[0]?.price) ?? toNumber(price.closeoutBid);
    const ask = toNumber(price.asks?.[0]?.price) ?? toNumber(price.closeoutAsk);
    if (bid === null || ask === null) {
      throw new ProviderResponseError(this.id, 'OANDA returned an incomplete bid/ask pair');
    }
    const observedAt = parseOandaTime(price.time);
    if (!observedAt) {
      throw new ProviderResponseError(this.id, 'OANDA returned an invalid price time');
    }

    return createQuote({
      instrument,
      bid,
      ask,
      provider: PROVIDER,
      observedAt,
      fetchedAt: context.now(),
      quality: 'reference',
      note: 'OANDA practice pricing. Reference quality; not a live execution connection.',
      staleAfterSeconds: 120,
    });
  }

  async fetchCandles(
    instrument: InstrumentSymbol,
    timeframe: Timeframe,
    limit: number,
    context: ProviderContext,
  ) {
    const { token } = this.requireConfig();
    const symbol = SYMBOLS[instrument];
    const granularity = GRANULARITIES[timeframe];
    if (!symbol || !granularity) {
      throw new ProviderResponseError(
        this.id,
        `Unsupported instrument/timeframe: ${instrument} ${timeframe}`,
      );
    }
    const count = Math.min(Math.max(limit, 10), 5000);
    const url = `${this.baseUrl}/v3/instruments/${encodeURIComponent(symbol)}/candles?granularity=${granularity}&count=${count}&price=M`;
    const { data } = await fetchJson<OandaCandlesResponse>(url, context, this.id, {
      headers: this.headers(token),
    });
    throwIfError(data);
    if (!Array.isArray(data.candles) || data.candles.length === 0) {
      throw new ProviderResponseError(this.id, 'OANDA returned no candles');
    }

    let incomplete = false;
    const raw: RawCandle[] = [];
    for (const candle of data.candles) {
      const time = parseOandaTime(candle.time);
      if (!time) {
        throw new ProviderResponseError(this.id, 'OANDA returned an invalid candle time');
      }
      if (candle.complete === false) incomplete = true;
      const volume =
        typeof candle.volume === 'number' && Number.isFinite(candle.volume) && candle.volume > 0
          ? candle.volume
          : null;
      raw.push({
        time: time.getTime(),
        open: toNumber(candle.mid?.o),
        high: toNumber(candle.mid?.h),
        low: toNumber(candle.mid?.l),
        close: toNumber(candle.mid?.c),
        volume,
      });
    }

    const notes = [
      'OANDA practice candles. Reference quality; not a live execution connection.',
    ];
    if (incomplete) notes.push('Includes the current incomplete candle.');

    return createCandleSeries({
      instrument,
      timeframe,
      provider: PROVIDER,
      raw,
      fetchedAt: context.now(),
      quality: 'reference',
      proxy: false,
      notes,
    });
  }
}
