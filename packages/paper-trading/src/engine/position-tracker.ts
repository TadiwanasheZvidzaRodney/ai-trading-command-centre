import { v4 as uuidv4 } from 'crypto';
import Decimal from 'decimal.js';
import type { InstrumentSymbol, OrderSide } from '@atc/shared';
import type { PaperPosition, PaperOrder, ClosedTrade, ClosureResult } from '../types.js';
import { PnLCalculator } from './pnl-calculator.js';

/**
 * Position tracker: Manages open positions and converts to closed trades.
 */
export class PositionTracker {
  private positions: Map<string, PaperPosition> = new Map();
  private closedTrades: ClosedTrade[] = [];
  private pnlCalculator: PnLCalculator;

  constructor() {
    this.pnlCalculator = new PnLCalculator();
  }

  /**
   * Open a new position from a filled order.
   */
  openPosition(order: PaperOrder): PaperPosition {
    if (order.status !== 'filled' || !order.filledPrice) {
      throw new Error('Order must be filled to open position');
    }

    const id = uuidv4();
    const position: PaperPosition = {
      id,
      orderId: order.id,
      instrument: order.instrument,
      side: order.side,
      quantityLots: order.quantityLots,
      entryPrice: order.filledPrice,
      currentPrice: order.filledPrice,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      unrealizedPnL: 0,
      unrealizedPnLPct: 0,
      openedAt: order.filledAt || new Date().toISOString(),
      riskDecision: order.riskDecision || null,
    };

    this.positions.set(id, position);
    return position;
  }

  /**
   * Update position with current market price.
   */
  updatePosition(positionId: string, currentPrice: number): PaperPosition {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position not found: ${positionId}`);
    }

    const unrealizedPnL = this.pnlCalculator.calculateUnrealizedPnL(
      position.side,
      position.entryPrice,
      currentPrice,
      position.quantityLots,
    );

    const unrealizedPnLPct = this.pnlCalculator.calculateUnrealizedPnLPct(
      position.side,
      position.entryPrice,
      currentPrice,
    );

    position.currentPrice = currentPrice;
    position.unrealizedPnL = unrealizedPnL;
    position.unrealizedPnLPct = unrealizedPnLPct;

    return position;
  }

  /**
   * Close a position (convert to trade record).
   */
  closePosition(
    positionId: string,
    exitPrice: number,
    closeReason: 'stop' | 'target' | 'manual',
    timestamp: string,
    spreadAtEntry: number = 0,
    slippage: number = 0,
    commission: number = 0,
    notes: string = '',
  ): ClosureResult {
    const position = this.positions.get(positionId);
    if (!position) {
      return {
        success: false,
        reason: `Position not found: ${positionId}`,
      };
    }

    const pnlResult = this.pnlCalculator.calculateClosedTradePnL(
      position.side,
      position.entryPrice,
      exitPrice,
      position.quantityLots,
      commission,
      slippage,
    );

    const rMultiple = this.pnlCalculator.calculateRMultiple(
      position.side,
      position.entryPrice,
      exitPrice,
      position.stopLoss,
      position.quantityLots,
      commission,
      slippage,
    );

    const durationMs = new Date(timestamp).getTime() - new Date(position.openedAt).getTime();

    const closedTrade: ClosedTrade = {
      id: uuidv4(),
      orderId: position.orderId,
      instrument: position.instrument,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      quantityLots: position.quantityLots,
      grossPnL: pnlResult.grossPnL,
      netPnL: pnlResult.netPnL,
      pnLPct: pnlResult.pnLPct,
      rMultiple,
      openedAt: position.openedAt,
      closedAt: timestamp,
      durationMs: Math.max(0, durationMs),
      closeReason,
      notes,
      spreadAtEntry,
      slippage,
      commission,
      riskDecision: position.riskDecision || null,
    };

    this.closedTrades.push(closedTrade);
    this.positions.delete(positionId);

    return {
      success: true,
      closedTrade,
    };
  }

  /**
   * Get all open positions.
   */
  getOpenPositions(): PaperPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get a specific position.
   */
  getPosition(positionId: string): PaperPosition | null {
    return this.positions.get(positionId) || null;
  }

  /**
   * Get all closed trades.
   */
  getClosedTrades(): ClosedTrade[] {
    return [...this.closedTrades];
  }

  /**
   * Get closed trades for a specific date.
   */
  getClosedTradesForDate(date: string): ClosedTrade[] {
    const targetDate = new Date(date).toDateString();
    return this.closedTrades.filter((t) => new Date(t.closedAt).toDateString() === targetDate);
  }

  /**
   * Calculate total unrealized P&L across all open positions.
   */
  getTotalUnrealizedPnL(): number {
    return Array.from(this.positions.values()).reduce(
      (total, pos) => total + pos.unrealizedPnL,
      0,
    );
  }

  /**
   * Calculate total realized P&L from closed trades.
   */
  getTotalRealizedPnL(): number {
    return this.closedTrades.reduce((total, trade) => total + trade.netPnL, 0);
  }

  /**
   * Check if any position should be closed based on stop/target.
   */
  checkClosureTriggers(
    positionId: string,
    currentBid: number,
    currentAsk: number,
  ): { shouldClose: boolean; reason?: 'stop' | 'target' } {
    const position = this.positions.get(positionId);
    if (!position) {
      return { shouldClose: false };
    }

    // For long positions: stop is below entry, target is above entry
    // For short positions: stop is above entry, target is below entry

    if (position.side === 'buy') {
      // Use bid for sell checks
      if (currentBid <= position.stopLoss) {
        return { shouldClose: true, reason: 'stop' };
      }
      if (currentBid >= position.takeProfit) {
        return { shouldClose: true, reason: 'target' };
      }
    } else {
      // Use ask for buy checks
      if (currentAsk >= position.stopLoss) {
        return { shouldClose: true, reason: 'stop' };
      }
      if (currentAsk <= position.takeProfit) {
        return { shouldClose: true, reason: 'target' };
      }
    }

    return { shouldClose: false };
  }

  /**
   * Get exposure summary.
   */
  getExposure(): {
    openPositions: number;
    totalQuantityLots: number;
    totalUnrealizedPnL: number;
    instruments: Map<InstrumentSymbol, number>;
  } {
    const instruments = new Map<InstrumentSymbol, number>();

    let totalQuantity = 0;
    for (const position of this.positions.values()) {
      totalQuantity += position.quantityLots;
      instruments.set(
        position.instrument,
        (instruments.get(position.instrument) || 0) + position.quantityLots,
      );
    }

    return {
      openPositions: this.positions.size,
      totalQuantityLots: totalQuantity,
      totalUnrealizedPnL: this.getTotalUnrealizedPnL(),
      instruments,
    };
  }

  /**
   * Reset all positions and trades (for testing/reset).
   */
  reset(): void {
    this.positions.clear();
    this.closedTrades = [];
  }
}
