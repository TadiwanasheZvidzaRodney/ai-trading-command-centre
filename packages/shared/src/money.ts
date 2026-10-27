import Decimal from 'decimal.js';

export { Decimal };

export type Numeric = number | string | Decimal;

export function D(value: Numeric): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function roundTo(value: Numeric, decimals: number): number {
  return D(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

/** Round down to a lot/quantity step so risk is never increased by rounding. */
export function roundDownToStep(value: Numeric, step: Numeric): number {
  const s = D(step);
  if (s.lte(0)) return 0;
  return D(value).div(s).floor().mul(s).toNumber();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pipsBetween(a: Numeric, b: Numeric, pipSize: Numeric): number {
  return D(a).minus(b).abs().div(pipSize).toNumber();
}

export function safeDivide(numerator: Numeric, denominator: Numeric, fallback = 0): number {
  const d = D(denominator);
  if (d.isZero()) return fallback;
  return D(numerator).div(d).toNumber();
}

export function sum(values: readonly Numeric[]): number {
  return values.reduce<Decimal>((acc, value) => acc.plus(D(value)), new Decimal(0)).toNumber();
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPrice(value: number | null | undefined, precision: number): string {
  return formatNumber(value, precision);
}

export function formatUsd(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatSignedUsd(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const formatted = formatUsd(Math.abs(value), decimals);
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted}`;
}

export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${formatNumber(value, decimals)}%`;
}

export function formatCompact(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: decimals,
  }).format(value);
}
