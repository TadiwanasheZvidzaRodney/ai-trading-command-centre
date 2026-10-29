'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Database,
  Gauge,
  LineChart,
  Server,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { ProviderTable } from '@/components/ProviderTable';
import {
  useAuthStatus,
  useHealth,
  useInstruments,
  useMarketQuotes,
  useProviders,
  useSystemInfo,
} from '@/lib/hooks';

function formatPrice(value: number | null | undefined, precision: number): string {
  return value === null || value === undefined ? '—' : value.toFixed(precision);
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  tone?: 'default' | 'ok' | 'warn' | 'error';
}) {
  const className =
    tone === 'ok' ? 'positive' : tone === 'warn' ? 'warning-text' : tone === 'error' ? 'negative' : '';
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${className}`}>{value}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}

export default function OverviewPage() {
  const health = useHealth();
  const providers = useProviders();
  const auth = useAuthStatus();
  const info = useSystemInfo();
  const instruments = useInstruments();
  const marketQuotes = useMarketQuotes();

  const databaseOk = health.data?.checks.database.status === 'ok';
  const apiOnline = health.data?.status === 'ok';
  const providerCount = providers.data?.providers.length ?? 0;
  const instrumentList = instruments.data?.instruments ?? [];
  const quoteMap = new Map(
    marketQuotes.data?.quotes.map((quote) => [quote.instrument, quote]) ?? [],
  );

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 3 · Trading workspace</span>
          <h2>Research first. Risk before reward.</h2>
          <p>
            A personal workspace for XAU/USD, EUR/USD and GBP/USD. Real data, deterministic
            calculations, visible provenance, and no live execution. Every number must be
            traceable to a provider and a timestamp.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge ok">
            <ShieldCheck size={12} /> Research mode
          </span>
          <span className="badge">Live execution disabled</span>
          <span className="badge info">Single user</span>
        </div>
      </section>

      <div className="grid grid-4">
        <Stat
          label="API"
          value={health.isLoading ? 'Checking…' : apiOnline ? 'Online' : 'Offline'}
          hint={health.data ? `v${health.data.version} · uptime ${health.data.uptimeSeconds}s` : 'No response yet'}
          tone={health.isLoading ? 'default' : apiOnline ? 'ok' : 'error'}
        />
        <Stat
          label="Database"
          value={
            health.isLoading ? 'Checking…' : databaseOk ? 'Connected' : 'Unavailable'
          }
          hint={
            health.data
              ? `${health.data.checks.database.latencyMs.toFixed(1)} ms round trip`
              : 'MongoDB health check'
          }
          tone={health.isLoading ? 'default' : databaseOk ? 'ok' : 'error'}
        />
        <Stat
          label="Trading mode"
          value={info.data?.tradingMode ?? health.data?.tradingMode ?? 'research'}
          hint="Paper trading only; live execution is not implemented"
          tone="ok"
        />
        <Stat
          label="Data providers"
          value={providers.isLoading ? 'Loading…' : String(providerCount)}
          hint={
            providers.data
              ? 'Reference-tier free sources, clearly labelled'
              : 'Quote, candle, news, calendar and AI status'
          }
        />
      </div>

      {health.error && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>
            The API is unreachable. Start it with <code>npm run dev:api</code> and check{' '}
            <code>http://localhost:4000/health</code>.
          </span>
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Market watch</h3>
            <span className="hint">Live quotes, age and quality</span>
          </div>
          <Link href="/markets" className="btn btn-sm">
            <LineChart size={13} /> Open workspace
          </Link>
        </div>
        <div className="card-body">
          {marketQuotes.isLoading && instrumentList.length === 0 ? (
            <div className="loading">
              <span className="spinner" /> Loading quotes…
            </div>
          ) : marketQuotes.error ? (
            <div className="banner error">
              <AlertTriangle size={16} />
              <span>
                Quotes unavailable: {marketQuotes.error.message}. No fallback price was used.
              </span>
            </div>
          ) : (
            <div className="watchlist overview-watchlist">
              {instrumentList.map((instrument) => {
                const quote = quoteMap.get(instrument.symbol);
                return (
                  <Link
                    key={instrument.symbol}
                    href="/markets"
                    className="watch-row"
                  >
                    <div className="watch-head">
                      <span className="watch-symbol mono">{instrument.symbol}</span>
                      <span className="watch-name">{instrument.displayName}</span>
                    </div>
                    <div className="watch-price mono">
                      {quote ? formatPrice(quote.mid, instrument.pricePrecision) : '—'}
                    </div>
                    <div className="watch-meta">
                      {quote ? (
                        <>
                          <span
                            className={`badge ${
                              quote.quality === 'proxy'
                                ? 'proxy'
                                : quote.quality === 'reference'
                                  ? 'warn'
                                  : quote.quality === 'delayed'
                                    ? 'info'
                                    : 'ok'
                            }`}
                          >
                            {quote.quality}
                          </span>
                          {quote.stale && <span className="badge warn">Stale</span>}
                          <span className="muted">
                            <Clock size={10} /> {quote.ageSeconds}s
                          </span>
                        </>
                      ) : (
                        <span className="muted">No quote yet</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Provider status</h3>
            <span className="badge">Provenance required</span>
          </div>
          {providers.isLoading ? (
            <div className="card-body">
              <div className="loading">
                <span className="spinner" /> Loading provider health…
              </div>
            </div>
          ) : providers.error ? (
            <div className="card-body">
              <div className="banner error">
                <AlertTriangle size={16} />
                <span>Provider status unavailable: {providers.error.message}</span>
              </div>
            </div>
          ) : (
            <ProviderTable providers={providers.data?.providers ?? []} />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Foundation checklist</h3>
            <span className="badge ok">Phase 3</span>
          </div>
          <div className="card-body">
            <ul className="checklist">
              <li className="done">
                <CheckCircle2 size={15} />
                <span>Architecture, data strategy and provider evaluation documented.</span>
              </li>
              <li className="done">
                <CheckCircle2 size={15} />
                <span>Typed npm workspace with strict TypeScript and shared schemas.</span>
              </li>
              <li className="done">
                <CheckCircle2 size={15} />
                <span>Environment validation, MongoDB, structured logging and health checks.</span>
              </li>
              <li className="done">
                <CheckCircle2 size={15} />
                <span>Single-user auth plumbing with session cookies and CSRF protection.</span>
              </li>
              <li className="done">
                <CheckCircle2 size={15} />
                <span>Real quote and candle adapters with provenance, freshness and proxy labels (Phase 2).</span>
              </li>
              <li className="done">
                <CheckCircle2 size={15} />
                <span>Trading workspace with watchlist, candlestick charts, snapshot, tasks and calendar (Phase 3).</span>
              </li>
              <li className="pending">
                <Circle size={15} />
                <span>News, calendar ingestion, analysis, risk, paper trading and backtesting.</span>
              </li>
            </ul>
          </div>
          <div className="card-footer">
            <Link href="/markets" className="btn btn-sm">
              <LineChart size={13} /> Open Markets
            </Link>
            <Link href="/tasks" className="btn btn-sm">
              <CheckCircle2 size={13} /> Tasks
            </Link>
            <Link href="/settings" className="btn btn-sm">
              <Server size={13} /> View system configuration
            </Link>
          </div>
        </section>
      </div>

      <div className="grid grid-3">
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Safety rules</h3>
          </div>
          <div className="card-body stack small muted">
            <div className="row">
              <ShieldCheck size={14} className="positive" />
              <span>Live trading is disabled and not implemented.</span>
            </div>
            <div className="row">
              <Database size={14} className="positive" />
              <span>Missing data fails visibly; no silent mock fallback.</span>
            </div>
            <div className="row">
              <Gauge size={14} className="positive" />
              <span>Risk limits are enforced server-side with deterministic code.</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Authentication</h3>
          </div>
          <div className="card-body stack small">
            <div className="row-between">
              <span className="muted">Mode</span>
              <span className={`badge ${auth.data?.mode === 'disabled' ? 'warn' : 'ok'}`}>
                {auth.data?.mode ?? 'unknown'}
              </span>
            </div>
            <div className="row-between">
              <span className="muted">Signed in</span>
              <span>{auth.data?.user?.username ?? '—'}</span>
            </div>
            <p className="hint">
              {auth.data?.mode === 'disabled'
                ? 'Development-only mode. Set AUTH_MODE=session before any shared deployment.'
                : 'Session authentication with HttpOnly cookies and CSRF tokens.'}
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Next milestone</h3>
            <span className="badge accent">Phase 4</span>
          </div>
          <div className="card-body stack small muted">
            <p>
              Ingest public RSS news and the economic calendar with source attribution,
              relevance tagging and UTC-normalised event times.
            </p>
            <p className="hint">
              Until ingestion is live, the News and Calendar pages show no events rather
              than placeholder data.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
