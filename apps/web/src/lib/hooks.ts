'use client';

import type {
  CalendarFeed,
  CandleSeries,
  Impact,
  Instrument,
  InstrumentSymbol,
  NewsFeed,
  ProviderHealth,
  ProviderInfo,
  Quote,
  Task,
  Timeframe,
} from '@atc/shared';
import useSWR, { type SWRConfiguration } from 'swr';
import { api } from './api';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  tradingMode: string;
  liveTradingEnabled: boolean;
  authMode: 'disabled' | 'session';
  checks: {
    database: { status: 'ok' | 'error'; latencyMs: number };
  };
}

export interface ProvidersResponse {
  providers: ProviderHealth[];
  timestamp: string;
}

export interface AuthStatusResponse {
  mode: 'disabled' | 'session';
  authenticated: boolean;
  user: { id: string; username: string } | null;
  csrfToken: string;
  warning: string | null;
}

export interface SystemInfoResponse {
  name: string;
  version: string;
  environment: string;
  authMode: 'disabled' | 'session';
  tradingMode: string;
  liveTradingEnabled: boolean;
  timezone: string;
  schedulerEnabled: boolean;
  providers: {
    quote: string;
    candle: string;
    news: string;
    calendar: string;
    ai: string;
  };
}

export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, (key: string) => api.get<T>(key), {
    revalidateOnFocus: false,
    ...config,
  });
}

export function useHealth() {
  return useApi<HealthResponse>('/health', { refreshInterval: 15_000 });
}

export function useProviders() {
  return useApi<ProvidersResponse>('/health/providers', { refreshInterval: 30_000 });
}

export function useAuthStatus() {
  return useApi<AuthStatusResponse>('/api/v1/auth/status');
}

export function useSystemInfo() {
  return useApi<SystemInfoResponse>('/api/v1/system/info');
}

export interface InstrumentsResponse {
  instruments: Instrument[];
  providers: { quote: ProviderInfo; candle: ProviderInfo };
  timestamp: string;
}

export interface MarketQuote extends Quote {
  cached: boolean;
}

export interface MarketQuoteError {
  instrument: InstrumentSymbol;
  code: string;
  message: string;
}

export interface QuotesResponse {
  quotes: MarketQuote[];
  errors: MarketQuoteError[];
  fetchedAt: string;
  timestamp: string;
}

export interface CandlesResponse {
  series: CandleSeries;
  cached: boolean;
  timestamp: string;
}

export function useInstruments() {
  return useApi<InstrumentsResponse>('/api/v1/instruments', {
    refreshInterval: 300_000,
  });
}

export function useMarketQuotes() {
  return useApi<QuotesResponse>('/api/v1/market/quotes', {
    refreshInterval: 15_000,
  });
}

export function useCandles(instrument: InstrumentSymbol | null, timeframe: Timeframe) {
  return useApi<CandlesResponse>(
    instrument
      ? `/api/v1/market/candles/${instrument}?timeframe=${timeframe}&limit=200`
      : null,
    { refreshInterval: 60_000 },
  );
}

export interface TasksResponse {
  tasks: Task[];
  timestamp: string;
}

export function useTasks() {
  return useApi<TasksResponse>('/api/v1/tasks', { refreshInterval: 60_000 });
}

export interface NewsResponse extends NewsFeed {
  timestamp: string;
}

export interface NewsFilters {
  instrument?: InstrumentSymbol;
  limit?: number;
}

export function useNews(filters: NewsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.instrument) params.set('instrument', filters.instrument);
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  return useApi<NewsResponse>(`/api/v1/news${query ? `?${query}` : ''}`, {
    refreshInterval: 120_000,
  });
}

export interface CalendarResponse extends CalendarFeed {
  timestamp: string;
}

export interface CalendarFilters {
  from?: string;
  to?: string;
  impact?: Impact;
  instrument?: InstrumentSymbol;
  limit?: number;
}

export function useCalendar(filters: CalendarFilters = {}) {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.impact) params.set('impact', filters.impact);
  if (filters.instrument) params.set('instrument', filters.instrument);
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  return useApi<CalendarResponse>(`/api/v1/calendar${query ? `?${query}` : ''}`, {
    refreshInterval: 300_000,
  });
}
