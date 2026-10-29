'use client';

import type {
  CandleSeries,
  DataQuality,
  Instrument,
  InstrumentSymbol,
  Timeframe,
} from '@atc/shared';
import { AlertTriangle, Clock, Database, LineChart, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CandlePreview } from '@/components/CandlePreview';
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

function QuoteCard({
  instrument,
  quote,
  error,
  loading,
}: {
  instrument: Instrument;
  quote?: MarketQuote;
  error?: MarketQuoteError;
  loading: boolean;
}) {
  if (loading && !quote) {
    return (
      <section className="card quote-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">{instrument.displayName}</h3>
            <span className="hint mono">{instrument.symbol}</span>
          </div>
          <span className="badge">Loading</span>
        </div>
        <div className="card-body">
          <div className="loading">
            <span className="spinner" /> Fetching quote…
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card quote-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">{instrument.displayName}</h3>
            <span className="hint mono">{instrument.symbol}</span>
          </div>
          <span className="badge error">Unavailable</span>
        </div>
        <div className="card-body">
          <p className="error-text">{error.message}</p>
          <p className="hint">No fallback or fabricated price was used.</p>
        </div>
      </section>
    );
  }

  if (!quote) {
    return (
      <section className="card quote-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">{instrument.displayName}</h3>
            <span className="hint mono">{instrument.symbol}</span>
          </div>
          <span className="badge">Waiting</span>
        </div>
        <div className="card-body">
          <p className="hint">No quote has been returned yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card quote-card">
      <div className="card-header">
        <div>
          <h3 className="card-title">{instrument.displayName}</h3>
          <span className="hint mono">{instrument.symbol}</span>
        </div>
        <div className="quote-badges">
          <span className={`badge ${QUALITY_CLASS[quote.quality]}`}>
            {QUALITY_LABEL[quote.quality]}
          </span>
          {quote.proxy && <span className="badge proxy">Proxy</span>}
          {quote.stale && <span className="badge warn">Stale</span>}
          {quote.cached && <span className="badge info">Cached</span>}
        </div>
      </div>
      <div className="card-body">
        <div className="quote-mid mono">{formatPrice(quote.mid, instrument.pricePrecision)}</div>
        <div className="quote-pairs">
          <div>
            <span className="muted">Bid</span>
            <span className="mono">{formatPrice(quote.bid, instrument.pricePrecision)}</span>
          </div>
          <div>
            <span className="muted">Ask</span>
            <span className="mono">{formatPrice(quote.ask, instrument.pricePrecision)}</span>
          </div>
          <div>
            <span className="muted">Spread</span>
            <span className="mono">{formatCompact(quote.spread)}</span>
          </div>
        </div>
        <div className="quote-meta">
          <span>{quote.provider.displayName}</span>
          <span className="mono">
            <Clock size={11} /> {formatUtc(quote.observedAt)}
          </span>
          <span>{quote.ageSeconds}s ago</span>
        </div>
        {quote.note && <p className="hint quote-note">{quote.note}</p>}
      </div>
    </section>
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
  const expectedGaps = series.gaps.filter((gap) => gap.expected).length;
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
          {series.gaps.length} ({expectedGaps} expected)
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
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
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
  const series = candles.data?.series;
  const marketProviders =
    providers.data?.providers.filter((provider) => provider.category === 'market-data') ??
    [];
  const error = quotes.error ?? instruments.error;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 2 · Real market data</span>
          <h2>Quotes and candles with visible provenance.</h2>
          <p>
            Free-tier reference data for XAU/USD, EUR/USD and GBP/USD. Every price shows its
            provider, observation time, freshness and quality. Gold history uses COMEX gold
            futures (GC=F) as a clearly labelled proxy.
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
          Yahoo Finance chart endpoint. Neither is trading-grade. Treat stale or missing values
          as a reason to stand aside.
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

      <div className="grid grid-3">
        {instruments.isLoading && (
          <section className="card quote-card">
            <div className="card-body">
              <div className="loading">
                <span className="spinner" /> Loading instruments…
              </div>
            </div>
          </section>
        )}
        {instrumentList.map((instrument) => (
          <QuoteCard
            key={instrument.symbol}
            instrument={instrument}
            quote={quoteMap.get(instrument.symbol)}
            error={errorMap.get(instrument.symbol)}
            loading={quotes.isLoading}
          />
        ))}
        {!instruments.isLoading && instrumentList.length === 0 && (
          <section className="card quote-card">
            <div className="card-body">
              <div className="empty-state">
                <LineChart size={24} />
                <h3>No instruments reported</h3>
                <p>The API did not return an instrument list. Check the API logs.</p>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="grid grid-2 markets-main">
        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Candles</h3>
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
            <div className="instrument-tabs" role="group" aria-label="Instrument">
              {instrumentList.map((instrument) => (
                <button
                  key={instrument.symbol}
                  type="button"
                  className={`instrument-tab ${
                    instrument.symbol === selected ? 'active' : ''
                  }`}
                  onClick={() => setSelected(instrument.symbol)}
                >
                  {instrument.symbol}
                </button>
              ))}
            </div>
            {candles.isLoading && (
              <div className="loading">
                <span className="spinner" /> Loading candles…
              </div>
            )}
            {candles.error && (
              <div className="banner error">
                <AlertTriangle size={16} />
                <span>
                  {candles.error.message}. No synthetic candles were generated.
                </span>
              </div>
            )}
            {series && <CandlePreview series={series} pricePrecision={precision} />}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Candle provenance</h3>
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
  );
}
