'use client';

import type { CalendarEvent, Impact, InstrumentSymbol } from '@atc/shared';
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Filter,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useCalendar, useProviders } from '@/lib/hooks';
import { refreshCalendar } from '@/lib/intelligence';

const DAY_MS = 86_400_000;
const INSTRUMENTS: readonly InstrumentSymbol[] = ['XAU/USD', 'EUR/USD', 'GBP/USD'];
const IMPACTS: readonly Impact[] = ['high', 'medium', 'low', 'holiday'];

let clientNow: Date | null = null;

function subscribe(): () => void {
  return () => {};
}

function getClientNow(): Date {
  clientNow ??= new Date();
  return clientNow;
}

function getServerNow(): null {
  return null;
}

function formatUtcTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatUtcDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function utcDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return date.toISOString().slice(0, 10);
}

function sameUtcDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div className={`calendar-event impact-${event.impact}`}>
      <div className="calendar-event-head">
        <span className="calendar-event-time mono">{formatUtcTime(event.scheduledAt)}</span>
        <span className={`impact-badge impact-${event.impact}`}>{event.impact}</span>
      </div>
      <div className="calendar-event-title">{event.title}</div>
      <div className="calendar-event-meta">
        <span className="badge">{event.currency}</span>
        {event.forecast && <span>Forecast {event.forecast}</span>}
        {event.previous && <span>Previous {event.previous}</span>}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [impact, setImpact] = useState<'' | Impact>('');
  const [instrument, setInstrument] = useState<'' | InstrumentSymbol>('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const now = useSyncExternalStore(subscribe, getClientNow, getServerNow);
  const calendar = useCalendar({
    impact: impact || undefined,
    instrument: instrument || undefined,
    limit: 500,
  });
  const providers = useProviders();

  const feed = calendar.data;
  const events = useMemo(() => feed?.events ?? [], [feed]);
  const weekStart = useMemo(() => (feed ? new Date(feed.weekStart) : null), [feed]);
  const days = useMemo(
    () =>
      weekStart
        ? Array.from(
            { length: 7 },
            (_, index) => new Date(weekStart.getTime() + index * DAY_MS),
          )
        : [],
    [weekStart],
  );
  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = utcDayKey(event.scheduledAt);
      const list = grouped.get(key) ?? [];
      list.push(event);
      grouped.set(key, list);
    }
    return grouped;
  }, [events]);
  const highImpact = events.filter((event) => event.impact === 'high').length;
  const calendarProvider = providers.data?.providers.find(
    (provider) => provider.category === 'calendar',
  );
  const today = now ?? new Date();
  const error = calendar.error ?? actionError;

  async function handleRefresh() {
    setBusy(true);
    setActionError(null);
    try {
      await refreshCalendar();
      await calendar.mutate();
      await providers.mutate();
    } catch (errorValue) {
      setActionError(
        errorValue instanceof Error ? errorValue.message : 'Could not refresh the calendar.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 4 · News and macro intelligence</span>
          <h2>Economic calendar, normalised to UTC.</h2>
          <p>
            The current week of USD, EUR and GBP events from a community mirror of Forex
            Factory. Times are converted to UTC, high-impact events are highlighted, and the
            provider limitations are stated below.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge ok">
            <Clock size={12} /> UTC buckets
          </span>
          <span className="badge info">Sunday-start week</span>
        </div>
      </section>

      <div className="banner info">
        <ShieldAlert size={16} />
        <span>
          Unofficial community mirror: current week only, no actual values, and no
          historical weeks. Verify high-impact events against the primary statistical agency
          before trading around them.
        </span>
      </div>

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
          <div className="stat-label">Events this week</div>
          <div className="stat-value">{calendar.isLoading ? '…' : events.length}</div>
          <div className="stat-hint">
            {impact ? `${impact} impact filter` : 'USD, EUR and GBP only'}
          </div>
        </div>
        <div className="card stat">
          <div className="stat-label">High impact</div>
          <div className={`stat-value ${highImpact > 0 ? 'warning-text' : ''}`}>
            {calendar.isLoading ? '…' : highImpact}
          </div>
          <div className="stat-hint">Highlighted in the week grid</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Fetched</div>
          <div className="stat-value stat-value-small">
            {calendar.isLoading ? '…' : formatUtcDate(feed?.fetchedAt)}
          </div>
          <div className="stat-hint">{feed?.cached ? 'Served from cache' : 'Fresh fetch'} · UTC</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Provider</div>
          <div className="stat-value stat-value-small">
            {feed?.provider.displayName ?? 'Loading…'}
          </div>
          <div className="stat-hint">Quality: {feed?.provider.quality ?? '—'}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Week view</h3>
            <span className="hint">
              {weekStart
                ? `${formatUtcDate(feed?.weekStart)} → ${formatUtcDate(feed?.weekEnd)} · UTC`
                : 'Loading calendar…'}
            </span>
          </div>
          <div className="row">
            <select
              className="select select-compact"
              aria-label="Filter by impact"
              value={impact}
              onChange={(event) => setImpact(event.target.value as '' | Impact)}
            >
              <option value="">All impact</option>
              {IMPACTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="select select-compact"
              aria-label="Filter by instrument"
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
          {calendar.isLoading && !feed ? (
            <div className="loading">
              <span className="spinner" /> Loading calendar…
            </div>
          ) : days.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={26} />
              <h3>No calendar window</h3>
              <p>The provider did not return a usable current-week window.</p>
            </div>
          ) : (
            <div className="calendar-grid">
              {days.map((day) => {
                const key = day.toISOString().slice(0, 10);
                const dayEvents = eventsByDay.get(key) ?? [];
                const isToday = sameUtcDay(day, today);
                return (
                  <div
                    key={key}
                    className={`calendar-day ${isToday ? 'today' : ''}`}
                  >
                    <div className="calendar-day-header">
                      <span className="calendar-day-name">
                        {new Intl.DateTimeFormat('en-GB', {
                          timeZone: 'UTC',
                          weekday: 'short',
                        }).format(day)}
                      </span>
                      <span className="calendar-day-number">{day.getUTCDate()}</span>
                    </div>
                    <div className="calendar-day-body">
                      {dayEvents.length === 0 ? (
                        <p className="calendar-empty">No events</p>
                      ) : (
                        dayEvents.map((event) => (
                          <EventCard key={event.id} event={event} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {feed && events.length === 0 && !feed.error && (
            <p className="hint" style={{ marginTop: 12 }}>
              No events match the current filters. Nothing was fabricated.
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Calendar provider</h3>
              <span className="hint">Health, source and limitations</span>
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
                  {calendarProvider ? (
                    <span
                      className={`badge ${
                        calendarProvider.status === 'ok'
                          ? 'ok'
                          : calendarProvider.status === 'degraded'
                            ? 'warn'
                            : calendarProvider.status === 'error'
                              ? 'error'
                              : ''
                      }`}
                    >
                      {calendarProvider.status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="badge">unknown</span>
                  )}
                </div>
                <div className="row-between">
                  <span className="muted">Skipped rows</span>
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
              <p className="hint">Provider details load with the first calendar fetch.</p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">How to read this</h3>
              <span className="hint">Facts versus calculations</span>
            </div>
            <span className="badge">
              <Filter size={11} /> Deterministic
            </span>
          </div>
          <div className="card-body stack small muted">
            <p>
              Times come from the provider and are converted to UTC. The week runs Sunday
              00:00 UTC to the following Sunday 00:00 UTC, matching the source week.
            </p>
            <p>
              Impact labels are the provider&apos;s labels. A high-impact event is not a
              directional signal; it is a warning that volatility may increase.
            </p>
            <p>
              Events without a title, supported currency or parseable date are skipped rather
              than guessed. No placeholder events are inserted.
            </p>
            <p className="hint">
              {feed
                ? `${feed.skippedCount} row(s) skipped in the latest fetch.`
                : 'Skipped-row counts appear after the first fetch.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
