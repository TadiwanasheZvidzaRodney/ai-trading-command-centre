'use client';

import type { InstrumentSymbol } from '@atc/shared';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';

const INSTRUMENTS: InstrumentSymbol[] = ['XAU/USD', 'EUR/USD', 'GBP/USD'];

export interface OrderEntryFormProps {
  accountBalance: number;
  onOrderCreated: () => Promise<void>;
}

export function OrderEntryForm({ accountBalance, onOrderCreated }: OrderEntryFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    instrument: 'XAU/USD' as InstrumentSymbol,
    side: 'buy' as 'buy' | 'sell',
    entryPrice: '',
    stopPrice: '',
    targetPrice: '',
    riskPct: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.entryPrice || !form.stopPrice || !form.targetPrice) {
      setError('Please fill in all price fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const entry = parseFloat(form.entryPrice);
      const stop = parseFloat(form.stopPrice);
      const target = parseFloat(form.targetPrice);

      // The server derives the position size from riskPct and enforces every
      // risk limit. Never send a client-calculated quantity that could bypass
      // the server-side checks.
      await api.post('/api/v1/paper-orders', {
        idempotencyKey: crypto.randomUUID(),
        instrument: form.instrument,
        side: form.side,
        type: 'market',
        entryPrice: entry,
        stopPrice: stop,
        targetPrice: target,
        riskPct: form.riskPct,
        notes: 'Quick order via paper trading dashboard',
      });

      setSuccess('Order created successfully!');
      setForm({
        instrument: 'XAU/USD',
        side: 'buy',
        entryPrice: '',
        stopPrice: '',
        targetPrice: '',
        riskPct: 1,
      });
      setExpanded(false);

      await onOrderCreated();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <div className="card">
        <div className="card-body">
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => setExpanded(true)}
          >
            + Create New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Quick Order Entry</h3>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit} className="stack gap-4">
          <div className="grid grid-2 gap-4">
            <div>
              <label className="label">Instrument</label>
              <select
                value={form.instrument}
                onChange={(e) => setForm({ ...form, instrument: e.target.value as InstrumentSymbol })}
                className="select"
                disabled={isSubmitting}
              >
                {INSTRUMENTS.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Side</label>
              <div className="segmented" role="group" aria-label="Side">
                <button
                  type="button"
                  className={`segmented-item ${form.side === 'buy' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, side: 'buy' })}
                  disabled={isSubmitting}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className={`segmented-item ${form.side === 'sell' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, side: 'sell' })}
                  disabled={isSubmitting}
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
                value={form.entryPrice}
                onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
                placeholder="Entry price"
                className="input"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="label">Stop Price</label>
              <input
                type="number"
                step="0.01"
                value={form.stopPrice}
                onChange={(e) => setForm({ ...form, stopPrice: e.target.value })}
                placeholder="Stop loss"
                className="input"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="label">Target Price</label>
              <input
                type="number"
                step="0.01"
                value={form.targetPrice}
                onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
                placeholder="Target price"
                className="input"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <div className="row-between">
                <label className="label">Risk %</label>
                <span className="label">{form.riskPct.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={form.riskPct}
                onChange={(e) => setForm({ ...form, riskPct: parseFloat(e.target.value) })}
                className="slider"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {error && (
            <div className="banner error">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="banner info">
              <span>✓ {success}</span>
            </div>
          )}

          <div className="row" style={{ gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setExpanded(false)}
              disabled={isSubmitting}
            >
              Close
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                isSubmitting ||
                !form.entryPrice ||
                !form.stopPrice ||
                !form.targetPrice
              }
            >
              {isSubmitting ? <span className="spinner" /> : null}
              Create Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
