import {
  INSTRUMENTS,
  type InstrumentSymbol,
  type OrderSide,
} from '@atc/shared';

export interface CostModel {
  commissionPerLot: number;
  slippagePips: number;
}

export interface FillCosts {
  lots: number;
  commission: number;
  slippage: number;
  total: number;
}

export function lotsFromUnits(instrument: InstrumentSymbol, quantityUnits: number): number {
  const spec = INSTRUMENTS[instrument];
  return quantityUnits / spec.contractSize;
}

export function unitsFromLots(instrument: InstrumentSymbol, lots: number): number {
  const spec = INSTRUMENTS[instrument];
  return lots * spec.contractSize;
}

export function priceDistanceToPips(instrument: InstrumentSymbol, distance: number): number {
  return distance / INSTRUMENTS[instrument].pipSize;
}

export function pipsToPriceDistance(instrument: InstrumentSymbol, pips: number): number {
  return pips * INSTRUMENTS[instrument].pipSize;
}

/**
 * Monetary value of one pip for one lot in USD (all supported instruments quote in USD).
 */
export function pipValuePerLot(instrument: InstrumentSymbol): number {
  const spec = INSTRUMENTS[instrument];
  return spec.contractSize * spec.pipSize;
}

export function entryFillPrice(
  side: OrderSide,
  bid: number,
  ask: number,
  slippagePips: number,
  instrument: InstrumentSymbol,
): number {
  const slippage = pipsToPriceDistance(instrument, slippagePips);
  return side === 'buy' ? ask + slippage : bid - slippage;
}

export function exitFillPrice(
  side: OrderSide,
  bid: number,
  ask: number,
  slippagePips: number,
  instrument: InstrumentSymbol,
): number {
  const slippage = pipsToPriceDistance(instrument, slippagePips);
  // Closing a long sells at bid; closing a short buys at ask.
  return side === 'buy' ? bid - slippage : ask + slippage;
}

export function calculateFillCosts(
  instrument: InstrumentSymbol,
  quantityUnits: number,
  model: CostModel,
): FillCosts {
  const lots = lotsFromUnits(instrument, quantityUnits);
  const commission = lots * model.commissionPerLot;
  const slippage = lots * model.slippagePips * pipValuePerLot(instrument);
  return {
    lots,
    commission: round(commission),
    slippage: round(slippage),
    total: round(commission + slippage),
  };
}

export interface ClosedPnl {
  grossPnL: number;
  costs: number;
  netPnL: number;
  pnlPct: number;
  rMultiple: number;
}

export function calculateClosedPnl(args: {
  instrument: InstrumentSymbol;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  quantityUnits: number;
  entryCosts: number;
  exitCosts: number;
}): ClosedPnl {
  const direction = args.side === 'buy' ? 1 : -1;
  const grossPnL = (args.exitPrice - args.entryPrice) * direction * args.quantityUnits;
  const costs = args.entryCosts + args.exitCosts;
  const netPnL = grossPnL - costs;
  const notional = args.entryPrice * args.quantityUnits;
  const pnlPct = notional > 0 ? (grossPnL / notional) * 100 : 0;

  const riskPerUnit = Math.abs(args.entryPrice - args.stopPrice);
  const riskAmount = riskPerUnit * args.quantityUnits;
  const rMultiple = riskAmount > 0 ? netPnL / riskAmount : 0;

  return {
    grossPnL: round(grossPnL),
    costs: round(costs),
    netPnL: round(netPnL),
    pnlPct: round(pnlPct),
    rMultiple: round(rMultiple),
  };
}

export function calculateUnrealizedPnl(
  side: OrderSide,
  entryPrice: number,
  currentPrice: number,
  quantityUnits: number,
): { pnl: number; pct: number } {
  const direction = side === 'buy' ? 1 : -1;
  const pnl = (currentPrice - entryPrice) * direction * quantityUnits;
  const notional = entryPrice * quantityUnits;
  return {
    pnl: round(pnl),
    pct: notional > 0 ? round((pnl / notional) * 100) : 0,
  };
}

export function calculateSpreadPips(
  instrument: InstrumentSymbol,
  bid: number | null,
  ask: number | null,
): number | null {
  if (bid === null || ask === null || !Number.isFinite(bid) || !Number.isFinite(ask)) {
    return null;
  }
  if (ask < bid) return null;
  return priceDistanceToPips(instrument, ask - bid);
}

export function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}
