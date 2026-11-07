import Decimal from 'decimal.js';
import type { RiskConfig } from '@atc/shared';
import type {
  PaperOrderInput,
  PaperOrder,
  PaperPosition,
  ClosedTrade,
  PaperAccountSnapshot,
  PerformanceMetrics,
  ClosureRequest,
  ClosureResult,
} from '../types.js';
import { OrderExecutor } from './order-executor.js';
import { PositionTracker } from './position-tracker.js';
import { PnLCalculator } from './pnl-calculator.js';

/**
 * Paper Trading Engine: Main orchestrator for simulated trading.
 * 
 * Features:
 * - Order management (submit, modify, cancel, execute)
 * - Position tracking (open, update, close)
 * - P&L calculation (unrealized, realized, metrics)
 * - Account state management
 * - Trade journal
 */
export class PaperTradingEngine {
  private balance: number;
  private startingBalance: number;
  private orders: Map<string, PaperOrder> = new Map();
  private orderIdempotency: Map<string, PaperOrder> = new Map();
  private positionTracker: PositionTracker;
  private orderExecutor: OrderExecutor;
  private pnlCalculator: PnLCalculator;
  private dailyResetAt: string = '';

  constructor(
    riskConfig: RiskConfig,
    private readonly pipSize: Record<string, number>,
  ) {
    this.balance = riskConfig.startingBalance;
    this.startingBalance = riskConfig.startingBalance;
    this.positionTracker = new PositionTracker();
    this.orderExecutor = new OrderExecutor(riskConfig, pipSize);
    this.pnlCalculator = new PnLCalculator();
    this.dailyResetAt = new Date().toISOString().slice(0, 10);
  }

  /**
   * Submit a new order.
   * Returns immediately with pending status.
   */
  submitOrder(input: PaperOrderInput): PaperOrder {
    // Check idempotency
    const existing = this.orderIdempotency.get(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const order = this.orderExecutor.submitOrder(input);
    this.orders.set(order.id, order);
    this.orderIdempotency.set(input.idempotencyKey, order);

    return order;
  }

  /**
   * Execute a pending order immediately with current market prices.
   */
  executeOrder(
    orderId: string,
    bid: number,
    ask: number,
    timestamp: string,
  ): { success: boolean; order: PaperOrder; reason?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, order: {} as PaperOrder, reason: 'Order not found' };
    }

    if (order.status !== 'pending') {
      return { success: false, order, reason: `Cannot execute ${order.status} order` };
    }

    const result = this.orderExecutor.executeMarketOrder(order, bid, ask, timestamp);
    if (result.success) {
      const executedOrder = result.order;
      this.orders.set(orderId, executedOrder);

      // Auto-open position
      const position = this.positionTracker.openPosition(executedOrder);

      return {
        success: true,
        order: executedOrder,
        reason: `Position opened: ${position.id}`,
      };
    }

    return { success: false, order: result.order, reason: result.result?.reason };
  }

  /**
   * Modify a pending order.
   */
  modifyOrder(
    orderId: string,
    updates: Partial<Omit<PaperOrder, 'id' | 'status' | 'filledAt' | 'filledPrice' | 'createdAt'>>,
  ): { success: boolean; order: PaperOrder; reason?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, order: {} as PaperOrder, reason: 'Order not found' };
    }

    if (order.status !== 'pending') {
      return { success: false, order, reason: `Cannot modify ${order.status} order` };
    }

    try {
      const modified = this.orderExecutor.modifyOrder(order, updates);
      this.orders.set(orderId, modified);
      return { success: true, order: modified };
    } catch (error) {
      return {
        success: false,
        order,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel a pending order.
   */
  cancelOrder(orderId: string): { success: boolean; order: PaperOrder; reason?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, order: {} as PaperOrder, reason: 'Order not found' };
    }

    if (order.status !== 'pending') {
      return { success: false, order, reason: `Cannot cancel ${order.status} order` };
    }

    try {
      const cancelled = this.orderExecutor.cancelOrder(order);
      this.orders.set(orderId, cancelled);
      return { success: true, order: cancelled };
    } catch (error) {
      return {
        success: false,
        order,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update position with current market price.
   */
  updatePosition(positionId: string, currentPrice: number): PaperPosition | null {
    return this.positionTracker.updatePosition(positionId, currentPrice);
  }

  /**
   * Check for closure triggers (stop/target hits).
   */
  checkClosureTriggers(
    positionId: string,
    bid: number,
    ask: number,
  ): { shouldClose: boolean; reason?: 'stop' | 'target' } {
    return this.positionTracker.checkClosureTriggers(positionId, bid, ask);
  }

  /**
   * Close a position.
   */
  closePosition(request: ClosureRequest): ClosureResult {
    const result = this.positionTracker.closePosition(
      request.positionId,
      request.closePrice,
      request.reason,
      request.timestamp,
      0, // spreadAtEntry - would need to be tracked from order
      0, // slippage - would need to be tracked
      0, // commission - would need to be tracked
      request.notes,
    );

    if (result.success && result.closedTrade) {
      this.updateBalance();
    }

    return result;
  }

  /**
   * Update balance based on closed trades and unrealized P&L.
   */
  private updateBalance(): void {
    const realizedPnL = this.positionTracker.getTotalRealizedPnL();
    const unrealizedPnL = this.positionTracker.getTotalUnrealizedPnL();
    this.balance = new Decimal(this.startingBalance).plus(realizedPnL).plus(unrealizedPnL).toNumber();
  }

  /**
   * Get current account snapshot.
   */
  getAccountSnapshot(timestamp: string): PaperAccountSnapshot {
    this.updateBalance();

    const closedTrades = this.positionTracker.getClosedTrades();
    const metrics = this.pnlCalculator.calculatePerformanceMetrics(
      closedTrades,
      this.startingBalance,
      this.balance,
    );

    const realizedPnL = this.positionTracker.getTotalRealizedPnL();
    const unrealizedPnL = this.positionTracker.getTotalUnrealizedPnL();
    const totalPnL = new Decimal(realizedPnL).plus(unrealizedPnL).toNumber();
    const totalPnLPct = (totalPnL / this.startingBalance) * 100;

    // Calculate daily P&L
    const today = timestamp.slice(0, 10);
    const dailyTrades = this.positionTracker.getClosedTradesForDate(today);
    const dailyRealizedPnL = dailyTrades.reduce((sum, t) => sum + t.netPnL, 0);
    const dailyPnL = new Decimal(dailyRealizedPnL).plus(unrealizedPnL).toNumber();
    const dailyPnLPct = (dailyPnL / this.startingBalance) * 100;

    const drawdown = this.pnlCalculator.calculateDrawdown(this.balance, this.startingBalance);

    const openPositions = this.positionTracker.getOpenPositions();
    const openOrders = Array.from(this.orders.values()).filter((o) => o.status === 'pending');

    return {
      timestamp,
      equity: this.balance,
      balance: this.balance,
      startingBalance: this.startingBalance,
      totalPnL,
      totalPnLPct: Number(totalPnLPct.toFixed(2)),
      dailyPnL,
      dailyPnLPct: Number(dailyPnLPct.toFixed(2)),
      drawdown: drawdown.drawdown,
      drawdownPct: drawdown.drawdownPct,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownPct: metrics.maxDrawdownPct,
      openPositions: openPositions.length,
      openOrders: openOrders.length,
      totalTrades: metrics.trades,
      wins: metrics.wins,
      losses: metrics.losses,
      breakeven: metrics.breakeven,
      winRate: metrics.winRate,
      averageWin: metrics.averageWin,
      averageLoss: metrics.averageLoss,
      profitFactor: metrics.profitFactor,
      expectancy: metrics.expectancy,
      averageR: metrics.averageR,
      totalR: metrics.totalR,
    };
  }

  /**
   * Get all open positions.
   */
  getOpenPositions(): PaperPosition[] {
    return this.positionTracker.getOpenPositions();
  }

  /**
   * Get a specific position.
   */
  getPosition(positionId: string): PaperPosition | null {
    return this.positionTracker.getPosition(positionId);
  }

  /**
   * Get all orders.
   */
  getAllOrders(): PaperOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get pending orders.
   */
  getPendingOrders(): PaperOrder[] {
    return Array.from(this.orders.values()).filter((o) => o.status === 'pending');
  }

  /**
   * Get an order.
   */
  getOrder(orderId: string): PaperOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * Get all closed trades.
   */
  getClosedTrades(): ClosedTrade[] {
    return this.positionTracker.getClosedTrades();
  }

  /**
   * Get performance metrics.
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const closedTrades = this.positionTracker.getClosedTrades();
    return this.pnlCalculator.calculatePerformanceMetrics(
      closedTrades,
      this.startingBalance,
      this.balance,
    );
  }

  /**
   * Reset paper account to starting balance (for testing).
   */
  reset(newStartingBalance: number = this.startingBalance): void {
    this.balance = newStartingBalance;
    this.startingBalance = newStartingBalance;
    this.orders.clear();
    this.orderIdempotency.clear();
    this.positionTracker.reset();
  }
}
