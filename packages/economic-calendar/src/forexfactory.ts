import {
  stableHash,
  type CalendarEvent,
  type Impact,
  type InstrumentSymbol,
} from '@atc/shared';
import { CALENDAR_PAGE_URL } from './types';

const SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'GBP']);

const CURRENCY_INSTRUMENTS: Record<string, InstrumentSymbol[]> = {
  USD: ['XAU/USD', 'EUR/USD', 'GBP/USD'],
  EUR: ['EUR/USD'],
  GBP: ['GBP/USD'],
};

const IMPACT_MAP: Record<string, Impact> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  holiday: 'holiday',
  'non-economic': 'unknown',
};

export interface ParsedCalendar {
  events: CalendarEvent[];
  skipped: number;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normaliseImpact(value: unknown): Impact {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return IMPACT_MAP[raw] ?? 'unknown';
}

/**
 * Parse the Forex Factory community JSON mirror. Only USD, EUR and GBP events
 * are kept because those are the currencies behind the supported instruments.
 * Rows without a title, supported currency or parseable date are skipped.
 */
export function parseForexFactory(payload: unknown, fetchedAt: string): ParsedCalendar {
  if (!Array.isArray(payload)) {
    throw new Error('Calendar response is not a JSON array');
  }

  const events: CalendarEvent[] = [];
  let skipped = 0;

  for (const row of payload) {
    if (!row || typeof row !== 'object') {
      skipped += 1;
      continue;
    }
    const record = row as Record<string, unknown>;
    const title = text(record.title);
    const currency = text(record.country)?.toUpperCase();
    const rawDate = text(record.date);
    if (!title || !currency || !rawDate) {
      skipped += 1;
      continue;
    }
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      skipped += 1;
      continue;
    }
    const parsed = Date.parse(rawDate);
    if (Number.isNaN(parsed)) {
      skipped += 1;
      continue;
    }

    const scheduledAt = new Date(parsed).toISOString();
    const impact = normaliseImpact(record.impact);
    const externalId = stableHash(`${title}|${currency}|${scheduledAt}|${impact}`);
    events.push({
      id: `cal_${externalId}`,
      externalId,
      title,
      currency,
      country: currency,
      impact,
      scheduledAt,
      forecast: text(record.forecast),
      previous: text(record.previous),
      actual: text(record.actual),
      source: 'forexfactory',
      sourceUrl: CALENDAR_PAGE_URL,
      fetchedAt,
      instruments: CURRENCY_INSTRUMENTS[currency] ?? [],
      note: 'Community mirror of Forex Factory data. Current week only; no actual values.',
    });
  }

  events.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  return { events, skipped };
}
