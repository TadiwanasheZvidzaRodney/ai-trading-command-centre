'use client';

import { AlertTriangle, Edit2 } from 'lucide-react';
import { useState } from 'react';
import type { PaperTrade } from '@/lib/hooks';
import { TradeNotesModal } from '@/components/TradeNotesModal';

export interface JournalTradesTableProps {
  trades: PaperTrade[] | null;
  isLoading: boolean;
  total: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onNotesUpdated: () => Promise<void>;
  error?: Error | null;
}

export function JournalTradesTable({
  trades,
  isLoading,
  total,
  currentPage,
  onPageChange,
  onNotesUpdated,
  error,
}: JournalTradesTableProps) {
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Closed Trades</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Loading trades...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Closed Trades</h3>
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

  if (!trades || trades.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Closed Trades</h3>
          <span className="badge">0 closed</span>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <p>No closed trades yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Closed Trades</h3>
          <span className="badge">{total} total</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Side</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Qty</th>
                <th>Duration</th>
                <th>Realized P&L</th>
                <th>%</th>
                <th>R Multiple</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td>
                    <strong>{trade.instrument}</strong>
                  </td>
                  <td>
                    <span className={`badge ${trade.side === 'buy' ? 'accent' : 'warn'}`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="mono">${trade.entryPrice.toFixed(2)}</td>
                  <td className="mono">${trade.exitPrice.toFixed(2)}</td>
                  <td>{trade.quantity.toFixed(4)}</td>
                  <td className="table-note">{trade.duration ?? '—'}</td>
                  <td>
                    <strong className={trade.realizedPnL >= 0 ? 'positive' : 'negative'}>
                      {trade.realizedPnL >= 0 ? '+' : '-'}$
                      {Math.abs(trade.realizedPnL).toLocaleString('en-US', {
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </td>
                  <td className={(trade.realizedPnLPct ?? 0) >= 0 ? 'positive' : 'negative'}>
                    {(trade.realizedPnLPct ?? 0) >= 0 ? '+' : ''}
                    {(trade.realizedPnLPct ?? 0).toFixed(2)}%
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        trade.rMultiple === null
                          ? 'info'
                          : trade.rMultiple > 0
                            ? 'ok'
                            : trade.rMultiple > -0.5
                              ? 'warn'
                              : 'error'
                      }`}
                    >
                      {trade.rMultiple === null
                        ? '—'
                        : `${trade.rMultiple >= 0 ? '+' : ''}${trade.rMultiple.toFixed(2)}R`}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setSelectedTradeId(trade.id)}
                      title={trade.notes || 'Add notes'}
                    >
                      <Edit2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="card-footer">
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 0}
              >
                ← Prev
              </button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedTradeId && (
        <TradeNotesModal
          tradeId={selectedTradeId}
          trade={trades.find((t) => t.id === selectedTradeId) || null}
          onClose={() => setSelectedTradeId(null)}
          onSaved={onNotesUpdated}
        />
      )}
    </>
  );
}
