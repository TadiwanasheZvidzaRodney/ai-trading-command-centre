import type {
  BacktestTrade,
  EquityPoint,
  PerformanceMetrics,
} from '@atc/shared';

function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

export function maxDrawdownFromCurve(
  equityCurve: readonly EquityPoint[],
  startingEquity: number,
): { maxDrawdown: number; maxDrawdownPct: number } {
  let peak = startingEquity;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    const drawdown = peak - point.equity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;
    }
  }
  return {
    maxDrawdown: round(maxDrawdown),
    maxDrawdownPct: round(maxDrawdownPct),
  };
}

export function equityCurveFromTrades(
  trades: readonly BacktestTrade[],
  startingEquity: number,
): EquityPoint[] {
  let equity = startingEquity;
  const points: EquityPoint[] = [{ time: 0, equity }];
  for (const trade of trades) {
    equity += trade.pnl;
    points.push({ time: trade.exitTime, equity: round(equity) });
  }
  return points;
}

export function computeMetrics(
  trades: readonly BacktestTrade[],
  startingEquity: number,
  equityCurve?: readonly EquityPoint[],
): PerformanceMetrics {
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const breakeven = trades.filter((trade) => trade.pnl === 0);
  const grossProfit = round(wins.reduce((sum, trade) => sum + trade.pnl, 0));
  const grossLoss = round(Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0)));
  const netPnl = round(grossProfit - grossLoss);
  const rMultiples = trades.map((trade) => trade.rMultiple);
  const curve = equityCurve ?? equityCurveFromTrades(trades, startingEquity);
  const drawdown = maxDrawdownFromCurve(curve, startingEquity);

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: trades.length > 0 ? round((wins.length / trades.length) * 100) : 0,
    netPnl,
    grossProfit,
    grossLoss,
    expectancy: trades.length > 0 ? round(netPnl / trades.length) : 0,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : null,
    averageWin: wins.length > 0 ? round(grossProfit / wins.length) : 0,
    averageLoss: losses.length > 0 ? round(grossLoss / losses.length) : 0,
    averageR:
      rMultiples.length > 0
        ? round(rMultiples.reduce((sum, value) => sum + value, 0) / rMultiples.length)
        : null,
    totalR:
      rMultiples.length > 0
        ? round(rMultiples.reduce((sum, value) => sum + value, 0))
        : null,
    maxDrawdown: drawdown.maxDrawdown,
    maxDrawdownPct: drawdown.maxDrawdownPct,
    startingEquity: round(startingEquity),
    endingEquity: round(startingEquity + netPnl),
  };
}
