'use client';

import { Activity, ArrowRight, LockKeyhole, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuthStatus } from '@/lib/hooks';

export default function LoginPage() {
  const auth = useAuthStatus();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/v1/auth/login', { username, password });
      window.location.assign('/');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sign-in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.data?.mode === 'disabled') {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <div className="card-body">
            <div className="login-brand">
              <span className="login-brand-mark">
                <ShieldAlert size={19} />
              </span>
              <div>
                <h2 className="page-title">Authentication disabled</h2>
                <p className="page-subtitle">Development-only configuration</p>
              </div>
            </div>
            <p className="muted small">
              This workspace is running with <code>AUTH_MODE=disabled</code>. Anyone with
              access to the local URL can use it. Set a password hash and{' '}
              <code>AUTH_MODE=session</code> before exposing it beyond your machine.
            </p>
            <Link href="/" className="btn btn-primary">
              Continue to workspace <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="card-body">
          <div className="login-brand">
            <span className="login-brand-mark">
              <Activity size={19} />
            </span>
            <div>
              <h2 className="page-title">Sign in</h2>
              <p className="page-subtitle">Personal trading workspace</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="stack">
            <div className="field">
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="input"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              <LockKeyhole size={14} />
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="hint">
            Sessions use HttpOnly cookies. Failed attempts are rate-limited and audited.
          </p>
        </div>
      </div>
    </div>
  );
}
