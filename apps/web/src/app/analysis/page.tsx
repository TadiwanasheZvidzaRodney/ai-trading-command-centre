'use client';

import type { InstrumentSymbol, Timeframe } from '@atc/shared';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ChartWithIndicators } from '@/components/ChartWithIndicators';
import { PatternsPanel } from '@/components/PatternsPanel';
import { StructurePanel } from '@/components/StructurePanel';
import { TechnicalIndicatorsLegend } from '@/components/TechnicalIndicatorsLegend';
import {
  useCandles,
  useInstruments,
  useTechnical,
  useTechnicalPatterns,
  useTechnicalStructure,
} from '@/lib/hooks';
import { getTrendBadgeClass } from './utils';

const TIMEFRAMES: readonly Timeframe[] = ['1h', '4h', '1d', '1wk'];
const LOOKBACK_OPTIONS = [100, 200, 500];

export default function AnalysisPage() {
  const [selected, setSelected] = useState<InstrumentSymbol>('XAU/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [lookback, setLookback] = useState(200);
  const [activeTab, setActiveTab] = useState<'chart' | 'structure' | 'patterns'>('chart');

  // Fetch data
  const instruments = useInstruments();
  const candles = useCandles(selected, timeframe);
  const technical = useTechnical(selected, timeframe, lookback);
  const structure = useTechnicalStructure(selected, timeframe);
  const patterns = useTechnicalPatterns(selected, timeframe);

  const instrumentList = instruments.data?.instruments ?? [];
  const selectedInstrument = instrumentList.find((i) => i.symbol === selected);
  const precision = selectedInstrument?.pricePrecision ?? 2;
  const tickSize = selectedInstrument?.tickSize ?? 0.01;

  const isLoading =
    candles.isLoading || technical.isLoading || structure.isLoading || patterns.isLoading;
  const error = candles.error || technical.error || structure.error || patterns.error;

  const handleRefresh = () => {
    void candles.mutate();
    void technical.mutate();
    void structure.mutate();
    void patterns.mutate();
  };

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 5 · Technical Analysis</span>
          <h2>Multi-timeframe technical analysis with indicators and patterns.</h2>
          <p>
            Real-time chart overlays with SMA 20/50, EMA 9, RSI, MACD, ATR, Bollinger Bands and
            Stochastic indicators. View market structure, support/resistance levels, and detected
            candlestick patterns.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge">Live indicators</span>
          <span className="badge">Pattern detection</span>
          <span className="badge">60s auto-refresh</span>
        </div>
      </section>

      <div className="workspace">
        {/* Sidebar */}
        <aside className="card sidebar-card">
          <div className="card-header">
            <h3 className="card-title">Analysis Setup</h3>
          </div>
          <div className="card-body">
            <div className="stack gap-4">
              <div>
                <label className="label">Instrument</label>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value as InstrumentSymbol)}
                  className="select"
                >
                  {instrumentList.map((instrument) => (
                    <option key={instrument.symbol} value={instrument.symbol}>
                      {instrument.symbol} · {instrument.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Timeframe</label>
                <div className="segmented" role="group" aria-label="Timeframe">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      className={`segmented-item ${tf === timeframe ? 'active' : ''}`}
                      onClick={() => setTimeframe(tf)}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Lookback Candles</label>
                <div className="segmented" role="group" aria-label="Lookback">
                  {LOOKBACK_OPTIONS.map((lb) => (
                    <button
                      key={lb}
                      type="button"
                      className={`segmented-item ${lb === lookback ? 'active' : ''}`}
                      onClick={() => setLookback(lb)}
                    >
                      {lb}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                className="btn btn-secondary"
                disabled={isLoading}
              >
                <RefreshCw size={14} />
                Refresh
              </button>

              <div className="divider" />

              {technical.data && <TechnicalIndicatorsLegend data={technical.data} />}
            </div>
          </div>
        </aside>

        {/* Main Area */}
        <div className="workspace-main">
          {error && (
            <div className="banner error">
              <AlertTriangle size={16} />
              <span>{error.message}</span>
            </div>
          )}

          {isLoading && !technical.data && (
            <div className="banner info">
              <span className="spinner" /> Loading technical analysis…
            </div>
          )}

          {/* Tabs */}
          <div className="tabs-card">
            <div className="tabs-header">
              <button
                type="button"
                className={`tab-button ${activeTab === 'chart' ? 'active' : ''}`}
                onClick={() => setActiveTab('chart')}
              >
                Chart
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === 'structure' ? 'active' : ''}`}
                onClick={() => setActiveTab('structure')}
              >
                Structure
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === 'patterns' ? 'active' : ''}`}
                onClick={() => setActiveTab('patterns')}
              >
                Patterns
              </button>
            </div>

            <div className="tabs-content">
              {activeTab === 'chart' && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">
                        {selectedInstrument?.displayName ?? selected}
                      </h3>
                      <span className="hint">
                        {selected} · {timeframe} · {lookback} candles
                      </span>
                    </div>
                    {technical.data && (
                      <span className="badge">
                        Last update: {new Date(technical.data.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="card-body">
                    {candles.data && technical.data ? (
                      <ChartWithIndicators
                        series={candles.data.series}
                        technical={technical.data as unknown as any}
                        pricePrecision={precision}
                        tickSize={tickSize}
                      />
                    ) : (
                      <div className="empty-state">
                        <h3>No chart data</h3>
                        <p>Loading technical indicators…</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'structure' && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">Market Structure</h3>
                      <span className="hint">Trend, levels, swings</span>
                    </div>
                    {structure.data && (
                      <span
                        className={`badge ${getTrendBadgeClass(structure.data.structure.trend.direction)}`}
                      >
                        {structure.data.structure.trend.direction === 'up'
                          ? '↑ Uptrend'
                          : structure.data.structure.trend.direction === 'down'
                            ? '↓ Downtrend'
                            : '→ Flat'}
                      </span>
                    )}
                  </div>
                  <div className="card-body">
                    <StructurePanel structure={structure.data?.structure as unknown as any ?? null} />
                  </div>
                </div>
              )}

              {activeTab === 'patterns' && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">Candlestick Patterns</h3>
                      <span className="hint">Detected patterns by confidence</span>
                    </div>
                    {patterns.data && (
                      <span className="badge">{patterns.data.patterns.length} patterns</span>
                    )}
                  </div>
                  <div className="card-body">
                    <PatternsPanel patterns={patterns.data?.patterns ?? null} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
