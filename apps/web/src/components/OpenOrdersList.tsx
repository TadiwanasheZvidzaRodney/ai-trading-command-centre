'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { PaperOrder } from '@/lib/hooks';

export interface OpenOrdersListProps {
  orders: PaperOrder[] | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  error?: Error | null;
}

export function OpenOrdersList({ orders, isLoading, onRefresh, error }: OpenOrdersListProps) {
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const handleCancelOrder = async (orderId: string) => {
    setCancelError(null);
    setCancelingId(orderId);

    try {
      await api.delete(`/api/v1/paper-orders/${orderId}`);
      setConfirmCancel(null);
      await onRefresh();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Open Orders</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Open Orders</h3>
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

  const pendingOrders = orders?.filter((o) => o.status === 'pending') ?? [];

  if (pendingOrders.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Open Orders</h3>
          <span className="badge">0 pending</span>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <p>No pending orders</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Open Orders</h3>
        <span className="badge">{pendingOrders.length} pending</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Entry</th>
              <th>Stop</th>
              <th>Target</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <strong>{order.instrument}</strong>
                </td>
                <td>
                  <span className={`badge ${order.side === 'buy' ? 'accent' : 'warn'}`}>
                    {order.side.toUpperCase()}
                  </span>
                </td>
                <td>{order.quantity.toFixed(4)}</td>
                <td className="mono">${order.entryPrice.toFixed(2)}</td>
                <td className="mono">${order.stopPrice.toFixed(2)}</td>
                <td className="mono">${order.targetPrice.toFixed(2)}</td>
                <td>
                  <span className="badge info">{order.status}</span>
                </td>
                <td className="table-note">
                  {new Date(order.createdAt).toLocaleTimeString()}
                </td>
                <td>
                  {confirmCancel === order.id ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => void handleCancelOrder(order.id)}
                        disabled={cancelingId === order.id}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setConfirmCancel(null)}
                        disabled={cancelingId === order.id}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setConfirmCancel(order.id)}
                      disabled={cancelingId === order.id}
                    >
                      <X size={12} /> Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cancelError && (
        <div className="card-footer">
          <div className="banner error" style={{ margin: 0 }}>
            <AlertTriangle size={14} />
            <span>{cancelError}</span>
          </div>
        </div>
      )}
    </div>
  );
}
