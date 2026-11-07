'use client';

import { AlertTriangle } from 'lucide-react';
import { useCallback, useState } from 'react';
import { PlannerCalculation } from '@/components/PlannerCalculation';
import { PlannerSetup, type TradeParams } from '@/components/PlannerSetup';
import { PositionSizeCalculator } from '@/components/PositionSizeCalculator';
import { RiskSummary } from '@/components/RiskSummary';
import { api } from '@/lib/api';
import {
  usePaperAccount,
  usePaperPositions,
  useRiskLimits,
} from '@/lib/hooks';

interface CalculationResult {
  quantity: number;
  contracts: number;
  cost: number;
  maxLoss: number;
  leverage: number;
  potentialReward: number;
  rrRatio: number;
}

interface ValidationResult {
  valid: boolean;
  reason: string;
  code?: string | null;
  violations: string[];
  suggestions: string[];
  checks?: Array<{ id: string; ok: boolean; detail: string }>;
}

export default function PlannerPage() {
  const account = usePaperAccount();
  const positions = usePaperPositions();
  const limits = useRiskLimits();

  const [params, setParams] = useState<TradeParams | null>(null);
  const [calculations, setCalculations] = useState<CalculationResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const accountBalance = account.data?.currentBalance ?? 10000;
  const openPositions = positions.data?.positions ?? [];
  const dailyPnL = account.data?.dailyPnL ?? 0;

  // Calculate when params change
  const handleParamsChange = useCallback(
    (newParams: TradeParams) => {
      setParams(newParams);
      setCalculationError(null);
      setSuccessMessage(null);

      if (
        typeof newParams.entryPrice !== 'number' ||
        typeof newParams.stopPrice !== 'number' ||
        typeof newParams.targetPrice !== 'number'
      ) {
        setCalculations(null);
        setValidation(null);
        return;
      }

      // Calculate position size
      const entry = newParams.entryPrice;
      const stop = newParams.stopPrice;
      const target = newParams.targetPrice;

      const riskAmount = accountBalance * (newParams.riskPct / 100);
      const riskPerUnit = Math.abs(entry - stop);

      if (riskPerUnit <= 0) {
        setCalculationError('Entry and stop prices must be different');
        return;
      }

      const quantity = riskAmount / riskPerUnit;
      const cost = entry * quantity;
      const maxLoss = riskPerUnit * quantity;
      const leverage = cost / accountBalance;
      const potentialReward = Math.abs(target - entry) * quantity;
      const rrRatio = potentialReward / maxLoss;

      setCalculations({
        quantity,
        contracts: quantity,
        cost,
        maxLoss,
        leverage,
        potentialReward,
        rrRatio,
      });

      // Validate plan
      setIsCalculating(true);
      const validatePlan = async () => {
        try {
          const result = await api.post<ValidationResult>('/api/v1/risk/validate-plan', {
            instrument: newParams.instrument,
            side: newParams.side,
            entryPrice: entry,
            stopPrice: stop,
            targetPrice: target,
            quantity,
            accountBalance,
            currentPositions: openPositions.map((position) => ({
              instrument: position.instrument,
              side: position.side,
              quantity: position.quantity,
              entryPrice: position.entryPrice,
              stopPrice: position.stopPrice,
            })),
            dailyLossUSD: dailyPnL,
          });
          setValidation(result);
        } catch (err) {
          setCalculationError(err instanceof Error ? err.message : 'Failed to validate plan');
        } finally {
          setIsCalculating(false);
        }
      };

      void validatePlan();
    },
    [accountBalance, openPositions, dailyPnL],
  );

  const handleSubmit = useCallback(
    async (submitParams: TradeParams) => {
      setSubmitError(null);
      setSuccessMessage(null);
      setIsSubmitting(true);

      try {
        const entry = Number(submitParams.entryPrice);
        const stop = Number(submitParams.stopPrice);
        const target = Number(submitParams.targetPrice);

        const response = await api.post<{ orderId: string }>(
          '/api/v1/paper-orders',
          {
            idempotencyKey: crypto.randomUUID(),
            instrument: submitParams.instrument,
            side: submitParams.side,
            type: 'market',
            entryPrice: entry,
            stopPrice: stop,
            targetPrice: target,
            riskPct: submitParams.riskPct,
            notes: `Trade plan created with ${submitParams.riskPct}% risk`,
          },
        );

        setSuccessMessage(`Order created successfully! Order ID: ${response.orderId}`);
        setParams(null);
        setCalculations(null);
        setValidation(null);

        // Refresh account and orders
        void account.mutate();
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to create order');
      } finally {
        setIsSubmitting(false);
      }
    },
    [accountBalance, account],
  );

  // isLoading is determined by individual component loading states

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 7 · Trade Planner</span>
          <h2>Plan trades with deterministic risk calculations.</h2>
          <p>
            Enter your entry, stop, and target prices. The system calculates optimal position size,
            risk-to-reward ratio, and validates against risk limits. All calculations are deterministic
            and server-side verified.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge">Position sizing</span>
          <span className="badge">Risk validation</span>
          <span className="badge">Live calculations</span>
        </div>
      </section>

      {successMessage && (
        <div className="banner info">
          <span>✓ {successMessage}</span>
        </div>
      )}

      {submitError && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>{submitError}</span>
        </div>
      )}

      {account.error && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>Failed to load account: {account.error.message}</span>
        </div>
      )}

      <div className="workspace">
        {/* Sidebar - Setup */}
        <aside className="card sidebar-card">
          <PlannerSetup
            isLoading={isSubmitting}
            onParamsChange={handleParamsChange}
            onSubmit={handleSubmit}
          />
        </aside>

        {/* Main Area - Calculations & Validation */}
        <div className="workspace-main">
          <div className="grid grid-2 gap-4">
            <PlannerCalculation
              calculations={calculations}
              isLoading={isCalculating}
              error={calculationError}
              instrument={params?.instrument}
            />

            <RiskSummary
              validation={validation}
              limits={limits.data ?? null}
              isLoading={isCalculating}
            />
          </div>

          {calculations && (
            <PositionSizeCalculator
              calculations={calculations}
              accountBalance={accountBalance}
              isLoading={isCalculating}
            />
          )}
        </div>
      </div>
    </div>
  );
}
