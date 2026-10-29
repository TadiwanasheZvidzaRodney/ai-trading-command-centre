'use client';

import {
  summarizeCandles,
  type CandleSeries,
  type DataQuality,
  type Instrument,
  type InstrumentSymbol,
  type MarketSummary,
  type Timeframe,
} from '@atc/shared';
import {
  AlertTriangle,
  Clock,
  Database,
  Gauge,
  LineChart,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PriceChart } from '@/components/PriceChart';
import { ProviderTable } from '@/components/ProviderTable';
import {
  useCandles,
  useInstruments,
  useMarketQuotes,
  useProviders,
  type MarketQuote,
  type MarketQuoteError,
} from '@/lib/hooks';

const TIMEFRAMES: readonly Timeframe[] = ['1h', '4h', '1d', '1wk'];

const QUALITY_CLASS: Record<DataQuality, string> = {
  live: 'ok',
  delayed: 'info',
  reference: 'warn',
  proxy: 'proxy',
};

const QUALITY_LABEL: Record<DataQuality, string> = {
  live: 'Live',
  delayed: 'Delayed',
  reference: 'Reference',
  proxy: 'Proxy',
};

const TREND_LABEL: Record<MarketSummary['trend'], string> = {
  uptrend: 'Uptrend',
  downtrend: 'Downtrend',
  range: 'Range',
  unknown: 'Insufficient data',
};

function formatPrice(value: number | null | undefined, precision: number): string {
  return value === null || value === undefined ? '—' : value.toFixed(precision);
}

function formatCompact(value: number | null | undefined, maxDecimals = 5): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(maxDecimals).replace(/\.?0+$/, '');
}

function formatUtc(iso: string | null | undefined, withDate = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    ...(withDate ? { day: '2-digit', month: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)} UTC`;
}

function formatCandleTime(time: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(time));
}

function Watchlist({
  instruments,
  quotes,
  errors,
  selected,
  onSelect,
  loading,
}: {
  instruments: Instrument[];
  quotes: Map<InstrumentSymbol, MarketQuote>;
  errors: Map<InstrumentSymbol, MarketQuoteError>;
  selected: InstrumentSymbol;
  onSelect: (instrument: InstrumentSymbol) => void;
  loading: boolean;
}) {
  return (
    <div className="watchlist">
      {instruments.map((instrument) => {
        const quote = quotes.get(instrument.symbol);
        const error = errors.get(instrument.symbol);
        return (
          <button
            key={instrument.symbol}
            type="button"
            className={`watch-row ${instrument.symbol === selected ? 'active' : ''}`}
            onClick={() => onSelect(instrument.symbol)}
          >
            <div className="watch-head">
              <span className="watch-symbol mono">{instrument.symbol}</span>
              <span className="watch-name">{instrument.displayName}</span>
            </div>
            {error ? (
              <div className="watch-error">Unavailable · no fallback used</div>
            ) : quote ? (
              <>
                <div className="watch-price mono">
                  {formatPrice(quote.mid, instrument.pricePrecision)}
                </div>
                <div className="watch-meta">
                  <span className={`badge ${QUALITY_CLASS[quote.quality]}`}>
                    {QUALITY_LABEL[quote.quality]}
                  </span>
                  {quote.stale && <span className="badge warn">Stale</span>}
                  <span className="muted">
                    <Clock size={10} /> {quote.ageSeconds}s
                  </span>
                </div>
                <div className="watch-pairs mono">
                  <span>B {formatPrice(quote.bid, instrument.pricePrecision)}</span>
                  <span>A {formatPrice(quote.ask, instrument.pricePrecision)}</span>
                  <span>S {formatCompact(quote.spread)}</span>
                </div>
              </>
            ) : (
              <div className="watch-loading">
                {loading ? (
                  <>
                    <span className="spinner" /> Loading quote…
                  </>
                ) : (
                  'No quote yet'
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Snapshot({ summary, precision }: { summary: MarketSummary; precision: number }) {
  const trendIcon =
    summary.trend === 'uptrend' ? (
      <TrendingUp size={13} />
    ) : summary.trend === 'downtrend' ? (
      <TrendingDown size={13} />
    ) : (
      <Gauge size={13} />
    );
  const positive = summary.change >= 0;
  return (
    <div className="stack">
      <div className="row-between">
        <span className="muted">Trend (SMA 20/50)</span>
        <span className={`badge ${summary.trend === 'uptrend' ? 'ok' : summary.trend === 'downtrend' ? 'error' : 'info'}`}>
          {trendIcon} {TREND_LABEL[summary.trend]}
        </span>
      </div>
      <div className="row-between">
        <span className="muted">Change over window</span>
        <span className={`mono ${positive ? 'positive' : 'negative'}`}>
          {positive ? '+' : ''}
          {formatPrice(summary.change, precision)} ({positive ? '+' : ''}
          {summary.changePct.toFixed(2)}%)
        </span>
      </div>
      <div className="row-between">
        <span className="muted">Period high</span>
        <span className="mono">{formatPrice(summary.periodHigh, precision)}</span>
      </div>
      <div className="row-between">
        <span className="muted">Period low</span>
        <span className="mono">{formatPrice(summary.periodLow, precision)}</span>
      </div>
      <div className="row-between">
        <span className="muted">Average candle range</span>
        <span className="mono">{formatPrice(summary.averageRange, precision)}</span>
      </div>
      <div className="row-between">
        <span className="muted">SMA 20</span>
        <span className="mono">{formatPrice(summary.sma20, precision)}</span>
      </div>
      <div className="row-between">
        <span className="muted">SMA 50</span>
        <span className="mono">{formatPrice(summary.sma50, precision)}</span>
      </div>
      <div className="row-between">
        <span className="muted">Average volume</span>
        <span className="mono">
          {summary.averageVolume === null
            ? 'Not reported'
            : Math.round(summary.averageVolume).toLocaleString('en-US')}
        </span>
      </div>
      <div className="row-between">
        <span className="muted">Candles / gaps</span>
        <span className="mono">
          {summary.candleCount} / {summary.gapCount} ({summary.expectedGapCount} expected)
        </span>
      </div>
      <p className="hint snapshot-note">
        Derived deterministically from the provider candles shown. This is a factual
        snapshot, not a recommendation. Full indicator and strategy work arrives in Phase 5.
      </p>
    </div>
  );
}

function Provenance({
  series,
  cached,
  precision,
}: {
  series: CandleSeries;
  cached: boolean;
  precision: number;
}) {
  const last = series.candles.at(-1);
  return (
    <div className="stack">
      <div className="row-between">
        <span className="muted">Provider</span>
        <span>{series.provider.displayName}</span>
      </div>
      <div className="row-between">
        <span className="muted">Quality</span>
        <span className={`badge ${QUALITY_CLASS[series.quality]}`}>
          {QUALITY_LABEL[series.quality]}
        </span>
      </div>
      {series.proxy && (
        <div className="row-between">
          <span className="muted">Proxy</span>
          <span className="badge proxy">
            {series.proxyFor ?? series.instrument} via {series.provider.displayName}
          </span>
        </div>
      )}
      <div className="row-between">
        <span className="muted">Fetched</span>
        <span className="mono">{formatUtc(series.fetchedAt, true)}</span>
      </div>
      <div className="row-between">
        <span className="muted">Range</span>
        <span className="mono">
          {formatUtc(series.from, true)} → {formatUtc(series.to, true)}
        </span>
      </div>
      <div className="row-between">
        <span className="muted">Candles</span>
        <span>{series.candles.length}</span>
      </div>
      <div className="row-between">
        <span className="muted">Gaps</span>
        <span>
          {series.gaps.length} ({series.gaps.filter((gap) => gap.expected).length} expected)
        </span>
      </div>
      <div className="row-between">
        <span className="muted">Cache</span>
        <span className={`badge ${cached ? 'info' : 'ok'}`}>
          {cached ? 'Cached response' : 'Fresh fetch'}
        </span>
      </div>
      <div className="row-between">
        <span className="muted">Last close</span>
        <span className="mono">{formatPrice(last?.close, precision)}</span>
      </div>
      {series.notes.length > 0 && (
        <div>
          <div className="muted small">Notes</div>
          <ul className="notes">
            {series.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CandleTable({ series, precision }: { series: CandleSeries; precision: number }) {
  const rows = series.candles.slice(-10).reverse();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Open</th>
            <th>High</th>
            <th>Low</th>
            <th>Close</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((candle) => (
            <tr key={candle.time}>
              <td className="mono">{formatCandleTime(candle.time)}</td>
              <td className="mono">{formatPrice(candle.open, precision)}</td>
              <td className="mono">{formatPrice(candle.high, precision)}</td>
              <td className="mono">{formatPrice(candle.low, precision)}</td>
              <td className="mono">{formatPrice(candle.close, precision)}</td>
              <td className="mono">
                {candle.volume === null ? '—' : candle.volume.toLocaleString('en-US')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketsPage() {
  const instruments = useInstruments();
  const quotes = useMarketQuotes();
  const providers = useProviders();
  const [selected, setSelected] = useState<InstrumentSymbol>('XAU/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const candles = useCandles(selected, timeframe);

  const instrumentList = instruments.data?.instruments ?? [];
  const quoteMap = useMemo(
    () => new Map(quotes.data?.quotes.map((quote) => [quote.instrument, quote]) ?? []),
    [quotes.data],
  );
  const errorMap = useMemo(
    () => new Map(quotes.data?.errors.map((error) => [error.instrument, error]) ?? []),
    [quotes.data],
  );
  const selectedInstrument = instrumentList.find(
    (instrument) => instrument.symbol === selected,
  );
  const precision = selectedInstrument?.pricePrecision ?? 2;
  const tickSize = selectedInstrument?.tickSize ?? 0.01;
  const series = candles.data?.series;
  const summary = useMemo(
    () => (series ? summarizeCandles(series.candles, series.gaps) : null),
    [series],
  );
  const selectedQuote = quoteMap.get(selected);
  const marketProviders =
    providers.data?.providers.filter((provider) => provider.category === 'market-data') ?? [];
  const error = quotes.error ?? instruments.error;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 3 · Trading workspace</span>
          <h2>Watchlist, chart and provenance in one view.</h2>
          <p>
            Free-tier reference data for XAU/USD, EUR/USD and GBP/USD. Every price and candle
            shows its provider, observation time, freshness and quality. Gold history uses
            COMEX gold futures (GC=F) as a clearly labelled proxy.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge ok">
            <ShieldCheck size={12} /> No fabricated data
          </span>
          <span className="badge warn">Reference quality</span>
          <span className="badge">Live execution disabled</span>
        </div>
      </section>

      <div className="banner info">
        <Database size={16} />
        <span>
          Quotes come from the public Swissquote website feed; candles come from the public
          Yahoo Finance chart endpoint. Neither is trading-grade. Treat stale or missing
          values as a reason to stand aside.
        </span>
      </div>

      {error && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>
            Market data unavailable: {error.message}. No fallback or fabricated price was
            generated.
          </span>
        </div>
      )}

      <div className="workspace">
        <aside className="card watchlist-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Watchlist</h3>
              <span className="hint">Live quotes · freshness</span>
            </div>
            <span className="badge">{instrumentList.length || '—'}</span>
          </div>
          <div className="card-body">
            {instruments.isLoading && instrumentList.length === 0 ? (
              <div className="loading">
                <span className="spinner" /> Loading instruments…
              </div>
            ) : (
              <Watchlist
                instruments={instrumentList}
                quotes={quoteMap}
                errors={errorMap}
                selected={selected}
                onSelect={setSelected}
                loading={quotes.isLoading}
              />
            )}
          </div>
        </aside>

        <div className="workspace-main">
          <section className="card chart-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  {selectedInstrument?.displayName ?? selected}
                  {selectedQuote && (
                    <span className="mono chart-mid">
                      {formatPrice(selectedQuote.mid, precision)}
                    </span>
                  )}
                </h3>
                <span className="hint">
                  {selected} · {timeframe} ·{' '}
                  {series?.provider.displayName ?? 'waiting for provider'}
                </span>
              </div>
              <div className="segmented" role="group" aria-label="Timeframe">
                {TIMEFRAMES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`segmented-item ${item === timeframe ? 'active' : ''}`}
                    onClick={() => setTimeframe(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body">
              {candles.isLoading && !series && (
                <div className="loading chart-loading">
                  <span className="spinner" /> Loading candles…
                </div>
              )}
              {candles.error && (
                <div className="banner error">
                  <AlertTriangle size={16} />
                  <span>{candles.error.message}. No synthetic candles were generated.</span>
                </div>
              )}
              {series && (
                <>
                  <PriceChart
                    series={series}
                    pricePrecision={precision}
                    tickSize={tickSize}
                  />
                  <div className="chart-footer">
                    <span className={`badge ${QUALITY_CLASS[series.quality]}`}>
                      {QUALITY_LABEL[series.quality]}
                    </span>
                    {series.proxy && <span className="badge proxy">Proxy</span>}
                    <span className="muted">
                      Fetched {formatUtc(series.fetchedAt, true)} · {series.candles.length}{' '}
                      candles · {series.gaps.length} gaps
                    </span>
                    {candles.data?.cached && <span className="badge info">Cached</span>}
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="grid grid-2">
            <section className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Instrument snapshot</h3>
                  <span className="hint">Derived from the chart window</span>
                </div>
                <span className="badge">Deterministic</span>
              </div>
              <div className="card-body">
                {summary ? (
                  <Snapshot summary={summary} precision={precision} />
                ) : (
                  <div className="empty-state">
                    <LineChart size={24} />
                    <h3>No snapshot yet</h3>
                    <p>Select an instrument and wait for a real candle series.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Candle provenance</h3>
                  <span className="hint">Where this series came from</span>
                </div>
                {series?.proxy && <span className="badge proxy">Proxy series</span>}
              </div>
              <div className="card-body">
                {series ? (
                  <Provenance
                    series={series}
                    cached={candles.data?.cached ?? false}
                    precision={precision}
                  />
                ) : (
                  <div className="empty-state">
                    <LineChart size={24} />
                    <h3>No candle series yet</h3>
                    <p>Select an instrument and timeframe to load provider data.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Recent candles</h3>
              <span className="badge">
                {series ? `${series.candles.length} candles` : 'No data'}
              </span>
            </div>
            {series ? (
              <CandleTable series={series} precision={precision} />
            ) : (
              <div className="empty-state">
                <LineChart size={24} />
                <h3>No candles to display</h3>
                <p>The table appears only when a real provider series is available.</p>
              </div>
            )}
            {series && (
              <div className="card-footer">
                Provider: {series.provider.displayName} · Quality:{' '}
                {QUALITY_LABEL[series.quality]} · Fetched {formatUtc(series.fetchedAt, true)}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Market provider health</h3>
              <span className="badge">Live status</span>
            </div>
            {providers.isLoading ? (
              <div className="card-body">
                <div className="loading">
                  <span className="spinner" /> Loading provider health…
                </div>
              </div>
            ) : (
              <ProviderTable providers={marketProviders} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
