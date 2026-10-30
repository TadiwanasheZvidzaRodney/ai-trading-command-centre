import type { CalendarEvent, ProviderInfo } from '@atc/shared';

export type CalendarLogger = {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
};

export interface CalendarEnv {
  CALENDAR_POLL_MINUTES: number;
}

export interface CalendarStore {
  save(events: CalendarEvent[]): Promise<void>;
}

export interface CalendarServiceOptions {
  env: CalendarEnv;
  store?: CalendarStore;
  logger?: CalendarLogger;
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
}

export const CALENDAR_PROVIDER: ProviderInfo = {
  id: 'forexfactory',
  displayName: 'Forex Factory community calendar',
  quality: 'reference',
  note: 'Unofficial community mirror; current week only and no actual values. Verify high-impact events against the primary statistical agency.',
};

export const CALENDAR_SOURCE_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
export const CALENDAR_PAGE_URL = 'https://www.forexfactory.com/calendar';
