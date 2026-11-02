'use client';

import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Menu,
  Newspaper,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStatus, useHealth } from '@/lib/hooks';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, phase: 1 },
  { href: '/markets', label: 'Markets', icon: LineChart, phase: 3 },
  { href: '/news', label: 'News', icon: Newspaper, phase: 4 },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, phase: 4 },
  { href: '/analysis', label: 'Analysis', icon: FlaskConical, phase: 5 },
  { href: '/copilot', label: 'AI Copilot', icon: Activity, phase: 6 },
  { href: '/planner', label: 'Planner', icon: Gauge, phase: 7 },
  { href: '/paper', label: 'Paper trading', icon: BarChart3, phase: 7 },
  { href: '/journal', label: 'Journal', icon: BookOpen, phase: 7 },
  { href: '/backtests', label: 'Backtests', icon: ClipboardList, phase: 8 },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, phase: 3 },
  { href: '/settings', label: 'Settings', icon: Settings, phase: 9 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: health } = useHealth();
  const { data: auth } = useAuthStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const online = health?.status === 'ok';
  const active = NAV_ITEMS.find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  );

  // Close menu when pathname changes (navigation occurred)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Top navigation items (desktop + mobile menu)
  const topNavItems = NAV_ITEMS.slice(0, 9);
  // Bottom navigation items (mobile only - most frequent)
  const bottomNavItems = [
    NAV_ITEMS[0],
    NAV_ITEMS[1],
    NAV_ITEMS[6],
    NAV_ITEMS[7],
    NAV_ITEMS[8],
  ] as const;

  const handleOverlayClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className={`app-shell ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
      {/* Overlay - Click to close */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`} role="navigation" aria-label="Site navigation">
        <div className="sidebar-header">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <Activity size={18} strokeWidth={2.2} />
            </span>
            <span>
              <strong>ATC</strong>
              <small>Trading Command</small>
            </span>
          </Link>

          <button
            className="mobile-menu-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            aria-expanded={mobileMenuOpen}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {topNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={16} strokeWidth={1.9} />
                <span>{item.label}</span>
                {item.phase > 1 && <span className="nav-phase">P{item.phase}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="safety-chip">
            <ShieldCheck size={15} />
            <span>Research mode</span>
          </div>
          <p>Live execution disabled</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">AI Trading Command Centre</span>
            <h1>{active?.label ?? 'Workspace'}</h1>
          </div>
          <div className="topbar-meta">
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu size={24} />
            </button>
            <span className={`status-dot ${online ? 'ok' : 'error'}`} aria-hidden />
            <span>{online ? 'API online' : 'API offline'}</span>
            {health && (
              <span className="mono muted">
                {health.checks.database.latencyMs.toFixed(1)} ms db
              </span>
            )}
            {auth?.user && <span className="user-chip">{auth.user.username}</span>}
          </div>
        </header>

        {auth?.warning && (
          <div className="banner warning" role="status">
            <ShieldCheck size={16} />
            <span>{auth.warning}</span>
          </div>
        )}

        <main className="content">{children}</main>

        {/* Mobile Bottom Navigation */}
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
              >
                <Icon size={24} strokeWidth={1.8} />
                <span className="bottom-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
