'use client';

import type { InstrumentSymbol, Timeframe } from '@atc/shared';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { AIAnalysisReport } from '@/components/AIAnalysisReport';
import { CopilotSetup } from '@/components/CopilotSetup';
import { TradeIdeasHighlight } from '@/components/TradeIdeasHighlight';
import { useCopilotAnalysis, useCopilotHistory } from '@/lib/hooks';

export default function CopilotPage() {
  const [instrument, setInstrument] = useState<InstrumentSymbol>('EUR/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [lookback, setLookback] = useState(200);

  const analysis = useCopilotAnalysis(instrument, timeframe, lookback);
  const history = useCopilotHistory(instrument, timeframe, 5);

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 6 · AI Copilot</span>
          <h2>AI-powered technical analysis and trade idea generation.</h2>
          <p>
            Synthesize technical indicators, market structure, patterns, and macro events into
            actionable insights. Always includes limitations and assumptions.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge">AI-assisted</span>
          <span className="badge">Research only</span>
          <span className="badge">No execution</span>
        </div>
      </section>

      <div className="workspace">
        {/* Sidebar */}
        <aside className="sidebar">
          <CopilotSetup
            instrument={instrument}
            setInstrument={setInstrument}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            lookback={lookback}
            setLookback={setLookback}
            isGenerating={analysis.isGenerating}
            onGenerate={analysis.generate}
          />
        </aside>

        {/* Main Area */}
        <div className="workspace-main">
          {analysis.error && (
            <div className="banner error">
              <AlertTriangle size={16} />
              <span>{(analysis.error as any).message || 'Failed to generate analysis'}</span>
              <button onClick={() => analysis.generate()} className="btn-link">
                Retry
              </button>
            </div>
          )}

          {analysis.isGenerating && !analysis.data && (
            <div className="banner info">
              <span className="spinner" />
              Generating AI analysis (this may take a moment)…
            </div>
          )}

          {analysis.data && (
            <>
              <AIAnalysisReport
                report={analysis.data}
                fallback={analysis.data.fallback}
                fallbackReason={analysis.data.fallback_reason}
                inferenceTimeMs={analysis.data.inference_time_ms}
              />

              <TradeIdeasHighlight report={analysis.data} />

              <div className="evidence-panel card">
                <div className="card-header">
                  <h3 className="card-title">Evidence Bundle</h3>
                </div>
                <div className="card-body">
                  <div className="evidence-grid">
                    <div>
                      <span className="label">Candles Analyzed:</span>
                      <span className="value">{analysis.data.evidence.candle_count}</span>
                    </div>
                    <div>
                      <span className="label">Indicators Used:</span>
                      <span className="value">{analysis.data.evidence.indicators_used.length}</span>
                    </div>
                    <div>
                      <span className="label">Patterns Detected:</span>
                      <span className="value">
                        {analysis.data.evidence.patterns_detected.length}
                      </span>
                    </div>
                    <div>
                      <span className="label">Current Trend:</span>
                      <span className="value capitalize">{analysis.data.evidence.structure.trend}</span>
                    </div>
                    <div>
                      <span className="label">Trend Strength:</span>
                      <span className="value">
                        {(analysis.data.evidence.structure.trend_strength * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="label">Latest Candle:</span>
                      <time className="value">
                        {new Date(analysis.data.evidence.latest_candle_time).toLocaleTimeString()}
                      </time>
                    </div>
                  </div>

                  <div className="divider" />

                  <div className="evidence-subsection">
                    <h4>Support Levels</h4>
                    <ul>
                      {analysis.data.evidence.structure.support_levels.map((level, idx) => (
                        <li key={idx}>
                          {level.price.toFixed(5)} ({level.touches} touches)
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="evidence-subsection">
                    <h4>Resistance Levels</h4>
                    <ul>
                      {analysis.data.evidence.structure.resistance_levels.map((level, idx) => (
                        <li key={idx}>
                          {level.price.toFixed(5)} ({level.touches} touches)
                        </li>
                      ))}
                    </ul>
                  </div>

                  {analysis.data.evidence.macro_events.length > 0 && (
                    <div className="evidence-subsection">
                      <h4>Upcoming Macro Events</h4>
                      <ul>
                        {analysis.data.evidence.macro_events.map((event, idx) => (
                          <li key={idx}>
                            {event.event} ({event.hours_until}h) - {event.impact}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.data.evidence.recent_news_themes.length > 0 && (
                    <div className="evidence-subsection">
                      <h4>Recent News Themes</h4>
                      <ul>
                        {analysis.data.evidence.recent_news_themes.map((theme, idx) => (
                          <li key={idx}>{theme}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {history.data && history.data.reports.length > 0 && (
                <div className="history-panel card">
                  <div className="card-header">
                    <h3 className="card-title">Recent Analyses</h3>
                  </div>
                  <div className="card-body">
                    <ul className="history-list">
                      {history.data.reports.map((report, idx) => (
                        <li key={idx} className="history-item">
                          <time>{new Date(report.generated_at).toLocaleTimeString()}</time>
                          <span className="model-badge">{report.model || 'Fallback'}</span>
                          {report.summary && <p>{report.summary}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}

          {!analysis.data && !analysis.isGenerating && (
            <div className="empty-state card">
              <div className="empty-icon">⚡</div>
              <h3 className="card-title">Ready to analyze</h3>
              <p>Select an instrument and timeframe, then click "Generate Analysis" to start.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
