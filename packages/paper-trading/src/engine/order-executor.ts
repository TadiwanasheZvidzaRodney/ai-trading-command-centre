import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import type { OrderSide, RiskConfig } from '@atc/shared';
import type { PaperOrder, PaperOrderInput, OrderExecutionResult, FillResult } from '../types.js';

/**
 * Order executor for paper trading.
 * Simulates order execution with realistic fills including spread, slippage, and commission.
 */
export class OrderExecutor {
  private spreadPips: Record<string, number>;
  private slippagePips: number;
  private commissionPerLot: number;

  constructor(
    riskConfig: RiskConfig,
    private readonly pipSize: Record<string, number>,
  ) {
    this.spreadPips = riskConfig.maxSpreadPips;
    this.slippagePips = 0.5; // Default 0.5 pips slippage
    this.commissionPerLot = 5; // Default $5 per lot
  }

  /**
   * Submit a new market order.
   * Returns a pending order ready for execution.
   */
  submitOrder(input: PaperOrderInput): PaperOrder {
    return {
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      instrument: input.instrument,
      side: input.side,
      type: input.type,
      quantityLots: input.quantityLots,
      requestedPrice: input.requestedPrice || null,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      status: 'pending',
      createdAt: new Date().toISOString(),
      filledAt: null,
      filledPrice: null,
      exitPrice: null,
      closedAt: null,
      spreadAtEntry: null,
      slippage: 0,
      commission: 0,
      pnl: null,
      rMultiple: null,
      closeReason: null,
      notes: '',
      riskDecision: input.riskDecision || null,
    };
  }

  /**
   * Execute a market order immediately.
   * Applies spread, slippage, and commission realistically.
   */
  executeMarketOrder(
    order: PaperOrder,
    bid: number,
    ask: number,
    timestamp: string,
  ): { success: boolean; order: PaperOrder; result?: OrderExecutionResult } {
    if (order.type !== 'market') {
      return {
        success: false,
        order,
        result: { success: false, reason: 'Only market orders supported' },
      };
    }

    // Calculate fill price based on side
    const fillPrice = order.side === 'buy' ? ask : bid;

    // Calculate costs
    const spread = Math.abs(ask - bid);
    const slippagePips = this.slippagePips;
    const slippagePrice = new Decimal(slippagePips).times((this.pipSize[order.instrument] ?? 0.0001));
    const slippage = Number(slippagePrice.toFixed(4));

    const commission = new Decimal(order.quantityLots).times(this.commissionPerLot);

    const updatedOrder: PaperOrder = {
      ...order,
      status: 'filled',
      filledPrice: fillPrice,
      filledAt: timestamp,
      spreadAtEntry: spread,
      slippage,
      commission: Number(commission.toFixed(2)),
    };

    return {
      success: true,
      order: updatedOrder,
      result: {
        success: true,
        fillPrice,
        fillTime: timestamp,
      },
    };
  }

  /**
   * Calculate fill details (spread, slippage, commission).
   */
  calculateFill(
    instrument: string,
    side: OrderSide,
    quantityLots: number,
    bid: number,
    ask: number,
  ): FillResult {
    const fillPrice = side === 'buy' ? ask : bid;
    const spread = Math.abs(ask - bid);
    const slippage = new Decimal(this.slippagePips).times(this.pipSize[instrument] || 0.0001);
    const commission = new Decimal(quantityLots).times(this.commissionPerLot);

    return {
      fillPrice,
      spread,
      slippage: Number(slippage.toFixed(4)),
      commission: Number(commission.toFixed(2)),
      totalCost: spread + Number(slippage) + Number(commission),
    };
  }

  /**
   * Modify an existing order (pending orders only).
   */
  modifyOrder(
    order: PaperOrder,
    updates: Partial<Omit<PaperOrder, 'id' | 'status' | 'filledAt' | 'filledPrice' | 'createdAt'>>,
  ): PaperOrder {
    if (order.status !== 'pending') {
      throw new Error(`Cannot modify ${order.status} order`);
    }

    return { ...order, ...updates };
  }

  /**
   * Cancel a pending order.
   */
  cancelOrder(order: PaperOrder): PaperOrder {
    if (order.status !== 'pending') {
      throw new Error(`Cannot cancel ${order.status} order`);
    }

    return {
      ...order,
      status: 'cancelled',
      closedAt: new Date().toISOString(),
    };
  }

  /**
   * Set slippage for all orders.
   */
  setSlippage(pips: number): void {
    if (pips < 0) {
      throw new Error('Slippage cannot be negative');
    }
    this.slippagePips = pips;
  }

  /**
   * Set commission per lot.
   */
  setCommission(amountUSD: number): void {
    if (amountUSD < 0) {
      throw new Error('Commission cannot be negative');
    }
    this.commissionPerLot = amountUSD;
  }
}
