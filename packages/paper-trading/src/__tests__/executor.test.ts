import { describe, it, expect } from 'vitest';
import type { RiskConfig } from '@atc/shared';
import { OrderExecutor } from '../engine/order-executor.js';

const mockRiskConfig: RiskConfig = {
  accountCurrency: 'USD',
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

const pipSizes = {
  'EUR/USD': 0.0001,
  'GBP/USD': 0.0001,
  'XAU/USD': 0.01,
};

describe('OrderExecutor', () => {
  it('should initialize with valid config', () => {
    const executor = new OrderExecutor(mockRiskConfig, pipSizes);
    expect(executor).toBeDefined();
  });

  describe('Order submission', () => {
    it('should submit a market order', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const order = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      expect(order.id).toBeDefined();
      expect(order.status).toBe('pending');
      expect(order.instrument).toBe('EUR/USD');
      expect(order.side).toBe('buy');
      expect(order.quantityLots).toBe(1);
    });

    it('should generate unique IDs', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const order1 = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const order2 = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-2',
      });

      expect(order1.id).not.toBe(order2.id);
    });
  });

  describe('Order execution', () => {
    it('should execute market order at ask price for buy', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const order = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const result = executor.executeMarketOrder(order, 1.0500, 1.0501, new Date().toISOString());

      expect(result.success).toBe(true);
      expect(result.order.status).toBe('filled');
      expect(result.order.filledPrice).toBe(1.0501); // Ask for buy
    });

    it('should execute market order at bid price for sell', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const order = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'sell',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0600,
        takeProfit: 1.0350,
        idempotencyKey: 'test-1',
      });

      const result = executor.executeMarketOrder(order, 1.0500, 1.0501, new Date().toISOString());

      expect(result.success).toBe(true);
      expect(result.order.status).toBe('filled');
      expect(result.order.filledPrice).toBe(1.0500); // Bid for sell
    });

    it('should record fill time', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);
      const timestamp = '2024-01-01T12:00:00Z';

      const order = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const result = executor.executeMarketOrder(order, 1.0500, 1.0501, timestamp);

      expect(result.order.filledAt).toBe(timestamp);
    });
  });

  describe('Fill calculation', () => {
    it('should calculate realistic fill with spread', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const fill = executor.calculateFill('EUR/USD', 'buy', 1, 1.0500, 1.0501);

      expect(fill.fillPrice).toBe(1.0501);
      expect(fill.spread).toBeGreaterThan(0);
    });

    it('should include slippage in fill calculation', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const fill = executor.calculateFill('EUR/USD', 'buy', 1, 1.0500, 1.0501);

      expect(fill.slippage).toBeGreaterThanOrEqual(0);
      expect(fill.totalCost).toBeGreaterThan(0);
    });

    it('should include commission in fill calculation', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const fill = executor.calculateFill('EUR/USD', 'buy', 1, 1.0500, 1.0501);

      expect(fill.commission).toBeGreaterThan(0);
    });

    it('should scale commission with quantity', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const fill1 = executor.calculateFill('EUR/USD', 'buy', 1, 1.0500, 1.0501);
      const fill2 = executor.calculateFill('EUR/USD', 'buy', 2, 1.0500, 1.0501);

      expect(fill2.commission).toBe(fill1.commission * 2);
    });
  });

  describe('Order modification', () => {
    it('should modify pending order', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const order = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const modified = executor.modifyOrder(order, {
        takeProfit: 1.0700,
      });

      expect(modified.takeProfit).toBe(1.0700);
      expect(modified.id).toBe(order.id);
    });

    it('should throw on modify filled order', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const order = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const filled = executor.executeMarketOrder(
        order,
        1.0500,
        1.0501,
        new Date().toISOString(),
      );

      expect(() => executor.modifyOrder(filled.order, { takeProfit: 1.0700 })).toThrow();
    });
  });

  describe('Order cancellation', () => {
    it('should cancel pending order', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const order = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const cancelled = executor.cancelOrder(order);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.closedAt).toBeDefined();
    });

    it('should throw on cancel filled order', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);

      const order = executor.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const filled = executor.executeMarketOrder(
        order,
        1.0500,
        1.0501,
        new Date().toISOString(),
      );

      expect(() => executor.cancelOrder(filled.order)).toThrow();
    });
  });

  describe('Slippage configuration', () => {
    it('should set slippage', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);
      executor.setSlippage(1);

      const fill = executor.calculateFill('EUR/USD', 'buy', 1, 1.0500, 1.0501);

      expect(fill.slippage).toBeGreaterThanOrEqual(0);
    });

    it('should throw on negative slippage', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);
      expect(() => executor.setSlippage(-1)).toThrow('Slippage cannot be negative');
    });
  });

  describe('Commission configuration', () => {
    it('should set commission per lot', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);
      executor.setCommission(10);

      const fill = executor.calculateFill('EUR/USD', 'buy', 1, 1.0500, 1.0501);

      expect(fill.commission).toBe(10);
    });

    it('should throw on negative commission', () => {
      const executor = new OrderExecutor(mockRiskConfig, pipSizes);
      expect(() => executor.setCommission(-1)).toThrow('Commission cannot be negative');
    });
  });
});
