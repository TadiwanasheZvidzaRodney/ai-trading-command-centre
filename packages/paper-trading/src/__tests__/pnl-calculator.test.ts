import { describe, it, expect } from 'vitest';
import { PnLCalculator } from '../engine/pnl-calculator.js';

describe('PnLCalculator', () => {
  const calculator = new PnLCalculator();

  describe('Unrealized P&L', () => {
    it('should calculate unrealized P&L for buy position', () => {
      const pnl = calculator.calculateUnrealizedPnL('buy', 1.0500, 1.0550, 1);
      expect(pnl).toBeGreaterThan(0);
    });

    it('should calculate unrealized loss for buy position', () => {
      const pnl = calculator.calculateUnrealizedPnL('buy', 1.0500, 1.0450, 1);
      expect(pnl).toBeLessThan(0);
    });

    it('should calculate unrealized P&L for sell position', () => {
      const pnl = calculator.calculateUnrealizedPnL('sell', 1.0500, 1.0450, 1);
      expect(pnl).toBeGreaterThan(0);
    });

    it('should calculate unrealized loss for sell position', () => {
      const pnl = calculator.calculateUnrealizedPnL('sell', 1.0500, 1.0550, 1);
      expect(pnl).toBeLessThan(0);
    });

    it('should scale P&L with quantity', () => {
      const pnl1 = calculator.calculateUnrealizedPnL('buy', 1.0500, 1.0550, 1);
      const pnl2 = calculator.calculateUnrealizedPnL('buy', 1.0500, 1.0550, 2);

      expect(pnl2).toBe(pnl1 * 2);
    });

    it('should return zero for entry price', () => {
      const pnl = calculator.calculateUnrealizedPnL('buy', 1.0500, 1.0500, 1);
      expect(pnl).toBe(0);
    });
  });

  describe('Unrealized P&L percentage', () => {
    it('should calculate positive P&L percentage for buy', () => {
      const pct = calculator.calculateUnrealizedPnLPct('buy', 1.0500, 1.0550);
      expect(pct).toBeGreaterThan(0);
    });

    it('should calculate negative P&L percentage for buy', () => {
      const pct = calculator.calculateUnrealizedPnLPct('buy', 1.0500, 1.0450);
      expect(pct).toBeLessThan(0);
    });

    it('should calculate positive P&L percentage for sell', () => {
      const pct = calculator.calculateUnrealizedPnLPct('sell', 1.0500, 1.0450);
      expect(pct).toBeGreaterThan(0);
    });

    it('should return zero for entry price', () => {
      const pct = calculator.calculateUnrealizedPnLPct('buy', 1.0500, 1.0500);
      expect(pct).toBe(0);
    });
  });

  describe('Realized P&L', () => {
    it('should calculate gross P&L for buy', () => {
      const result = calculator.calculateClosedTradePnL('buy', 1.0500, 1.0600, 1);
      expect(result.grossPnL).toBeGreaterThan(0);
      expect(result.netPnL).toEqual(result.grossPnL); // No costs
    });

    it('should calculate gross P&L for sell', () => {
      const result = calculator.calculateClosedTradePnL('sell', 1.0500, 1.0400, 1);
      expect(result.grossPnL).toBeGreaterThan(0);
    });

    it('should deduct commission and slippage from net P&L', () => {
      const gross = calculator.calculateClosedTradePnL('buy', 1.0500, 1.0600, 1);
      const withCosts = calculator.calculateClosedTradePnL('buy', 1.0500, 1.0600, 1, 10, 5);

      expect(withCosts.netPnL).toBeLessThan(gross.netPnL);
      expect(gross.netPnL - withCosts.netPnL).toBe(15); // 10 + 5
    });

    it('should calculate correct P&L percentage', () => {
      const result = calculator.calculateClosedTradePnL('buy', 1.0500, 1.0550, 1);
      expect(result.pnLPct).toBeGreaterThan(0);
      expect(result.pnLPct).toBeLessThan(1);
    });
  });

  describe('R-multiple', () => {
    it('should calculate R-multiple for winning trade', () => {
      const rMultiple = calculator.calculateRMultiple(
        'buy',
        1.0500, // entry
        1.0600, // exit
        1.0400, // stop (100 pips risk)
        1, // qty
      );

      expect(rMultiple).not.toBeNull();
      expect(rMultiple! * 100).toBeGreaterThan(0); // Should be positive
    });

    it('should calculate R-multiple for losing trade', () => {
      const rMultiple = calculator.calculateRMultiple(
        'buy',
        1.0500, // entry
        1.0450, // exit (losing)
        1.0400, // stop (100 pips risk)
        1, // qty
      );

      expect(rMultiple).not.toBeNull();
      expect(rMultiple! * 100).toBeGreaterThan(0); // Loss of 50 pips / 100 pips risk = -0.5R
    });

    it('should return null when stop equals entry', () => {
      const rMultiple = calculator.calculateRMultiple('buy', 1.0500, 1.0600, 1.0500, 1);
      expect(rMultiple).toBeNull();
    });
  });

  describe('Drawdown calculation', () => {
    it('should calculate zero drawdown at peak', () => {
      const { drawdown, drawdownPct } = calculator.calculateDrawdown(10000, 10000);
      expect(drawdown).toBe(0);
      expect(drawdownPct).toBe(0);
    });

    it('should calculate drawdown below peak', () => {
      const { drawdown, drawdownPct } = calculator.calculateDrawdown(9000, 10000);
      expect(drawdown).toBe(1000);
      expect(drawdownPct).toBe(10);
    });

    it('should calculate percentage correctly', () => {
      const { drawdownPct } = calculator.calculateDrawdown(8000, 10000);
      expect(drawdownPct).toBe(20);
    });
  });

  describe('Performance metrics', () => {
    it('should return zero metrics for empty trades', () => {
      const metrics = calculator.calculatePerformanceMetrics([], 10000, 10000);

      expect(metrics.trades).toBe(0);
      expect(metrics.wins).toBe(0);
      expect(metrics.losses).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.netPnl).toBe(0);
    });

    it('should calculate metrics from single winning trade', () => {
      const trades = [
        {
          id: '1',
          orderId: '1',
          instrument: 'EUR/USD' as const,
          side: 'buy' as const,
          entryPrice: 1.0500,
          exitPrice: 1.0600,
          quantityLots: 1,
          grossPnL: 100,
          netPnL: 90,
          pnLPct: 1.0,
          rMultiple: 1.0,
          openedAt: '2024-01-01T00:00:00Z',
          closedAt: '2024-01-01T01:00:00Z',
          durationMs: 3600000,
          closeReason: 'target' as const,
          notes: '',
          spreadAtEntry: 2,
          slippage: 4,
          commission: 4,
          riskDecision: null,
        },
      ];

      const metrics = calculator.calculatePerformanceMetrics(trades, 10000, 10090);

      expect(metrics.trades).toBe(1);
      expect(metrics.wins).toBe(1);
      expect(metrics.losses).toBe(0);
      expect(metrics.winRate).toBe(100);
      expect(metrics.netPnl).toBe(90);
      expect(metrics.profitFactor).toBeNull(); // No losses
    });

    it('should calculate win rate correctly', () => {
      const trades = [
        {
          id: '1',
          orderId: '1',
          instrument: 'EUR/USD' as const,
          side: 'buy' as const,
          entryPrice: 1.0500,
          exitPrice: 1.0600,
          quantityLots: 1,
          grossPnL: 100,
          netPnL: 100,
          pnLPct: 1.0,
          rMultiple: 1.0,
          openedAt: '2024-01-01T00:00:00Z',
          closedAt: '2024-01-01T01:00:00Z',
          durationMs: 3600000,
          closeReason: 'target' as const,
          notes: '',
          spreadAtEntry: 0,
          slippage: 0,
          commission: 0,
          riskDecision: null,
        },
        {
          id: '2',
          orderId: '2',
          instrument: 'EUR/USD' as const,
          side: 'sell' as const,
          entryPrice: 1.0500,
          exitPrice: 1.0450,
          quantityLots: 1,
          grossPnL: -100,
          netPnL: -100,
          pnLPct: -1.0,
          rMultiple: -1.0,
          openedAt: '2024-01-01T02:00:00Z',
          closedAt: '2024-01-01T03:00:00Z',
          durationMs: 3600000,
          closeReason: 'stop' as const,
          notes: '',
          spreadAtEntry: 0,
          slippage: 0,
          commission: 0,
          riskDecision: null,
        },
      ];

      const metrics = calculator.calculatePerformanceMetrics(trades, 10000, 10000);

      expect(metrics.trades).toBe(2);
      expect(metrics.wins).toBe(1);
      expect(metrics.losses).toBe(1);
      expect(metrics.winRate).toBe(50);
    });

    it('should calculate profit factor', () => {
      const trades = [
        {
          id: '1',
          orderId: '1',
          instrument: 'EUR/USD' as const,
          side: 'buy' as const,
          entryPrice: 1.0500,
          exitPrice: 1.0600,
          quantityLots: 1,
          grossPnL: 200,
          netPnL: 200,
          pnLPct: 2.0,
          rMultiple: 2.0,
          openedAt: '2024-01-01T00:00:00Z',
          closedAt: '2024-01-01T01:00:00Z',
          durationMs: 3600000,
          closeReason: 'target' as const,
          notes: '',
          spreadAtEntry: 0,
          slippage: 0,
          commission: 0,
          riskDecision: null,
        },
        {
          id: '2',
          orderId: '2',
          instrument: 'EUR/USD' as const,
          side: 'sell' as const,
          entryPrice: 1.0500,
          exitPrice: 1.0450,
          quantityLots: 1,
          grossPnL: -100,
          netPnL: -100,
          pnLPct: -1.0,
          rMultiple: -1.0,
          openedAt: '2024-01-01T02:00:00Z',
          closedAt: '2024-01-01T03:00:00Z',
          durationMs: 3600000,
          closeReason: 'stop' as const,
          notes: '',
          spreadAtEntry: 0,
          slippage: 0,
          commission: 0,
          riskDecision: null,
        },
      ];

      const metrics = calculator.calculatePerformanceMetrics(trades, 10000, 10100);

      expect(metrics.profitFactor).toBe(2); // 200 / 100
    });
  });

  describe('Determinism', () => {
    it('should produce consistent results', () => {
      const result1 = calculator.calculateUnrealizedPnL('buy', 1.0500, 1.0550, 1);
      const result2 = calculator.calculateUnrealizedPnL('buy', 1.0500, 1.0550, 1);

      expect(result1).toBe(result2);
    });
  });
});
