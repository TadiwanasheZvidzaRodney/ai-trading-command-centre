'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { RiskLimitsResponse } from '@/lib/hooks';

export interface ValidationResult {
  valid: boolean;
  reason: string;
  violations: string[];
  suggestions: string[];
}

export interface RiskSummaryProps {
  validation: ValidationResult | null;
  limits: RiskLimitsResponse | null;
  isLoading: boolean;
}

export function RiskSummary({ validation, limits, isLoading }: RiskSummaryProps) {
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Risk Limits</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Loading risk configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Risk Limits & Validation</h3>
      </div>
      <div className="card-body stack gap-4">
        {validation && (
          <div>
            <div className="row-between" style={{ marginBottom: '10px' }}>
              <span className="label">Trade Validation</span>
              {validation.valid ? (
                <span className="badge ok">
                  <CheckCircle size={12} /> Valid
                </span>
              ) : (
                <span className="badge error">
                  <AlertTriangle size={12} /> Invalid
                </span>
              )}
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              {validation.reason}
            </p>

            {validation.violations.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <strong style={{ fontSize: '11.5px', color: 'var(--negative)' }}>Violations:</strong>
                <ul style={{ marginTop: '6px', paddingLeft: '18px', fontSize: '12px', color: 'var(--negative)' }}>
                  {validation.violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.suggestions.length > 0 && (
              <div>
                <strong style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Suggestions:</strong>
                <ul style={{ marginTop: '6px', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {validation.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {limits && (
          <div>
            <div className="divider" style={{ margin: '12px 0' }} />
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '10px' }}>
              RISK CONFIGURATION
            </div>
            <div className="grid grid-2 gap-3">
              <div style={{ fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Per-trade risk:</span>
                <span style={{ color: 'var(--text)', marginLeft: '8px', fontWeight: 600 }}>
                  {limits.perTradeRiskPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Daily loss limit:</span>
                <span style={{ color: 'var(--text)', marginLeft: '8px', fontWeight: 600 }}>
                  {limits.dailyLossPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Max open risk:</span>
                <span style={{ color: 'var(--text)', marginLeft: '8px', fontWeight: 600 }}>
                  {limits.maxOpenRiskPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Max positions:</span>
                <span style={{ color: 'var(--text)', marginLeft: '8px', fontWeight: 600 }}>
                  {limits.maxPositions}
                </span>
              </div>
              <div style={{ fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Min R:R ratio:</span>
                <span style={{ color: 'var(--text)', marginLeft: '8px', fontWeight: 600 }}>
                  {limits.minRR.toFixed(2)}:1
                </span>
              </div>
              <div style={{ fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Correlation threshold:</span>
                <span style={{ color: 'var(--text)', marginLeft: '8px', fontWeight: 600 }}>
                  {limits.correlationThreshold.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
