'use client';

import type { InstrumentSymbol, Timeframe } from '@atc/shared';
import { Zap } from 'lucide-react';

export function CopilotSetup({
  instrument,
  setInstrument,
  timeframe,
  setTimeframe,
  lookback,
  setLookback,
  isGenerating,
  onGenerate,
}: {
  instrument: InstrumentSymbol;
  setInstrument: (inst: InstrumentSymbol) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  lookback: number;
  setLookback: (lb: number) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  const instruments: InstrumentSymbol[] = ['XAU/USD', 'EUR/USD', 'GBP/USD'];
  const timeframes: Timeframe[] = ['1h', '4h', '1d', '1wk'];
  const lookbackOptions = [100, 200, 500];

  return (
    <aside className="card sidebar-card">
      <div className="card-header">
        <h3 className="card-title">Analysis Setup</h3>
      </div>
      <div className="card-body">
        <div className="stack gap-4">
          <div>
            <label className="label">Instrument</label>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value as InstrumentSymbol)}
              className="select"
            >
              {instruments.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Timeframe</label>
            <div className="segmented" role="group" aria-label="Timeframe">
              {timeframes.map((tf) => (
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
              {lookbackOptions.map((lb) => (
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
            onClick={onGenerate}
            disabled={isGenerating}
            className="btn btn-primary"
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                Generating…
              </>
            ) : (
              <>
                <Zap size={16} />
                Generate Analysis
              </>
            )}
          </button>

          <div className="info-box">
            <p>
              AI Copilot analyzes your technical indicators, market structure, and detected
              patterns to generate trade ideas with reasoning and limitations.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
