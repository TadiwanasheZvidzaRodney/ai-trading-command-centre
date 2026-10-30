'use client';

import type { InstrumentSymbol, NewsItem } from '@atc/shared';
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Rss,
  Tag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNews, useProviders } from '@/lib/hooks';
import { refreshNews } from '@/lib/intelligence';

const INSTRUMENTS: readonly InstrumentSymbol[] = ['XAU/USD', 'EUR/USD', 'GBP/USD'];

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function relevanceTone(relevance: number): string {
  if (relevance >= 60) return 'accent';
  if (relevance >= 30) return 'info';
  return '';
}

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <article className="news-item">
      <div className="news-head">
        <a
          className="news-title"
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {item.title} <ExternalLink size={12} />
        </a>
        <span className={`badge ${relevanceTone(item.relevance)}`}>
          relevance {item.relevance}
        </span>
      </div>
      {item.summary && <p className="news-summary">{item.summary}</p>}
      <div className="news-meta">
        <span className="news-source">
          <Rss size={11} /> {item.source}
        </span>
        <span>
          <Clock size={11} /> Published {formatUtc(item.publishedAt)} UTC
        </span>
        <span className="dim">Fetched {formatUtc(item.fetchedAt)} UTC</span>
        {item.instruments.map((instrument) => (
          <span key={instrument} className="badge">
            {instrument}
          </span>
        ))}
        {item.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="news-tag">
            <Tag size={9} /> {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

export default function NewsPage() {
  const [instrument, setInstrument] = useState<'' | InstrumentSymbol>('');
  const [minRelevance, setMinRelevance] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const news = useNews({ instrument: instrument || undefined, limit: 100 });
  const providers = useProviders();

  const feed = news.data;
  const items = useMemo(
    () => (feed?.items ?? []).filter((item) => item.relevance >= minRelevance),
    [feed, minRelevance],
  );
  const newsProvider = providers.data?.providers.find(
    (provider) => provider.category === 'news',
  );
  const okSources = feed?.sources.filter((source) => source.status === 'ok').length ?? 0;

  async function handleRefresh() {
    setBusy(true);
    setActionError(null);
    try {
      await refreshNews();
      await news.mutate();
      await providers.mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not refresh news.');
    } finally {
      setBusy(false);
    }
  }

  const error = news.error ?? actionError;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 4 · News and macro intelligence</span>
          <h2>Source-linked headlines, tagged deterministically.</h2>
          <p>
            Public RSS feeds are deduplicated and tagged by currency and instrument. A
            headline is a fact from its source; the relevance score is a keyword
            calculation, not sentiment and not a prediction.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge ok">
            <Rss size={12} /> Public RSS
          </span>
          <span className="badge info">No article bodies stored</span>
        </div>
      </section>

      {feed?.error && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>{feed.error}</span>
        </div>
      )}

      {error && !feed?.error && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>{error instanceof Error ? error.message : String(error)}</span>
        </div>
      )}

      <div className="grid grid-4">
        <div className="card stat">
          <div className="stat-label">Headlines</div>
          <div className="stat-value">{news.isLoading ? '…' : items.length}</div>
          <div className="stat-hint">
            {instrument ? `Filtered to ${instrument}` : 'All tagged instruments'}
          </div>
        </div>
        <div className="card stat">
          <div className="stat-label">Sources</div>
          <div className="stat-value">
            {news.isLoading ? '…' : `${okSources}/${feed?.sources.length ?? 0}`}
          </div>
          <div className="stat-hint">Feeds that returned usable items</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Duplicates removed</div>
          <div className="stat-value">{news.isLoading ? '…' : (feed?.duplicatesRemoved ?? 0)}</div>
          <div className="stat-hint">Matched by canonical URL or title</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Fetched</div>
          <div className="stat-value stat-value-small">
            {news.isLoading ? '…' : formatUtc(feed?.fetchedAt)}
          </div>
          <div className="stat-hint">{feed?.cached ? 'Served from cache' : 'Fresh fetch'} · UTC</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Headlines</h3>
            <span className="hint">
              Newest first · headline, link and published time only
            </span>
          </div>
          <div className="row">
            <select
              className="select select-compact"
              aria-label="Filter news by instrument"
              value={instrument}
              onChange={(event) =>
                setInstrument(event.target.value as '' | InstrumentSymbol)
              }
            >
              <option value="">All instruments</option>
              {INSTRUMENTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="select select-compact"
              aria-label="Filter news by relevance"
              value={minRelevance}
              onChange={(event) => setMinRelevance(Number(event.target.value))}
            >
              <option value={1}>Tagged only</option>
              <option value={30}>Relevance 30+</option>
              <option value={60}>Relevance 60+</option>
              <option value={0}>Any relevance</option>
            </select>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleRefresh}
              disabled={busy}
            >
              <RefreshCw size={13} /> {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="card-body">
          {news.isLoading && items.length === 0 ? (
            <div className="loading">
              <span className="spinner" /> Loading headlines…
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <Newspaper size={26} />
              <h3>No headlines to show</h3>
              <p>
                {feed?.error
                  ? 'The news provider failed. No headlines were fabricated.'
                  : instrument
                    ? `No current headlines were tagged for ${instrument} at this relevance level.`
                    : 'No current headlines matched the relevance filter. Try "Any relevance".'}
              </p>
            </div>
          ) : (
            <div className="news-list">
              {items.map((item) => (
                <NewsRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Source status</h3>
              <span className="hint">Per-feed result for the latest fetch</span>
            </div>
            <span className="badge">{feed?.sources.length ?? 0}</span>
          </div>
          <div className="card-body">
            {feed && feed.sources.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Items</th>
                      <th>Skipped</th>
                      <th>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feed.sources.map((source) => (
                      <tr key={source.id}>
                        <td>
                          <strong>{source.id}</strong>
                          <div className="mono small dim news-source-url">{source.url}</div>
                        </td>
                        <td>
                          <span className={`badge ${source.status === 'ok' ? 'ok' : 'error'}`}>
                            {source.status}
                          </span>
                        </td>
                        <td className="mono">{source.itemCount}</td>
                        <td className="mono">{source.skippedCount}</td>
                        <td className="mono">{source.latencyMs} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="hint">
                {news.isLoading ? 'Loading source status…' : 'No source status reported.'}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">News provider</h3>
              <span className="hint">Health, quality and limitations</span>
            </div>
            {feed?.provider.quality && (
              <span className="badge warn">{feed.provider.quality}</span>
            )}
          </div>
          <div className="card-body stack">
            {feed ? (
              <>
                <div className="row-between">
                  <span className="muted">Provider</span>
                  <span>{feed.provider.displayName}</span>
                </div>
                <div className="row-between">
                  <span className="muted">Health</span>
                  {newsProvider ? (
                    <span
                      className={`badge ${
                        newsProvider.status === 'ok'
                          ? 'ok'
                          : newsProvider.status === 'degraded'
                            ? 'warn'
                            : newsProvider.status === 'error'
                              ? 'error'
                              : ''
                      }`}
                    >
                      {newsProvider.status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="badge">unknown</span>
                  )}
                </div>
                <div className="row-between">
                  <span className="muted">Skipped items</span>
                  <span className="mono">{feed.skippedCount}</span>
                </div>
                {feed.provider.note && <p className="hint">{feed.provider.note}</p>}
                <ul className="notes">
                  {feed.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="hint">Provider details load with the first feed.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
