'use client';

import { AlertTriangle, Server, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { ProviderTable } from '@/components/ProviderTable';
import { useAuthStatus, useProviders, useSystemInfo } from '@/lib/hooks';

export default function SettingsPage() {
  const info = useSystemInfo();
  const providers = useProviders();
  const auth = useAuthStatus();

  if (info.error) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h2 className="page-title">Settings</h2>
            <p className="page-subtitle">Application configuration and provider health</p>
          </div>
        </div>
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>
            {info.error.status === 401
              ? 'Sign in to view system configuration.'
              : `Configuration unavailable: ${info.error.message}`}
          </span>
          {info.error.status === 401 && (
            <Link href="/login" className="btn btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">
            Read-only configuration summary. Secrets are never sent to the browser.
          </p>
        </div>
        <span className="badge ok">
          <ShieldCheck size={12} /> Server-side only
        </span>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Runtime</h3>
            <Server size={15} className="dim" />
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <td>Environment</td>
                  <td>
                    <strong>{info.data?.environment ?? '—'}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Version</td>
                  <td className="mono">{info.data?.version ?? '—'}</td>
                </tr>
                <tr>
                  <td>Trading mode</td>
                  <td>
                    <span className="badge ok">{info.data?.tradingMode ?? '—'}</span>
                  </td>
                </tr>
                <tr>
                  <td>Live trading</td>
                  <td>
                    <span className="badge">Disabled</span>
                  </td>
                </tr>
                <tr>
                  <td>Authentication</td>
                  <td>
                    <span
                      className={`badge ${info.data?.authMode === 'disabled' ? 'warn' : 'ok'}`}
                    >
                      {info.data?.authMode ?? '—'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Timezone</td>
                  <td className="mono">{info.data?.timezone ?? '—'}</td>
                </tr>
                <tr>
                  <td>Scheduler</td>
                  <td>{info.data?.schedulerEnabled ? 'Enabled' : 'Disabled'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Configured providers</h3>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <td>Quotes</td>
                  <td className="mono">{info.data?.providers.quote ?? '—'}</td>
                </tr>
                <tr>
                  <td>Candles</td>
                  <td className="mono">{info.data?.providers.candle ?? '—'}</td>
                </tr>
                <tr>
                  <td>News</td>
                  <td className="mono">{info.data?.providers.news ?? '—'}</td>
                </tr>
                <tr>
                  <td>Calendar</td>
                  <td className="mono">{info.data?.providers.calendar ?? '—'}</td>
                </tr>
                <tr>
                  <td>AI narrative</td>
                  <td className="mono">{info.data?.providers.ai ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card-footer">
            Provider keys are read from server environment variables only. Missing keys show
            as <code>not_configured</code>; there is no mock fallback.
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Provider health</h3>
          <span className="badge">
            {auth.data?.mode === 'disabled' ? 'Development auth' : 'Session auth'}
          </span>
        </div>
        <ProviderTable providers={providers.data?.providers ?? []} />
      </section>

      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Safety</h3>
        </div>
        <div className="card-body stack small muted">
          <p>
            <strong className="positive">Live execution is disabled.</strong> Setting{' '}
            <code>LIVE_TRADING_ENABLED=true</code> makes the API refuse to start. A future
            broker integration requires a separate review, demo verification, reconciliation,
            idempotency and a kill switch.
          </p>
          <p>
            Risk limits and position sizing are deterministic server-side calculations. AI
            output can never submit, modify or cancel an order.
          </p>
        </div>
      </section>
    </div>
  );
}
