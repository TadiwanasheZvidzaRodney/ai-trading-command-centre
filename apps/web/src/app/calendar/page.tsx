'use client';

import type { ProviderHealth } from '@atc/shared';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
} from 'lucide-react';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useProviders } from '@/lib/hooks';

const DAY_MS = 86_400_000;

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

function startOfWeekUtc(now: Date, offsetWeeks: number): Date {
  const day = now.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday + offsetWeeks * 7,
    ),
  );
}

function formatWeekRange(start: Date): string {
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${formatter.format(start)} → ${formatter.format(end)}`;
}

function sameUtcDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function CalendarProviderStatus({ provider }: { provider?: ProviderHealth }) {
  if (!provider) {
    return <p className="hint">Calendar provider status is not reported.</p>;
  }
  const tone =
    provider.status === 'ok'
      ? 'ok'
      : provider.status === 'degraded'
        ? 'warn'
        : provider.status === 'error'
          ? 'error'
          : 'info';
  return (
    <div className="stack">
      <div className="row-between">
        <span className="muted">Provider</span>
        <span>{provider.displayName}</span>
      </div>
      <div className="row-between">
        <span className="muted">Status</span>
        <span className={`badge ${tone}`}>{provider.status.replace('_', ' ')}</span>
      </div>
      <div className="row-between">
        <span className="muted">Configured</span>
        <span>{provider.configured ? 'Yes' : 'No'}</span>
      </div>
      <p className="hint">{provider.message}</p>
    </div>
  );
}

export default function CalendarPage() {
  const providers = useProviders();
  const now = useSyncExternalStore(subscribe, getClientNow, getServerNow);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(
    () => (now ? startOfWeekUtc(now, weekOffset) : null),
    [now, weekOffset],
  );
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
  const today = now ?? new Date();
  const calendarProvider = providers.data?.providers.find(
    (provider) => provider.category === 'calendar',
  );

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 3 · Trading workspace</span>
          <h2>Economic calendar, normalised to UTC.</h2>
          <p>
            The week view is ready for ingested events. Until Phase 4 adds the calendar
            provider, this page intentionally shows no events rather than placeholder data.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge ok">
            <Clock size={12} /> UTC buckets
          </span>
          <span className="badge info">No placeholder events</span>
        </div>
      </section>

      <div className="banner info">
        <Database size={16} />
        <span>
          Calendar ingestion arrives in Phase 4. The Forex Factory community feed is
          configured but not yet ingested. Verify any future event against the primary source
          before trading around it.
        </span>
      </div>

      {providers.error && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>{providers.error.message}</span>
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <div className="calendar-toolbar">
            <div>
              <h3 className="card-title">Week view</h3>
              <span className="hint">
                {weekStart ? `${formatWeekRange(weekStart)} · UTC` : 'Loading calendar…'}
              </span>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setWeekOffset((value) => value - 1)}
                aria-label="Previous week"
                disabled={!weekStart}
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0 || !weekStart}
              >
                This week
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setWeekOffset((value) => value + 1)}
                aria-label="Next week"
                disabled={!weekStart}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {!weekStart ? (
            <div className="loading">
              <span className="spinner" /> Preparing week view…
            </div>
          ) : (
            <>
              <div className="calendar-grid">
                {days.map((day) => {
                  const isToday = sameUtcDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
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
                        <p className="calendar-empty">No events ingested</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="hint" style={{ marginTop: 12 }}>
                {formatWeekRange(weekStart)}
              </p>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Calendar provider</h3>
            <span className="hint">Health and configuration</span>
          </div>
          <span className="badge">
            <CalendarDays size={11} /> Phase 4 ingestion
          </span>
        </div>
        <div className="card-body">
          {providers.isLoading ? (
            <div className="loading">
              <span className="spinner" /> Loading provider status…
            </div>
          ) : (
            <CalendarProviderStatus provider={calendarProvider} />
          )}
        </div>
      </section>
    </div>
  );
}
