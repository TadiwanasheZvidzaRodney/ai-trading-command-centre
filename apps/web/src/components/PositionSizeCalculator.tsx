'use client';

import type { CalculationResult } from '@/components/PlannerCalculation';

export interface PositionSizeCalculatorProps {
  calculations: CalculationResult | null;
  accountBalance: number;
  isLoading: boolean;
}

export function PositionSizeCalculator({
  calculations,
  accountBalance,
  isLoading,
}: PositionSizeCalculatorProps) {
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Position Details</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Calculating position details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!calculations) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Position Details</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <p>Position details will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  const percentageOfAccount = (calculations.cost / accountBalance) * 100;
  const remainingBalance = accountBalance - calculations.cost;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Position Details</h3>
      </div>
      <div className="card-body stack gap-4">
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '10px' }}>
            ACCOUNT ALLOCATION
          </div>
          <div className="stack gap-3">
            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Total Account Balance</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--text)' }}>
                  ${accountBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Position Entry Cost</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--accent)' }}>
                  ${calculations.cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {percentageOfAccount.toFixed(1)}% of account
              </div>
            </div>

            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Remaining Balance</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--positive)' }}>
                  ${remainingBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {((remainingBalance / accountBalance) * 100).toFixed(1)}% available
              </div>
            </div>
          </div>
        </div>

        <div className="divider" style={{ margin: '12px 0' }} />

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '10px' }}>
            RISK-REWARD SUMMARY
          </div>
          <div className="stack gap-3">
            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Risk (Loss at Stop)</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--negative)' }}>
                  -${calculations.maxLoss.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Reward (Gain at Target)</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--positive)' }}>
                  +${calculations.potentialReward.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>R:R Multiple</span>
                <strong
                  style={{
                    fontSize: '12.5px',
                    color:
                      calculations.rrRatio >= 2
                        ? 'var(--positive)'
                        : calculations.rrRatio >= 1.5
                          ? 'var(--warning)'
                          : 'var(--negative)',
                  }}
                >
                  {calculations.rrRatio.toFixed(2)}:1
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {calculations.potentialReward.toFixed(2)} / {calculations.maxLoss.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="divider" style={{ margin: '12px 0' }} />

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '10px' }}>
            POSITION SIZING
          </div>
          <div className="stack gap-3">
            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Quantity (Units)</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--text)' }}>
                  {calculations.quantity.toFixed(4)}
                </strong>
              </div>
            </div>

            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Contracts</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--text)' }}>
                  {calculations.contracts.toFixed(2)}
                </strong>
              </div>
            </div>

            <div>
              <div className="row-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Leverage</span>
                <strong style={{ fontSize: '12.5px', color: 'var(--accent)' }}>
                  {calculations.leverage.toFixed(2)}x
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Entry cost to balance ratio
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
