'use client';

import type { PaperAccountResponse } from '@/lib/hooks';

export interface PaperAccountHeaderProps {
  account: PaperAccountResponse | null;
  isLoading: boolean;
}

export function PaperAccountHeader({ account, isLoading }: PaperAccountHeaderProps) {
  if (isLoading || !account) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Account Summary</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <span className="spinner" />
            <p>Loading account...</p>
          </div>
        </div>
      </div>
    );
  }

  const pnlClass = account.totalPnL >= 0 ? 'positive' : 'negative';
  const realizedPnLClass = account.realizedPnL >= 0 ? 'positive' : 'negative';
  const unrealizedPnLClass = account.unrealizedPnL >= 0 ? 'positive' : 'negative';

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Account Summary</h3>
        <span className="badge">Paper Trading</span>
      </div>
      <div className="card-body">
        <div className="grid grid-4 gap-3">
          <div className="stat">
            <div className="stat-label">Starting Balance</div>
            <div className="stat-value">
              ${account.startingBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Current Balance</div>
            <div className="stat-value">
              ${account.currentBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">Realized P&L</div>
            <div className={`stat-value ${realizedPnLClass}`}>
              {account.realizedPnL >= 0 ? '+' : ''}
              ${Math.abs(account.realizedPnL).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
            <div className="stat-hint">{account.realizedPnL >= 0 ? '+' : ''}{((account.realizedPnL / account.startingBalance) * 100).toFixed(2)}%</div>
          </div>

          <div className="stat">
            <div className="stat-label">Unrealized P&L</div>
            <div className={`stat-value ${unrealizedPnLClass}`}>
              {account.unrealizedPnL >= 0 ? '+' : ''}
              ${Math.abs(account.unrealizedPnL).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
            <div className="stat-hint">{account.unrealizedPnL >= 0 ? '+' : ''}{((account.unrealizedPnL / account.startingBalance) * 100).toFixed(2)}%</div>
          </div>

          <div className="stat" style={{ gridColumn: 'span 2' }}>
            <div className="stat-label">Total P&L</div>
            <div className={`stat-value ${pnlClass}`} style={{ fontSize: '24px' }}>
              {account.totalPnL >= 0 ? '+' : ''}
              ${Math.abs(account.totalPnL).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
            <div className="stat-hint">{account.accountPnLPct >= 0 ? '+' : ''}{account.accountPnLPct.toFixed(2)}% of starting balance</div>
          </div>
        </div>
      </div>
    </div>
  );
}
