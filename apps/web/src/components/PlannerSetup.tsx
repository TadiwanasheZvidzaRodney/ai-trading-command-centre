'use client';

import type { InstrumentSymbol } from '@atc/shared';
import { useState } from 'react';

const INSTRUMENTS: InstrumentSymbol[] = ['XAU/USD', 'EUR/USD', 'GBP/USD'];

export interface TradeParams {
  instrument: InstrumentSymbol;
  side: 'buy' | 'sell';
  entryPrice: number | '';
  stopPrice: number | '';
  targetPrice: number | '';
  riskPct: number;
}

export interface PlannerSetupProps {
  isLoading: boolean;
  onParamsChange: (params: TradeParams) => void;
  onSubmit: (params: TradeParams) => Promise<void>;
}

export function PlannerSetup({ isLoading, onParamsChange, onSubmit }: PlannerSetupProps) {
  const [params, setParams] = useState<TradeParams>({
    instrument: 'XAU/USD',
    side: 'buy',
    entryPrice: '',
    stopPrice: '',
    targetPrice: '',
    riskPct: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    key: keyof TradeParams,
    value: TradeParams[keyof TradeParams],
  ) => {
    const updated = { ...params, [key]: value };
    setParams(updated);
    onParamsChange(updated);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!params.entryPrice || !params.stopPrice || !params.targetPrice) {
      setError('Please fill in all price fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Trade Parameters</h3>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit} className="stack gap-4">
          <div>
            <label className="label">Instrument</label>
            <select
              value={params.instrument}
              onChange={(e) => handleChange('instrument', e.target.value as InstrumentSymbol)}
              className="select"
              disabled={isLoading || isSubmitting}
            >
              {INSTRUMENTS.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Position Side</label>
            <div className="segmented" role="group" aria-label="Side">
              <button
                type="button"
                className={`segmented-item ${params.side === 'buy' ? 'active' : ''}`}
                onClick={() => handleChange('side', 'buy')}
                disabled={isLoading || isSubmitting}
              >
                Buy
              </button>
              <button
                type="button"
                className={`segmented-item ${params.side === 'sell' ? 'active' : ''}`}
                onClick={() => handleChange('side', 'sell')}
                disabled={isLoading || isSubmitting}
              >
                Sell
              </button>
            </div>
          </div>

          <div>
            <label className="label">Entry Price</label>
            <input
              type="number"
              step="0.01"
              value={params.entryPrice}
              onChange={(e) => handleChange('entryPrice', e.target.value ? parseFloat(e.target.value) : '')}
              placeholder="Enter entry price"
              className="input"
              disabled={isLoading || isSubmitting}
            />
          </div>

          <div>
            <label className="label">Stop Loss Price</label>
            <input
              type="number"
              step="0.01"
              value={params.stopPrice}
              onChange={(e) => handleChange('stopPrice', e.target.value ? parseFloat(e.target.value) : '')}
              placeholder="Enter stop price"
              className="input"
              disabled={isLoading || isSubmitting}
            />
          </div>

          <div>
            <label className="label">Target Price</label>
            <input
              type="number"
              step="0.01"
              value={params.targetPrice}
              onChange={(e) => handleChange('targetPrice', e.target.value ? parseFloat(e.target.value) : '')}
              placeholder="Enter target price"
              className="input"
              disabled={isLoading || isSubmitting}
            />
          </div>

          <div>
            <div className="row-between">
              <label className="label">Risk Percentage</label>
              <span className="label">{params.riskPct.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.5"
              value={params.riskPct}
              onChange={(e) => handleChange('riskPct', parseFloat(e.target.value))}
              className="slider"
              disabled={isLoading || isSubmitting}
            />
          </div>

          {error && (
            <div className="banner error">
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || isSubmitting || !params.entryPrice || !params.stopPrice || !params.targetPrice}
          >
            {isSubmitting ? <span className="spinner" /> : null}
            Create Plan
          </button>
        </form>
      </div>
    </div>
  );
}
