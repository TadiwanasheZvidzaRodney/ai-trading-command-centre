import Decimal from 'decimal.js';
import type { OrderSide } from '@atc/shared';
import type { ClosedTrade, PerformanceMetrics, PaperPosition } from '../types.js';

/**
 * P&L Calculator: Tracks profit/loss, drawdown, and performance metrics.
 * 
 * Deterministic: Same trades always produce same P&L.
 */
export class PnLCalculator {
  /**
   * Calculate unrealized P&L for an open position.
   * 
   * For buy: P&L = (Current - Entry) × Quantity
   * For sell: P&L = (Entry - Current) × Quantity
   */
  calculateUnrealizedPnL(
    side: OrderSide,
    entryPrice: number,
    currentPrice: number,
    quantityLots: number,
  ): number {
    const priceDifference = new Decimal(currentPrice).minus(entryPrice);
    const multiplier = side === 'buy' ? 1 : -1;
    const pnl = priceDifference.times(quantityLots).times(multiplier);
    return Number(pnl.toFixed(2));
  }

  /**
   * Calculate unrealized P&L percentage.
   */
  calculateUnrealizedPnLPct(
    side: OrderSide,
    entryPrice: number,
    currentPrice: number,
  ): number {
    const priceDifference = new Decimal(currentPrice).minus(entryPrice);
    const multiplier = side === 'buy' ? 1 : -1;
    const pct = priceDifference.times(multiplier).div(entryPrice).times(100);
    return Number(pct.toFixed(2));
  }

  /**
   * Calculate realized P&L for a closed trade.
   * 
   * Gross P&L = (Exit - Entry) × Quantity × Direction
   * Net P&L = Gross P&L - Commission - Slippage
   */
  calculateClosedTradePnL(
    side: OrderSide,
    entryPrice: number,
    exitPrice: number,
    quantityLots: number,
    commission: number = 0,
    slippage: number = 0,
  ): { grossPnL: number; netPnL: number; pnLPct: number } {
    const priceDifference = new Decimal(exitPrice).minus(entryPrice);
    const multiplier = side === 'buy' ? 1 : -1;
    const grossPnL = priceDifference.times(multiplier).times(quantityLots);

    const costs = new Decimal(commission).plus(slippage);
    const netPnL = grossPnL.minus(costs);

    const pnLPct = grossPnL.div(new Decimal(entryPrice).times(quantityLots)).times(100);

    return {
      grossPnL: Number(grossPnL.toFixed(2)),
      netPnL: Number(netPnL.toFixed(2)),
      pnLPct: Number(pnLPct.toFixed(2)),
    };
  }

  /**
   * Calculate R-multiple: How many risk units were won/lost.
   * 
   * R = Net P&L / Risk Amount
   * Where Risk Amount = (Entry - Stop) × Quantity
   */
  calculateRMultiple(
    side: OrderSide,
    entryPrice: number,
    exitPrice: number,
    stopPrice: number,
    quantityLots: number,
    commission: number = 0,
    slippage: number = 0,
  ): number | null {
    if (entryPrice === stopPrice) {
      return null; // Can't calculate R without a valid stop
    }

    const riskDistance = Math.abs(entryPrice - stopPrice);
    const riskAmount = new Decimal(riskDistance).times(quantityLots);

    const priceDifference = new Decimal(exitPrice).minus(entryPrice);
    const multiplier = side === 'buy' ? 1 : -1;
    const grossPnL = priceDifference.times(multiplier).times(quantityLots);

    const costs = new Decimal(commission).plus(slippage);
    const netPnL = grossPnL.minus(costs);

    const rMultiple = netPnL.div(riskAmount);
    return Number(rMultiple.toFixed(2));
  }

  /**
   * Calculate drawdown from equity curve.
   */
  calculateDrawdown(equity: number, peakEquity: number): { drawdown: number; drawdownPct: number } {
    const drawdown = Math.max(0, peakEquity - equity);
    const drawdownPct = drawdown === 0 ? 0 : (drawdown / peakEquity) * 100;

    return {
      drawdown,
      drawdownPct: Number(drawdownPct.toFixed(2)),
    };
  }

  /**
   * Calculate complete performance metrics from closed trades.
   */
  calculatePerformanceMetrics(
    closedTrades: ClosedTrade[],
    startingEquity: number,
    endingEquity: number,
  ): PerformanceMetrics {
    if (closedTrades.length === 0) {
      return {
        trades: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        winRate: 0,
        netPnl: 0,
        grossProfit: 0,
        grossLoss: 0,
        expectancy: 0,
        profitFactor: null,
        averageWin: 0,
        averageLoss: 0,
        averageR: null,
        totalR: null,
        maxDrawdown: 0,
        maxDrawdownPct: 0,
        startingEquity,
        endingEquity,
        bestTrade: null,
        worstTrade: null,
        avgWinLossRatio: null,
      };
    }

    let wins = 0;
    let losses = 0;
    let breakeven = 0;
    let grossProfit = new Decimal(0);
    let grossLoss = new Decimal(0);
    let totalR = new Decimal(0);
    let maxDrawdown = 0;

    const rMultiples: number[] = [];
    const tradeResults: number[] = [];

    for (const trade of closedTrades) {
      tradeResults.push(trade.netPnL);

      if (trade.netPnL > 0) {
        wins += 1;
        grossProfit = grossProfit.plus(trade.netPnL);
      } else if (trade.netPnL < 0) {
        losses += 1;
        grossLoss = grossLoss.plus(Math.abs(trade.netPnL));
      } else {
        breakeven += 1;
      }

      if (trade.rMultiple !== null && !isNaN(trade.rMultiple)) {
        totalR = totalR.plus(trade.rMultiple);
        rMultiples.push(trade.rMultiple);
      }
    }

    // Calculate drawdown from equity curve
    let equity = new Decimal(startingEquity);
    let peakEquity = new Decimal(startingEquity);

    for (const trade of closedTrades) {
      equity = equity.plus(trade.netPnL);
      if (equity.gt(peakEquity)) {
        peakEquity = equity;
      }

      const dd = Number(peakEquity.minus(equity).toFixed(2));
      maxDrawdown = Math.max(maxDrawdown, dd);
    }

    const netPnl = Number(grossProfit.minus(grossLoss).toFixed(2));
    const winRate = (wins / closedTrades.length) * 100;
    const profitFactor =
      grossLoss.eq(0) || wins === 0
        ? null
        : Number(grossProfit.div(grossLoss).toFixed(2));

    const averageWin =
      wins === 0 ? 0 : Number(grossProfit.div(wins).toFixed(2));
    const averageLoss =
      losses === 0 ? 0 : Number(grossLoss.div(losses).toFixed(2));
    const averageR =
      rMultiples.length === 0
        ? null
        : Number(totalR.div(rMultiples.length).toFixed(2));

    const expectancy =
      closedTrades.length === 0
        ? null
        : Number(
            new Decimal(netPnl)
              .div(closedTrades.length)
              .toFixed(2),
          );

    const bestTrade = tradeResults.length === 0 ? null : Math.max(...tradeResults);
    const worstTrade = tradeResults.length === 0 ? null : Math.min(...tradeResults);

    const avgWinLossRatio =
      averageLoss === 0 ? null : Number((averageWin / averageLoss).toFixed(2));

    const maxDrawdownPct =
      maxDrawdown === 0 ? 0 : (maxDrawdown / startingEquity) * 100;

    return {
      trades: closedTrades.length,
      wins,
      losses,
      breakeven,
      winRate: Number(winRate.toFixed(2)),
      netPnl,
      grossProfit: Number(grossProfit.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      expectancy,
      profitFactor,
      averageWin,
      averageLoss,
      averageR,
      totalR: totalR.eq(0) ? null : Number(totalR.toFixed(2)),
      maxDrawdown,
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      startingEquity,
      endingEquity,
      bestTrade,
      worstTrade,
      avgWinLossRatio,
    };
  }
}
