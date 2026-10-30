/**
 * Formatting utilities for technical indicators
 */

import type { Trend } from '@atc/technical-analysis';

export function formatIndicator(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(decimals);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(2)}%`;
}

export function formatTrend(trend: Trend['direction']): string {
  switch (trend) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'flat':
      return '→';
    default:
      return '—';
  }
}

export function getTrendLabel(direction: Trend['direction']): string {
  switch (direction) {
    case 'up':
      return 'Uptrend';
    case 'down':
      return 'Downtrend';
    case 'flat':
      return 'Flat';
    default:
      return 'Unknown';
  }
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getTrendColor(direction: Trend['direction']): string {
  switch (direction) {
    case 'up':
      return '#34d399';
    case 'down':
      return '#f87171';
    case 'flat':
      return '#60a5fa';
    default:
      return '#8b9aab';
  }
}

export function getIndicatorColor(value: number, min: number, max: number): string {
  if (value > max * 0.8) return '#34d399'; // positive/bullish
  if (value < min * 1.2) return '#f87171'; // negative/bearish
  return '#fbbf24'; // neutral/warning
}
