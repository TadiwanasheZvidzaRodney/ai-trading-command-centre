import { formatInTimeZone } from 'date-fns-tz';
import type { Instrument, InstrumentSymbol, Timeframe } from './types';
import { TIMEFRAME_MS } from './constants';

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }
  return date.toISOString();
}

export function toMs(value: Date | number | string): number {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }
  return ms;
}

export function ageSeconds(observedAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.round((now - toMs(observedAt)) / 1000));
}

export function isStale(observedAt: string, maxAgeSeconds: number, now: number = Date.now()): boolean {
  return ageSeconds(observedAt, now) > maxAgeSeconds;
}

export function formatInTimezone(
  value: Date | number | string,
  timeZone: string,
  pattern = 'yyyy-MM-dd HH:mm',
): string {
  try {
    return formatInTimeZone(value, timeZone, pattern);
  } catch {
    return formatInTimeZone(value, 'UTC', pattern);
  }
}

export function formatDateTime(value: Date | number | string, timeZone: string): string {
  return formatInTimezone(value, timeZone, 'yyyy-MM-dd HH:mm');
}

export function formatDate(value: Date | number | string, timeZone: string): string {
  return formatInTimezone(value, timeZone, 'yyyy-MM-dd');
}

export function formatTime(value: Date | number | string, timeZone: string): string {
  return formatInTimezone(value, timeZone, 'HH:mm');
}

export function dayKey(value: Date | number | string, timeZone: string): string {
  return formatInTimezone(value, timeZone, 'yyyy-MM-dd');
}

export function formatRelativeAge(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'unknown';
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export function timeframeToMs(timeframe: Timeframe): number {
  return TIMEFRAME_MS[timeframe];
}

export function bucketStart(ms: number, timeframe: Timeframe): number {
  const size = timeframeToMs(timeframe);
  return Math.floor(ms / size) * size;
}

export function isWeekendUtc(ms: number): boolean {
  const day = new Date(ms).getUTCDay();
  return day === 0 || day === 6;
}

export function isExpectedMarketGap(
  afterMs: number,
  beforeMs: number,
  timeframe: Timeframe,
): boolean {
  if (beforeMs <= afterMs) return true;
  const span = beforeMs - afterMs;
  const bar = timeframeToMs(timeframe);
  if (timeframe === '1d' || timeframe === '1wk') {
    return span >= bar * 2 || isWeekendUtc(afterMs) || isWeekendUtc(beforeMs);
  }
  if (span >= bar * 4 && (isWeekendUtc(afterMs) || isWeekendUtc(beforeMs))) {
    return true;
  }
  return false;
}

export interface MarketSessionState {
  open: boolean;
  reason: string;
  timezone: 'UTC';
}

/**
 * Approximate session state for display only. It is not used to gate orders by itself.
 * Forex: Sunday 22:00 UTC to Friday 22:00 UTC.
 * Metals: Sunday 23:00 UTC to Friday 21:00 UTC, with a 21:00-23:00 UTC daily break.
 */
export function marketSessionState(instrument: Instrument | InstrumentSymbol, at = Date.now()): MarketSessionState {
  const kind = typeof instrument === 'string' ? (instrument === 'XAU/USD' ? 'metal' : 'forex') : instrument.kind;
  const date = new Date(at);
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  if (day === 6) {
    return { open: false, reason: 'Weekend (Saturday)', timezone: 'UTC' };
  }
  if (day === 5 && hour >= 22) {
    return { open: false, reason: 'Weekend (Friday close)', timezone: 'UTC' };
  }
  if (day === 0 && hour < 22) {
    return { open: false, reason: 'Weekend (before Sunday open)', timezone: 'UTC' };
  }
  if (kind === 'metal') {
    if (day === 0 && hour < 23) {
      return { open: false, reason: 'Metals open at 23:00 UTC on Sunday', timezone: 'UTC' };
    }
    if (day >= 1 && day <= 4 && hour === 21) {
      return { open: false, reason: 'Metals daily break (21:00-23:00 UTC)', timezone: 'UTC' };
    }
    if (day === 5 && hour >= 21) {
      return { open: false, reason: 'Metals Friday close (21:00 UTC)', timezone: 'UTC' };
    }
  }
  return { open: true, reason: 'Session open (approximate)', timezone: 'UTC' };
}

export function minutesUntil(value: Date | number | string, now: number = Date.now()): number {
  return Math.round((toMs(value) - now) / 60_000);
}

export function isWithinBlackout(
  eventAt: Date | number | string,
  blackoutMinutes: number,
  now: number = Date.now(),
): boolean {
  const diff = Math.abs(toMs(eventAt) - now);
  return diff <= blackoutMinutes * 60_000;
}
