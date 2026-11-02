'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { PaperPosition } from '@/lib/hooks';

export interface OpenPositionsListProps {
  positions: PaperPosition[] | null;
  isLoading: boolean;
  onClose: () => Promise<void>;
  error?: Error | null;
}

export function OpenPositionsList({ positions, isLoading, onClose, error }: OpenPositionsListProps) {
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  const handleClosePosition = async (positionId: string) => {
    setCloseError(null);
    setClosingId(positionId);

    try {
      await api.patch(`/api/v1/paper-positions/${positionId}/close`, {
        closePrice: positions?.find((p) => p.id === positionId)?.currentPrice ?? 0,
        reason: 'manual',
      });
      setConfirmClose(null);
      await onClose();
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : 'Failed to close position');
    } finally {
      setClosingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Open Positions</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Loading positions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Open Positions</h3>
        </div>
        <div className="card-body">
          <div className="banner error">
            <AlertTriangle size={16} />
            <span>{error.message}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Open Positions</h3>
          <span className="badge">0 open</span>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <p>No open positions yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Open Positions</h3>
        <span className="badge">{positions.length} open</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Side</th>
              <th>Quantity</th>
              <th>Entry Price</th>
              <th>Current Price</th>
              <th>Unrealized P&L</th>
              <th>%</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <tr key={pos.id}>
                <td>
                  <strong>{pos.instrument}</strong>
                </td>
                <td>
                  <span className={`badge ${pos.side === 'buy' ? 'accent' : 'warn'}`}>
                    {pos.side.toUpperCase()}
                  </span>
                </td>
                <td>{pos.quantity.toFixed(4)}</td>
                <td className="mono">${pos.entryPrice.toFixed(2)}</td>
                <td className="mono">${pos.currentPrice.toFixed(2)}</td>
                <td>
                  <strong className={pos.unrealizedPnL >= 0 ? 'positive' : 'negative'}>
                    {pos.unrealizedPnL >= 0 ? '+' : '-'}$
                    {Math.abs(pos.unrealizedPnL).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </strong>
                </td>
                <td className={pos.unrealizedPnLPct >= 0 ? 'positive' : 'negative'}>
                  {pos.unrealizedPnLPct >= 0 ? '+' : ''}
                  {pos.unrealizedPnLPct.toFixed(2)}%
                </td>
                <td>
                  {confirmClose === pos.id ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => void handleClosePosition(pos.id)}
                        disabled={closingId === pos.id}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setConfirmClose(null)}
                        disabled={closingId === pos.id}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setConfirmClose(pos.id)}
                      disabled={closingId === pos.id}
                    >
                      <X size={12} /> Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {closeError && (
        <div className="card-footer">
          <div className="banner error" style={{ margin: 0 }}>
            <AlertTriangle size={14} />
            <span>{closeError}</span>
          </div>
        </div>
      )}
    </div>
  );
}
