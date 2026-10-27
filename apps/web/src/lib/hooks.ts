'use client';

import type { ProviderHealth } from '@atc/shared';
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
