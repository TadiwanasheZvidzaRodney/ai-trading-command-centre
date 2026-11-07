'use client';

import type { BacktestTrade, InstrumentSymbol, PerformanceMetrics, Timeframe } from '@atc/shared';
import { AlertTriangle, FlaskConical, RefreshCw, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  useBacktestRun,
  useBacktestRuns,
  useBacktestStrategies,
  type BacktestRunDetail,
  type BacktestRunRequest,
  type BacktestVerdict,
} from '@/lib/hooks';

const INSTRUMENTS: InstrumentSymbol[] = ['XAU/USD', 'EUR/USD', 'GBP/USD'];
const TIMEFRAMES: Timeframe[] = ['1h', '4h', '1d'];

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addYears(value: Date, years: number): Date {
  const next = new Date(value);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}

const VERDICT_COPY: Record<BacktestVerdict, { label: string; tone: string; detail: string }> = {
  'insufficient-evidence': {
    label: 'Insufficient out-of-sample evidence',
    tone: 'warn',
    detail:
      'There are too few out-of-sample trades to judge this strategy. Do not treat in-sample results as proof of an edge.',
  },
  'out-of-sample-profitable': {
    label: 'Positive out-of-sample result',
    tone: 'ok',
    detail:
      'Net out-of-sample P&L is positive. This is evidence, not a guarantee; forward-test before risking capital.',
  },
  'out-of-sample-not-profitable': {
    label: 'Not profitable out-of-sample',
    tone: 'error',
    detail:
      'Net out-of-sample P&L is not positive. Do not trade this configuration on the strength of in-sample results.',
  },
};

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={
          tone === 'positive'
            ? { color: 'var(--positive)' }
            : tone === 'negative'
              ? { color: 'var(--negative)' }
              : undefined
        }
      >
        {value}
      </div>
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <div className="grid grid-4">
      <Metric label="Trades" value={String(metrics.trades)} />
      <Metric
        label="Net P&L"
        value={money(metrics.netPnl)}
        tone={metrics.netPnl >= 0 ? 'positive' : 'negative'}
      />
      <Metric label="Win rate" value={`${metrics.winRate.toFixed(1)}%`} />
      <Metric
        label="Profit factor"
        value={metrics.profitFactor === null ? '—' : metrics.profitFactor.toFixed(2)}
      />
      <Metric label="Expectancy" value={money(metrics.expectancy)} />
      <Metric
        label="Average R"
        value={metrics.averageR === null ? '—' : `${metrics.averageR.toFixed(2)}R`}
      />
      <Metric
        label="Max drawdown"
        value={`${money(metrics.maxDrawdown)} (${metrics.maxDrawdownPct.toFixed(1)}%)`}
        tone="negative"
      />
      <Metric label="Ending equity" value={money(metrics.endingEquity)} />
    </div>
  );
}

function SplitTable({ run }: { run: BacktestRunDetail }) {
  const rows = [
    { key: 'Development', range: run.split.development, metrics: run.splitMetrics.development },
    { key: 'Validation', range: run.split.validation, metrics: run.splitMetrics.validation },
    { key: 'Out of sample', range: run.split.outOfSample, metrics: run.splitMetrics.outOfSample },
  ];

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Split</th>
            <th>Period</th>
            <th>Trades</th>
            <th>Win rate</th>
            <th>Net P&L</th>
            <th>Profit factor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <strong>{row.key}</strong>
              </td>
              <td className="table-note">
                {new Date(row.range.from).toLocaleDateString()} →{' '}
                {new Date(row.range.to).toLocaleDateString()}
              </td>
              <td>{row.metrics.trades}</td>
              <td>{row.metrics.trades > 0 ? `${row.metrics.winRate.toFixed(1)}%` : '—'}</td>
              <td className={row.metrics.netPnl >= 0 ? 'positive' : 'negative'}>
                {money(row.metrics.netPnl)}
              </td>
              <td>{row.metrics.profitFactor === null ? '—' : row.metrics.profitFactor.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradesTable({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0) {
    return (
      <div className="empty-state">
        <p>No trades were generated in this period.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Side</th>
            <th>Entry</th>
            <th>Exit</th>
            <th>Lots</th>
            <th>P&L</th>
            <th>R</th>
            <th>Costs</th>
            <th>Exit reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, index) => (
            <tr key={trade.id}>
              <td className="table-note">{index + 1}</td>
              <td>
                <span className={`badge ${trade.side === 'buy' ? 'accent' : 'warn'}`}>
                  {trade.side.toUpperCase()}
                </span>
              </td>
              <td className="mono">{trade.entryPrice.toFixed(4)}</td>
              <td className="mono">{trade.exitPrice.toFixed(4)}</td>
              <td>{trade.quantityLots}</td>
              <td className={trade.pnl >= 0 ? 'positive' : 'negative'}>{money(trade.pnl)}</td>
              <td>{trade.rMultiple.toFixed(2)}R</td>
              <td>{money(trade.costs)}</td>
              <td className="table-note">{trade.exitReason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquitySparkline({ run }: { run: BacktestRunDetail }) {
  const path = useMemo(() => {
    const points = run.equityCurve;
    if (points.length < 2) return null;
    const values = points.map((point) => point.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const width = 640;
    const height = 160;
    const step = width / (points.length - 1);
    return points
      .map((point, index) => {
        const x = index * step;
        const y = height - ((point.equity - min) / span) * height;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [run.equityCurve]);

  if (!path) {
    return (
      <div className="empty-state">
        <p>Not enough equity points to plot a curve.</p>
      </div>
    );
  }

  const positive = run.metrics.netPnl >= 0;

  return (
    <svg
      viewBox="0 0 640 160"
      role="img"
      aria-label="Backtest equity curve"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <path
        d={`${path} L640,160 L0,160 Z`}
        fill={positive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)'}
      />
      <path
        d={path}
        fill="none"
        stroke={positive ? 'var(--positive)' : 'var(--negative)'}
        strokeWidth="2"
      />
    </svg>
  );
}

const DEFAULTS = {
  instrument: 'XAU/USD' as InstrumentSymbol,
  timeframe: '1d' as Timeframe,
  from: isoDate(addYears(new Date(), -1)),
  to: isoDate(new Date()),
  strategyId: 'ema-trend',
  initialEquity: 10_000,
  riskPerTradePct: 1,
  spreadPips: 2,
  commissionPerLot: 7,
  slippagePips: 0.2,
  maxHoldBars: 20,
};

export default function BacktestsPage() {
  const strategies = useBacktestStrategies();
  const runs = useBacktestRuns();
  const [form, setForm] = useState(DEFAULTS);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedRun = useBacktestRun(selectedRunId);
  const activeRun = selectedRun.data ?? null;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleRun = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsRunning(true);
    setSubmitError(null);

    const request: BacktestRunRequest = {
      ...form,
      from: new Date(`${form.from}T00:00:00.000Z`).toISOString(),
      to: new Date(`${form.to}T23:59:59.999Z`).toISOString(),
    };

    try {
      const result = await api.post<BacktestRunDetail>('/api/v1/backtests', request);
      setSelectedRunId(result.runId);
      await runs.mutate();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Backtest failed');
    } finally {
      setIsRunning(false);
    }
  };

  const verdict = activeRun ? VERDICT_COPY[activeRun.verdict] : null;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 8 · Backtesting</span>
          <h2>Test a strategy before trusting it.</h2>
          <p>
            Event-driven evaluation with next-bar entries, spread, commission and slippage costs,
            and a development/validation/out-of-sample split. No strategy is called profitable
            without out-of-sample evidence.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge">No look-ahead</span>
          <span className="badge">Reproducible</span>
          <span className="badge">Cost-aware</span>
        </div>
      </section>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <FlaskConical size={16} /> Run configuration
            </h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleRun} className="stack gap-4">
              <div className="grid grid-2">
                <div>
                  <label className="label">Instrument</label>
                  <select
                    className="select"
                    value={form.instrument}
                    onChange={(event) => set('instrument', event.target.value as InstrumentSymbol)}
                    disabled={isRunning}
                  >
                    {INSTRUMENTS.map((instrument) => (
                      <option key={instrument} value={instrument}>
                        {instrument}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Timeframe</label>
                  <select
                    className="select"
                    value={form.timeframe}
                    onChange={(event) => set('timeframe', event.target.value as Timeframe)}
                    disabled={isRunning}
                  >
                    {TIMEFRAMES.map((timeframe) => (
                      <option key={timeframe} value={timeframe}>
                        {timeframe}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">From</label>
                  <input
                    className="input"
                    type="date"
                    value={form.from}
                    onChange={(event) => set('from', event.target.value)}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">To</label>
                  <input
                    className="input"
                    type="date"
                    value={form.to}
                    onChange={(event) => set('to', event.target.value)}
                    disabled={isRunning}
                  />
                </div>
              </div>

              <div>
                <label className="label">Strategy</label>
                <select
                  className="select"
                  value={form.strategyId}
                  onChange={(event) => set('strategyId', event.target.value)}
                  disabled={isRunning}
                >
                  {(strategies.data?.strategies ?? [{ id: form.strategyId, name: form.strategyId, description: '', warmupBars: 0 }]).map(
                    (strategy) => (
                      <option key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </option>
                    ),
                  )}
                </select>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '6px' }}>
                  {strategies.data?.strategies.find((item) => item.id === form.strategyId)?.description ??
                    'Built-in strategy.'}
                </p>
              </div>

              <div className="grid grid-2">
                <div>
                  <label className="label">Initial equity (USD)</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.initialEquity}
                    onChange={(event) => set('initialEquity', Number(event.target.value))}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">Risk per trade (%)</label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    max="10"
                    step="0.1"
                    value={form.riskPerTradePct}
                    onChange={(event) => set('riskPerTradePct', Number(event.target.value))}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">Spread (pips)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.spreadPips}
                    onChange={(event) => set('spreadPips', Number(event.target.value))}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">Commission per lot</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.commissionPerLot}
                    onChange={(event) => set('commissionPerLot', Number(event.target.value))}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">Slippage (pips)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.slippagePips}
                    onChange={(event) => set('slippagePips', Number(event.target.value))}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="label">Max hold (bars)</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    value={form.maxHoldBars}
                    onChange={(event) => set('maxHoldBars', Number(event.target.value))}
                    disabled={isRunning}
                  />
                </div>
              </div>

              {submitError && (
                <div className="banner error">
                  <AlertTriangle size={16} />
                  <span>{submitError}</span>
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={isRunning}>
                {isRunning ? 'Running backtest…' : 'Run backtest'}
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent runs</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void runs.mutate()}
              disabled={runs.isLoading}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <div className="card-body">
            {runs.isLoading && <div className="empty-state"><span className="spinner" /><p>Loading runs…</p></div>}
            {runs.error && (
              <div className="banner error">
                <AlertTriangle size={16} />
                <span>{runs.error.message}</span>
              </div>
            )}
            {!runs.isLoading && (runs.data?.runs.length ?? 0) === 0 && (
              <div className="empty-state">
                <p>No stored runs yet. Configure a backtest and run it.</p>
              </div>
            )}
            <div className="stack gap-2">
              {(runs.data?.runs ?? []).map((run) => (
                <button
                  key={run.runId}
                  type="button"
                  className={`run-row ${selectedRunId === run.runId ? 'active' : ''}`}
                  onClick={() => setSelectedRunId(run.runId)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background:
                      selectedRunId === run.runId ? 'var(--surface-raised)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div className="row-between">
                    <strong>{run.strategy.name}</strong>
                    <span className={`badge ${run.verdict === 'out-of-sample-profitable' ? 'ok' : run.verdict === 'out-of-sample-not-profitable' ? 'error' : 'warn'}`}>
                      {money(run.metrics.netPnl)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    {run.config.instrument} · {run.config.timeframe} · {run.metrics.trades} trades ·{' '}
                    {new Date(run.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeRun && verdict && (
        <div className="stack gap-4" style={{ marginTop: '20px' }}>
          <div className={`banner ${verdict.tone === 'ok' ? 'info' : verdict.tone === 'error' ? 'error' : 'warning'}`}>
            <ShieldCheck size={16} />
            <div>
              <strong>{verdict.label}.</strong> {verdict.detail}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                {activeRun.strategy.name} · {activeRun.config.instrument} · {activeRun.config.timeframe}
              </h3>
              <span className="badge">Hash {activeRun.inputHash.slice(0, 12)}…</span>
            </div>
            <div className="card-body">
              <MetricsGrid metrics={activeRun.metrics} />
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '10px' }}>
                {activeRun.candleCount} candles · {activeRun.metrics.trades} trades · created{' '}
                {new Date(activeRun.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {activeRun.warnings.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Warnings</h3>
              </div>
              <div className="card-body">
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                  {activeRun.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Development / validation / out-of-sample</h3>
            </div>
            <div className="card-body">
              <SplitTable run={activeRun} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Equity curve</h3>
            </div>
            <div className="card-body">
              <EquitySparkline run={activeRun} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Trades</h3>
            </div>
            <div className="card-body">
              <TradesTable trades={activeRun.trades} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
