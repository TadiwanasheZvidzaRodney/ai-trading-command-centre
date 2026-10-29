import type { InstrumentSymbol, ProviderInfo } from '@atc/shared';
import { ProviderResponseError } from '../errors.js';
import { fetchJson } from '../http.js';
import { createQuote } from '../normalize.js';
import type { ProviderContext, QuoteProvider } from '../types.js';

const BASE_URL = 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument';

interface SwissquoteSpreadProfile {
  spreadProfile?: string;
  bid?: number | string;
  ask?: number | string;
}

interface SwissquoteEntry {
  topo?: { platform?: string; server?: string };
  spreadProfilePrices?: SwissquoteSpreadProfile[];
  ts?: number;
}

const PROVIDER: ProviderInfo = {
  id: 'swissquote',
  displayName: 'Swissquote public quotes',
  quality: 'reference',
  url: 'https://www.swissquote.com/',
  note: 'Undocumented public website feed. Reference quality, not trading-grade.',
};

function timestampMs(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value > 1_000_000_000_000 ? value : value * 1000;
}

function asNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SwissquoteQuoteProvider implements QuoteProvider {
  readonly id = PROVIDER.id;
  readonly displayName = PROVIDER.displayName;
  readonly quality = PROVIDER.quality;
  readonly configured = true;
  readonly note = PROVIDER.note;

  async fetchQuote(instrument: InstrumentSymbol, context: ProviderContext) {
    const [base, quote] = instrument.split('/');
    if (!base || !quote) {
      throw new ProviderResponseError(this.id, `Unsupported instrument: ${instrument}`);
    }
    const url = `${BASE_URL}/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;
    const { data } = await fetchJson<unknown>(url, context, this.id);
    if (!Array.isArray(data) || data.length === 0) {
      throw new ProviderResponseError(this.id, 'Swissquote returned an empty quote payload');
    }

    const entries = data as SwissquoteEntry[];
    const entry =
      entries.find((candidate) => candidate.topo?.platform === 'SwissquoteLtd') ?? entries[0];
    if (!entry) {
      throw new ProviderResponseError(this.id, 'Swissquote returned no usable topology');
    }
    const profiles = entry.spreadProfilePrices ?? [];
    const price =
      profiles.find((candidate) => candidate.spreadProfile === 'premium') ?? profiles[0];
    if (!price) {
      throw new ProviderResponseError(this.id, 'Swissquote returned no spread profile prices');
    }

    const observedMs = timestampMs(entry.ts);
    if (observedMs === null) {
      throw new ProviderResponseError(this.id, 'Swissquote returned an invalid timestamp');
    }
    const bid = asNumber(price.bid);
    const ask = asNumber(price.ask);
    if (bid === null || ask === null) {
      throw new ProviderResponseError(this.id, 'Swissquote returned an incomplete bid/ask pair');
    }

    return createQuote({
      instrument,
      bid,
      ask,
      provider: PROVIDER,
      observedAt: new Date(observedMs),
      fetchedAt: context.now(),
      quality: 'reference',
      note: 'Public Swissquote feed; premium spread profile selected where available. Reference quality.',
      staleAfterSeconds: 120,
    });
  }
}
