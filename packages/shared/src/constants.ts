import type { Instrument, InstrumentSymbol, Timeframe } from './types';

export const APP_NAME = 'AI Trading Command Centre';
export const DEFAULT_TIMEZONE = 'Africa/Harare';
export const DISCLAIMER =
  'This is analysis, not a guarantee. Markets involve risk; verify data and use your own judgement.';

export const TIMEFRAME_VALUES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1wk'] as const;
export const TIMEFRAMES: readonly Timeframe[] = TIMEFRAME_VALUES;

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1m': '1 minute',
  '5m': '5 minutes',
  '15m': '15 minutes',
  '30m': '30 minutes',
  '1h': '1 hour',
  '4h': '4 hours',
  '1d': '1 day',
  '1wk': '1 week',
};

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '1wk': 7 * 24 * 60 * 60_000,
};

/**
 * Contract specifications are application defaults, not broker-verified values.
 * They must be confirmed against the actual broker before any live use.
 */
export const INSTRUMENTS: Record<InstrumentSymbol, Instrument> = {
  'XAU/USD': {
    symbol: 'XAU/USD',
    base: 'XAU',
    quote: 'USD',
    displayName: 'Gold / US Dollar',
    kind: 'metal',
    pricePrecision: 2,
    pipSize: 0.1,
    tickSize: 0.01,
    contractSize: 100,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    quoteCurrency: 'USD',
    candleProxySymbol: 'GC=F',
    candleProxyLabel: 'COMEX gold futures (GC=F)',
    notes:
      'Contract size 100 oz is a common default. Brokers differ; verify lot size, tick value and margin before live use.',
  },
  'EUR/USD': {
    symbol: 'EUR/USD',
    base: 'EUR',
    quote: 'USD',
    displayName: 'Euro / US Dollar',
    kind: 'forex',
    pricePrecision: 5,
    pipSize: 0.0001,
    tickSize: 0.00001,
    contractSize: 100_000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    quoteCurrency: 'USD',
    notes: 'One standard lot is 100,000 EUR; P&L is in USD.',
  },
  'GBP/USD': {
    symbol: 'GBP/USD',
    base: 'GBP',
    quote: 'USD',
    displayName: 'British Pound / US Dollar',
    kind: 'forex',
    pricePrecision: 5,
    pipSize: 0.0001,
    tickSize: 0.00001,
    contractSize: 100_000,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    quoteCurrency: 'USD',
    notes: 'One standard lot is 100,000 GBP; P&L is in USD.',
  },
};

export const INSTRUMENT_VALUES = ['XAU/USD', 'EUR/USD', 'GBP/USD'] as const;
export const INSTRUMENT_SYMBOLS: readonly InstrumentSymbol[] = INSTRUMENT_VALUES;
export const INSTRUMENT_LIST: readonly Instrument[] = INSTRUMENT_VALUES.map(
  (symbol) => INSTRUMENTS[symbol],
);

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'XAU'] as const;

export const IMPACT_ORDER: Record<string, number> = {
  high: 4,
  medium: 3,
  low: 2,
  holiday: 1,
  unknown: 0,
};

export const DEFAULT_RISK_CONFIG = {
  accountCurrency: 'USD' as const,
  startingBalance: 10_000,
  riskPerTradePct: 1,
  maxDailyLossPct: 3,
  maxOpenRiskPct: 5,
  maxPositions: 3,
  minRewardRisk: 1.5,
  maxSpreadPips: {
    'XAU/USD': 35,
    'EUR/USD': 2,
    'GBP/USD': 2.5,
  },
  eventBlackoutMinutes: 30,
  killSwitch: false,
};

export function getInstrument(symbol: string): Instrument | null {
  return INSTRUMENTS[symbol as InstrumentSymbol] ?? null;
}

export function isInstrumentSymbol(value: string): value is InstrumentSymbol {
  return value in INSTRUMENTS;
}
