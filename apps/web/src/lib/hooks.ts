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
import type { TechnicalIndicators, Structure, PatternDetection } from '@atc/technical-analysis';
import { useCallback, useEffect, useState } from 'react';
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

export interface TechnicalApiResponse {
  status: 'ok' | 'error';
  data: TechnicalIndicators;
  timestamp: string;
}

export type TechnicalResponse = TechnicalIndicators;

export function useTechnical(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
  lookback = 200,
) {
  const { data, error, isLoading, mutate } = useApi<TechnicalApiResponse>(
    instrument ? `/api/v1/technical/${instrument}/${timeframe}?lookback=${lookback}` : null,
    { refreshInterval: 60_000 },
  );
  
  return {
    data: data?.data ?? null,
    error,
    isLoading,
    mutate,
  };
}

export interface StructureApiResponse {
  status: 'ok' | 'error';
  data: {
    trend: Structure['trend'];
    resistance_levels: Structure['resistance_levels'];
    support_levels: Structure['support_levels'];
    swing_high: Structure['swing_high'];
    swing_low: Structure['swing_low'];
  };
  timestamp: string;
}

export interface StructureResponse {
  structure: Structure;
  instrument: string;
  timeframe: string;
  timestamp: string;
}

export function useTechnicalStructure(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
) {
  const { data, error, isLoading, mutate } = useApi<StructureApiResponse>(
    instrument ? `/api/v1/technical/${instrument}/${timeframe}/structure` : null,
    { refreshInterval: 60_000 },
  );
  
  return {
    data: data?.data ? { structure: data.data as Structure } : null,
    error,
    isLoading,
    mutate,
  };
}

export interface PatternsApiResponse {
  status: 'ok' | 'error';
  data: {
    patterns: PatternDetection[];
  };
  timestamp: string;
}

export interface PatternsResponse {
  patterns: PatternDetection[];
  instrument: string;
  timeframe: string;
  timestamp: string;
}

export function useTechnicalPatterns(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
) {
  const { data, error, isLoading, mutate } = useApi<PatternsApiResponse>(
    instrument ? `/api/v1/technical/${instrument}/${timeframe}/patterns` : null,
    { refreshInterval: 60_000 },
  );
  
  return {
    data: data?.data ?? null,
    error,
    isLoading,
    mutate,
  };
}

/* ---------- Copilot Analysis ---------- */

export interface CopilotAnalysisRequest {
  instrument: InstrumentSymbol;
  timeframe: Timeframe;
  lookback: number;
  model?: 'gemini' | 'ollama' | 'auto';
  temperature?: number;
  include_history?: boolean;
}

export interface CopilotAnalysisResponse {
  report: string; // Markdown
  model: string | null;
  model_version?: string;
  temperature: number;
  generated_at: string;
  inference_time_ms: number;
  input_hash: string;
  fallback?: boolean;
  fallback_reason?: string;
  evidence: {
    instrument: string;
    timeframe: string;
    lookback: number;
    candle_count: number;
    latest_candle_time: string;
    indicators_used: string[];
    patterns_detected: Array<{ type: string; confidence: number; candle_index: number }>;
    quote: { bid: number; ask: number; mid: number; spread: number; fetched_at: string };
    structure: {
      trend: 'uptrend' | 'downtrend' | 'range';
      trend_strength: number;
      resistance_levels: Array<{ price: number; touches: number; recent_bounce?: string }>;
      support_levels: Array<{ price: number; touches: number; recent_bounce?: string }>;
    };
    macro_events: Array<{ event: string; time: string; impact: string; hours_until: number }>;
    recent_news_themes: string[];
  };
}

export interface CopilotHistoryResponse {
  reports: Array<{
    input_hash: string;
    generated_at: string;
    model: string | null;
    summary?: string;
  }>;
}

export function useCopilotAnalysis(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
  lookback: number = 200,
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [data, setData] = useState<CopilotAnalysisResponse | null>(null);
  const [error, setError] = useState<any>(null);

  const generate = useCallback(async () => {
    if (!instrument) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.post<CopilotAnalysisResponse>(
        '/api/v1/copilot/analyze',
        {
          instrument,
          timeframe,
          lookback,
          model: 'auto',
          temperature: 0.7,
        } as CopilotAnalysisRequest,
      );
      setData(response);
    } catch (err) {
      setError(err);
    } finally {
      setIsGenerating(false);
    }
  }, [instrument, timeframe, lookback]);

  return { data, error, isGenerating, generate };
}

export function useCopilotHistory(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
  limit: number = 10,
) {
  const [data, setData] = useState<CopilotHistoryResponse | null>(null);
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!instrument) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<CopilotHistoryResponse>(
        '/api/v1/copilot/history',
        {
          instrument,
          timeframe,
          limit,
        },
      );
      setData(response);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [instrument, timeframe, limit]);

  useEffect(() => {
    void fetch();
  }, [instrument, timeframe, fetch]);

  return { data, error, isLoading, refetch: fetch };
}

/* ---------- Paper Trading ---------- */

export interface PaperAccountResponse {
  startingBalance: number;
  currentBalance: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  accountPnLPct: number;
  timestamp: string;
}

export interface PaperOrder {
  id: string;
  instrument: InstrumentSymbol;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  status: 'pending' | 'filled' | 'cancelled';
  notes?: string;
  createdAt: string;
  filledAt?: string;
}

export interface PaperPosition {
  id: string;
  orderId: string;
  instrument: InstrumentSymbol;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  openedAt: string;
}

export interface PaperTrade {
  id: string;
  instrument: InstrumentSymbol;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnL: number;
  realizedPnLPct: number;
  rMultiple: number;
  duration: string;
  notes?: string;
  openedAt: string;
  closedAt: string;
}

export interface PaperAnalyticsResponse {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxDD: number;
  totalRealizedPnL: number;
  accountBalance: number;
  timestamp: string;
}

export interface RiskLimitsResponse {
  perTradeRiskPct: number;
  dailyLossPct: number;
  maxOpenRiskPct: number;
  maxPositions: number;
  minRR: number;
  correlationThreshold: number;
}

export function usePaperAccount() {
  return useApi<PaperAccountResponse>('/api/v1/paper/account', { refreshInterval: 10_000 });
}

export function usePaperOrders(filters?: { status?: string; instrument?: InstrumentSymbol }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.instrument) params.set('instrument', filters.instrument);
  const query = params.toString();
  return useApi<{ orders: PaperOrder[]; total: number }>(
    `/api/v1/paper-orders${query ? `?${query}` : ''}`,
    { refreshInterval: 10_000 },
  );
}

export function usePaperPositions() {
  return useApi<{ positions: PaperPosition[]; total: number }>('/api/v1/paper-positions', {
    refreshInterval: 10_000,
  });
}

export function usePaperTrades(page = 0, filters?: { instrument?: InstrumentSymbol }) {
  const params = new URLSearchParams();
  params.set('limit', '20');
  params.set('offset', String(page * 20));
  if (filters?.instrument) params.set('instrument', filters.instrument);
  const query = params.toString();
  return useApi<{ trades: PaperTrade[]; total: number; limit: number; offset: number }>(
    `/api/v1/paper-trades?${query}`,
    { refreshInterval: 30_000 },
  );
}

export function usePaperAnalytics() {
  return useApi<PaperAnalyticsResponse>('/api/v1/paper-analytics', { refreshInterval: 30_000 });
}

export function useRiskLimits() {
  return useApi<RiskLimitsResponse>('/api/v1/risk/limits', { refreshInterval: 300_000 });
}
