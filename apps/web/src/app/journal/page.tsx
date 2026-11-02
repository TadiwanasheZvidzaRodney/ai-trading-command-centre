'use client';

import type { InstrumentSymbol } from '@atc/shared';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AnalyticsMetrics } from '@/components/AnalyticsMetrics';
import { JournalTradesTable } from '@/components/JournalTradesTable';
import { PerformanceCharts } from '@/components/PerformanceCharts';
import { usePaperAnalytics, usePaperTrades } from '@/lib/hooks';

const INSTRUMENTS: (InstrumentSymbol | 'ALL')[] = ['ALL', 'XAU/USD', 'EUR/USD', 'GBP/USD'];

export default function JournalPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentSymbol | 'ALL'>('ALL');

  const analytics = usePaperAnalytics();
  const trades = usePaperTrades(currentPage, {
    instrument: selectedInstrument === 'ALL' ? undefined : selectedInstrument,
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([analytics.mutate(), trades.mutate()]);
  }, [analytics, trades]);

  const isLoading = analytics.isLoading || trades.isLoading;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 7 · Trade Journal</span>
          <h2>Review closed trades and performance analytics.</h2>
          <p>
            Analyze your trading performance with detailed metrics, win rate, profit factor, drawdown analysis,
            and trade-by-trade review. Add notes to each trade to track lessons learned.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge">Performance metrics</span>
          <span className="badge">Trade analysis</span>
          <span className="badge">Review notes</span>
        </div>
      </section>

      {(analytics.error || trades.error) && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>{analytics.error?.message || trades.error?.message || 'Error loading data'}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', alignItems: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void handleRefresh()}
          disabled={isLoading}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Auto-refreshes every 30 seconds</span>
      </div>

      {/* Performance Metrics */}
      <AnalyticsMetrics analytics={analytics.data ?? null} isLoading={analytics.isLoading} />

      {/* Performance Charts */}
      <PerformanceCharts analytics={analytics.data ?? null} isLoading={analytics.isLoading} />

      {/* Trades Table with Filters */}
      <div style={{ marginTop: '20px' }}>
        <div className="card" style={{ marginBottom: '14px' }}>
          <div className="card-header">
            <h3 className="card-title">Filters</h3>
          </div>
          <div className="card-body">
            <div>
              <label className="label">Instrument</label>
              <div className="segmented" role="group" aria-label="Instrument">
                {INSTRUMENTS.map((inst) => (
                  <button
                    key={inst}
                    type="button"
                    className={`segmented-item ${selectedInstrument === inst ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedInstrument(inst as InstrumentSymbol | 'ALL');
                      setCurrentPage(0);
                    }}
                    disabled={isLoading}
                  >
                    {inst}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <JournalTradesTable
          trades={trades.data?.trades ?? null}
          isLoading={trades.isLoading}
          total={trades.data?.total ?? 0}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onNotesUpdated={handleRefresh}
          error={trades.error}
        />
      </div>
    </div>
  );
}
