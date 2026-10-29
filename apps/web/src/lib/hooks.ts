'use client';

import type {
  CandleSeries,
  Instrument,
  InstrumentSymbol,
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
