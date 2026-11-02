import { describe, it, expect, beforeEach } from 'vitest';
import type { RiskConfig } from '@atc/shared';
import { PaperTradingEngine } from '../engine/index.js';

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

describe('PaperTradingEngine', () => {
  let engine: PaperTradingEngine;

  beforeEach(() => {
    engine = new PaperTradingEngine(mockRiskConfig, pipSizes);
  });

  describe('Initialization', () => {
    it('should initialize with starting balance', () => {
      const snapshot = engine.getAccountSnapshot(new Date().toISOString());
      expect(snapshot.startingBalance).toBe(10_000);
      expect(snapshot.balance).toBe(10_000);
    });

    it('should start with no open positions', () => {
      expect(engine.getOpenPositions().length).toBe(0);
    });

    it('should start with no orders', () => {
      expect(engine.getAllOrders().length).toBe(0);
    });
  });

  describe('Order submission', () => {
    it('should submit a new order', () => {
      const order = engine.submitOrder({
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
    });

    it('should handle idempotency', () => {
      const order1 = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const order2 = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      expect(order1.id).toBe(order2.id);
    });

    it('should store order', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const retrieved = engine.getOrder(order.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(order.id);
    });
  });

  describe('Order execution', () => {
    it('should execute pending order', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const result = engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());

      expect(result.success).toBe(true);
      expect(result.order.status).toBe('filled');
    });

    it('should open position on execution', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());

      const positions = engine.getOpenPositions();
      expect(positions.length).toBe(1);
    });

    it('should reject execution of non-existent order', () => {
      const result = engine.executeOrder('invalid-id', 1.0500, 1.0501, new Date().toISOString());

      expect(result.success).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('Order modification', () => {
    it('should modify pending order', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const result = engine.modifyOrder(order.id, { takeProfit: 1.0700 });

      expect(result.success).toBe(true);
      expect(result.order.takeProfit).toBe(1.0700);
    });

    it('should reject modify of filled order', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());

      const result = engine.modifyOrder(order.id, { takeProfit: 1.0700 });

      expect(result.success).toBe(false);
    });
  });

  describe('Order cancellation', () => {
    it('should cancel pending order', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const result = engine.cancelOrder(order.id);

      expect(result.success).toBe(true);
      expect(result.order.status).toBe('cancelled');
    });

    it('should reject cancel of filled order', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());

      const result = engine.cancelOrder(order.id);

      expect(result.success).toBe(false);
    });
  });

  describe('Position tracking', () => {
    it('should track open positions', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());

      const positions = engine.getOpenPositions();
      expect(positions.length).toBe(1);
      expect(positions[0].side).toBe('buy');
      expect(positions[0].entryPrice).toBe(1.0501);
    });

    it('should update position prices', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      const exec = engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());
      const positions = engine.getOpenPositions();
      const positionId = positions[0].id;

      const updated = engine.updatePosition(positionId, 1.0550);

      expect(updated?.currentPrice).toBe(1.0550);
      expect(updated?.unrealizedPnL).toBeGreaterThan(0);
    });
  });

  describe('Closure detection', () => {
    it('should detect stop hit for long position', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());
      const positions = engine.getOpenPositions();

      const result = engine.checkClosureTriggers(positions[0].id, 1.0390, 1.0395);

      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe('stop');
    });

    it('should detect target hit for long position', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());
      const positions = engine.getOpenPositions();

      const result = engine.checkClosureTriggers(positions[0].id, 1.0650, 1.0660);

      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe('target');
    });
  });

  describe('Account snapshot', () => {
    it('should provide account snapshot', () => {
      const snapshot = engine.getAccountSnapshot(new Date().toISOString());

      expect(snapshot.balance).toBe(10_000);
      expect(snapshot.equity).toBe(10_000);
      expect(snapshot.totalPnL).toBe(0);
    });

    it('should show open positions count in snapshot', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());

      const snapshot = engine.getAccountSnapshot(new Date().toISOString());
      expect(snapshot.openPositions).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset account state', () => {
      const order = engine.submitOrder({
        instrument: 'EUR/USD',
        side: 'buy',
        type: 'market',
        quantityLots: 1,
        stopLoss: 1.0400,
        takeProfit: 1.0650,
        idempotencyKey: 'test-1',
      });

      engine.executeOrder(order.id, 1.0500, 1.0501, new Date().toISOString());
      engine.reset();

      expect(engine.getAllOrders().length).toBe(0);
      expect(engine.getOpenPositions().length).toBe(0);

      const snapshot = engine.getAccountSnapshot(new Date().toISOString());
      expect(snapshot.balance).toBe(10_000);
    });

    it('should reset to custom starting balance', () => {
      engine.reset(20_000);

      const snapshot = engine.getAccountSnapshot(new Date().toISOString());
      expect(snapshot.startingBalance).toBe(20_000);
      expect(snapshot.balance).toBe(20_000);
    });
  });
});
