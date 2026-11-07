'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { PaperTrade } from '@/lib/hooks';

export interface TradeNotesModalProps {
  tradeId: string;
  trade: PaperTrade | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function TradeNotesModal({ tradeId, trade, onClose, onSaved }: TradeNotesModalProps) {
  const [notes, setNotes] = useState(trade?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      await api.patch(`/api/v1/paper-trades/${tradeId}/notes`, { notes });
      setSuccess(true);
      await onSaved();
      setTimeout(() => onClose(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  if (!trade) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          maxWidth: '500px',
          width: '90vw',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Trade Notes</h3>
              <span className="hint">
                {trade.instrument} • {trade.side.toUpperCase()} •{' '}
                {new Date(trade.openedAt ?? trade.createdAt ?? trade.closedAt).toLocaleDateString()}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onClose}
              disabled={isSaving}
            >
              <X size={14} />
            </button>
          </div>

          <div className="card-body">
            <div className="stack gap-3">
              {/* Trade Summary */}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Entry Price</span>
                  <div style={{ marginTop: '2px', fontWeight: 600, color: 'var(--text)' }}>
                    ${trade.entryPrice.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Exit Price</span>
                  <div style={{ marginTop: '2px', fontWeight: 600, color: 'var(--text)' }}>
                    ${trade.exitPrice.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Realized P&L</span>
                  <div
                    style={{
                      marginTop: '2px',
                      fontWeight: 600,
                      color: trade.realizedPnL >= 0 ? 'var(--positive)' : 'var(--negative)',
                    }}
                  >
                    {trade.realizedPnL >= 0 ? '+' : ''}$
                    {Math.abs(trade.realizedPnL).toLocaleString('en-US', {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>R Multiple</span>
                  <div
                    style={{
                      marginTop: '2px',
                      fontWeight: 600,
                      color:
                        trade.rMultiple === null
                          ? 'var(--text-muted)'
                          : trade.rMultiple >= 0
                            ? 'var(--positive)'
                            : 'var(--negative)',
                    }}
                  >
                    {trade.rMultiple === null
                      ? '—'
                      : `${trade.rMultiple >= 0 ? '+' : ''}${trade.rMultiple.toFixed(2)}R`}
                  </div>
                </div>
              </div>

              <div className="divider" />

              {/* Notes Editor */}
              <div>
                <label className="label">Review Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSaving}
                  placeholder="What did you learn from this trade? Any patterns or improvements?"
                  className="textarea"
                  style={{ minHeight: '120px', resize: 'vertical' }}
                />
              </div>

              {error && (
                <div className="banner error">
                  <AlertTriangle size={14} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="banner info">
                  <span>✓ Notes saved successfully</span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? <span className="spinner" /> : null}
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
