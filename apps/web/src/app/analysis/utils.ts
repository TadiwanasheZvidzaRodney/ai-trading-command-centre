/**
 * Utility functions for technical analysis page
 */

import type { Trend } from '@atc/technical-analysis';

export function getTrendBadgeClass(direction: Trend['direction']): string {
  switch (direction) {
    case 'up':
      return 'ok';
    case 'down':
      return 'error';
    case 'flat':
      return 'info';
    default:
      return 'info';
  }
}

export function getIndicatorBadgeClass(value: number, type: 'rsi' | 'stochastic'): string {
  if (type === 'rsi') {
    if (value > 70) return 'error'; // overbought
    if (value < 30) return 'ok'; // oversold
    return 'info';
  }
  if (type === 'stochastic') {
    if (value > 80) return 'error'; // overbought
    if (value < 20) return 'ok'; // oversold
    return 'info';
  }
  return 'info';
}
