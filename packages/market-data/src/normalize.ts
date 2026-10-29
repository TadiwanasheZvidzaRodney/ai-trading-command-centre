import {
  TIMEFRAME_MS,
  candleSeriesSchema,
  quoteSchema,
  type Candle,
  type CandleGap,
  type CandleSeries,
  type DataQuality,
  type InstrumentSymbol,
  type ProviderInfo,
  type Quote,
  type Timeframe,
} from '@atc/shared';
import { ProviderResponseError } from './errors.js';

export const QUOTE_STALE_SECONDS = 120;

export interface CreateQuoteInput {
  instrument: InstrumentSymbol;
  bid: number | null;
  ask: number | null;
  mid?: number | null;
  provider: ProviderInfo;
  observedAt: string | Date;
  fetchedAt: Date;
  quality?: DataQuality;
  proxy?: boolean;
  proxyFor?: InstrumentSymbol;
  note?: string;
  staleAfterSeconds?: number;
}

export interface RawCandle {
  time: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface CreateCandleSeriesInput {
  instrument: InstrumentSymbol;
  timeframe: Timeframe;
  provider: ProviderInfo;
  raw: RawCandle[];
  fetchedAt: Date;
  quality?: DataQuality;
  proxy: boolean;
  proxyFor?: InstrumentSymbol;
  notes?: string[];
}

function parseDate(value: string | Date, label: string, providerId: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ProviderResponseError(providerId, `Provider returned an invalid ${label}`);
  }
  return date;
}

function optionalPositive(
  value: number | null | undefined,
  label: string,
  providerId: string,
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) {
    throw new ProviderResponseError(providerId, `Provider returned a non-positive ${label}`);
  }
  return value;
}

function cleanNumber(value: number): number {
  return Number(value.toFixed(10));
}

function truncateNote(note: string): string {
  return note.length > 500 ? `${note.slice(0, 497)}...` : note;
}

export function createQuote(input: CreateQuoteInput): Quote {
  const providerId = input.provider.id;
  const bid = optionalPositive(input.bid, 'bid', providerId);
  const ask = optionalPositive(input.ask, 'ask', providerId);
  let mid: number;
  let spread: number | null = null;

  if (bid !== null && ask !== null) {
    if (ask < bid) {
      throw new ProviderResponseError(providerId, 'Provider returned an ask below the bid');
    }
    mid = cleanNumber((bid + ask) / 2);
    spread = cleanNumber(ask - bid);
  } else if (bid === null && ask === null) {
    const providedMid = optionalPositive(input.mid, 'mid price', providerId);
    if (providedMid === null) {
      throw new ProviderResponseError(providerId, 'Provider returned no usable quote price');
    }
    mid = cleanNumber(providedMid);
  } else {
    throw new ProviderResponseError(
      providerId,
      'Provider returned only one side of the bid/ask pair',
    );
  }

  const observedAt = parseDate(input.observedAt, 'observation time', providerId);
  const fetchedAt = parseDate(input.fetchedAt, 'fetch time', providerId);
  if (observedAt.getTime() > fetchedAt.getTime() + 60_000) {
    throw new ProviderResponseError(providerId, 'Provider observation time is in the future');
  }

  const ageSeconds = Math.max(
    0,
    Math.floor((fetchedAt.getTime() - observedAt.getTime()) / 1000),
  );
  const staleAfterSeconds = input.staleAfterSeconds ?? QUOTE_STALE_SECONDS;
  const proxy = input.proxy === true;
  const quality = proxy ? 'proxy' : (input.quality ?? input.provider.quality);

  return quoteSchema.parse({
    instrument: input.instrument,
    bid,
    ask,
    mid,
    spread,
    provider: input.provider,
    observedAt: observedAt.toISOString(),
    fetchedAt: fetchedAt.toISOString(),
    ageSeconds,
    stale: ageSeconds > staleAfterSeconds,
    quality,
    proxy,
    proxyFor: proxy ? input.proxyFor : undefined,
    note: input.note ? truncateNote(input.note) : undefined,
  });
}

export function spansWeekend(afterMs: number, beforeMs: number): boolean {
  if (beforeMs <= afterMs) return false;
  // A gap longer than a long weekend is more likely missing data than a
  // normal market closure. Keep it visible as unexpected instead of hiding it.
  if (beforeMs - afterMs > 4 * 24 * 60 * 60 * 1000) return false;
  const day = new Date(afterMs);
  day.setUTCHours(0, 0, 0, 0);
  const end = beforeMs;
  while (day.getTime() <= end) {
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) return true;
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return false;
}

export function detectGaps(candles: readonly Candle[], timeframeMs: number): CandleGap[] {
  if (candles.length < 2 || timeframeMs <= 0) return [];
  const gaps: CandleGap[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    if (!previous || !current) continue;
    const steps = Math.round((current.time - previous.time) / timeframeMs);
    if (steps > 1) {
      gaps.push({
        after: previous.time,
        before: current.time,
        missing: steps - 1,
        expected: spansWeekend(previous.time, current.time),
      });
    }
  }
  return gaps;
}

export function createCandleSeries(input: CreateCandleSeriesInput): CandleSeries {
  const providerId = input.provider.id;
  const byTime = new Map<number, Candle>();
  let invalid = 0;
  let duplicates = 0;

  for (const raw of input.raw) {
    if (!Number.isFinite(raw.time) || raw.time <= 0) {
      invalid += 1;
      continue;
    }
    const time = Math.trunc(raw.time);
    const open = raw.open;
    const high = raw.high;
    const low = raw.low;
    const close = raw.close;
    if (
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0 ||
      high < Math.max(open, close) ||
      low > Math.min(open, close) ||
      high < low
    ) {
      invalid += 1;
      continue;
    }
    const volume =
      raw.volume !== null && Number.isFinite(raw.volume) && raw.volume >= 0
        ? raw.volume
        : null;
    if (byTime.has(time)) duplicates += 1;
    byTime.set(time, { time, open, high, low, close, volume });
  }

  const candles = [...byTime.values()].sort((left, right) => left.time - right.time);
  if (candles.length === 0) {
    throw new ProviderResponseError(providerId, 'Provider returned no usable candles');
  }

  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) {
    throw new ProviderResponseError(providerId, 'Provider returned no usable candles');
  }

  const notes = [...(input.notes ?? [])];
  if (invalid > 0) notes.push(`Removed ${invalid} invalid candle(s).`);
  if (duplicates > 0) notes.push(`Removed ${duplicates} duplicate candle(s).`);
  if (input.proxy) {
    notes.push(
      `Proxy data: ${input.instrument} is represented by ${input.provider.displayName}; this is not the direct instrument.`,
    );
  }
  const gaps = detectGaps(candles, TIMEFRAME_MS[input.timeframe]);
  if (gaps.length > 0) {
    notes.push(`Detected ${gaps.length} gap(s); weekend/holiday closures may be expected.`);
  }

  const quality = input.proxy ? 'proxy' : (input.quality ?? input.provider.quality);
  const series: CandleSeries = {
    instrument: input.instrument,
    timeframe: input.timeframe,
    provider: input.provider,
    candles,
    fetchedAt: input.fetchedAt.toISOString(),
    from: new Date(first.time).toISOString(),
    to: new Date(last.time).toISOString(),
    quality,
    proxy: input.proxy,
    proxyFor: input.proxy ? input.proxyFor : undefined,
    duplicatesRemoved: duplicates,
    gaps,
    notes: notes.map(truncateNote),
  };

  return candleSeriesSchema.parse(series);
}

/**
 * Aggregate lower-timeframe candles into a fixed UTC bucket. Used for Yahoo
 * 4h candles because the public endpoint does not expose a native 4h interval.
 */
export function aggregateCandles(
  candles: readonly Candle[],
  sourceMs: number,
  targetMs: number,
): Candle[] {
  if (candles.length === 0 || targetMs <= sourceMs) return [...candles];

  const buckets = new Map<number, Candle[]>();
  for (const candle of candles) {
    const bucketTime = Math.floor(candle.time / targetMs) * targetMs;
    const bucket = buckets.get(bucketTime);
    if (bucket) bucket.push(candle);
    else buckets.set(bucketTime, [candle]);
  }

  const aggregated: Candle[] = [];
  for (const [time, group] of buckets) {
    group.sort((left, right) => left.time - right.time);
    const first = group[0];
    const last = group[group.length - 1];
    if (!first || !last) continue;
    const volume = group.every((candle) => candle.volume !== null)
      ? group.reduce((total, candle) => total + (candle.volume ?? 0), 0)
      : null;
    aggregated.push({
      time,
      open: first.open,
      high: Math.max(...group.map((candle) => candle.high)),
      low: Math.min(...group.map((candle) => candle.low)),
      close: last.close,
      volume,
    });
  }

  return aggregated.sort((left, right) => left.time - right.time);
}

export function refreshQuoteAge(
  quote: Quote,
  now: Date,
  staleAfterSeconds = QUOTE_STALE_SECONDS,
): Quote {
  const observedMs = Date.parse(quote.observedAt);
  const ageSeconds = Number.isNaN(observedMs)
    ? quote.ageSeconds
    : Math.max(0, Math.floor((now.getTime() - observedMs) / 1000));
  return {
    ...quote,
    ageSeconds,
    stale: ageSeconds > staleAfterSeconds,
  };
}
