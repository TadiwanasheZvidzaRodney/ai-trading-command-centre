'use client';

import type { InstrumentSymbol } from '@atc/shared';

export interface CalculationResult {
  quantity: number;
  contracts: number;
  cost: number;
  maxLoss: number;
  leverage: number;
  potentialReward: number;
  rrRatio: number;
}

export interface PlannerCalculationProps {
  calculations: CalculationResult | null;
  isLoading: boolean;
  error?: string | null;
  instrument?: InstrumentSymbol;
}

function getRRColor(ratio: number): string {
  if (ratio < 1.5) return 'negative';
  if (ratio < 2.0) return 'warning';
  return 'positive';
}

function getRRLabel(ratio: number): string {
  if (ratio < 1.5) return 'Poor';
  if (ratio < 2.0) return 'Fair';
  return 'Good';
}

export function PlannerCalculation({ calculations, isLoading, error, instrument }: PlannerCalculationProps) {
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Live Calculations</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Calculating...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Live Calculations</h3>
        </div>
        <div className="card-body">
          <div className="banner error">
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!calculations) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Live Calculations</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <p>Fill in parameters above to see calculations</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Live Calculations</h3>
        {instrument && <span className="badge accent">{instrument}</span>}
      </div>
      <div className="card-body">
        <div className="grid grid-2 gap-3">
          <div className="stat">
            <div className="stat-label">Position Size</div>
            <div className="stat-value">{calculations.quantity.toFixed(2)}</div>
            <div className="stat-hint">
              {calculations.contracts.toFixed(2)} contracts
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Entry Cost</div>
            <div className="stat-value">${calculations.cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            <div className="stat-hint">Required capital</div>
          </div>

          <div className="stat">
            <div className="stat-label">Max Loss</div>
            <div className="stat-value negative">
              ${calculations.maxLoss.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
            <div className="stat-hint">At stop loss</div>
          </div>

          <div className="stat">
            <div className="stat-label">Potential Reward</div>
            <div className="stat-value positive">
              ${calculations.potentialReward.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
            <div className="stat-hint">At target price</div>
          </div>

          <div className="stat">
            <div className="stat-label">Leverage</div>
            <div className="stat-value">{calculations.leverage.toFixed(2)}x</div>
            <div className="stat-hint">Entry price / account balance</div>
          </div>

          <div className="stat">
            <div className="stat-label">Risk-to-Reward</div>
            <div className={`stat-value ${getRRColor(calculations.rrRatio)}`}>
              {calculations.rrRatio.toFixed(2)}:1
            </div>
            <div className="stat-hint">{getRRLabel(calculations.rrRatio)} R:R ratio</div>
          </div>
        </div>
      </div>
    </div>
  );
}
