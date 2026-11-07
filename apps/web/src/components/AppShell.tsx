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
import { useCallback, useEffect, useState } from 'react';
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

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Close menu on pathname change. Resetting transient UI state when the route
  // changes is intentional here; it is not derived render output.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll and listen for Escape key when menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen, closeMenu]);

  // Bottom navigation items (mobile only - most frequent)
  const bottomNavItems = [
    NAV_ITEMS[0],
    NAV_ITEMS[1],
    NAV_ITEMS[6],
    NAV_ITEMS[7],
    NAV_ITEMS[8],
  ] as const;

  return (
    <div className={`app-shell ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Drawer Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeMenu}
          onTouchEnd={closeMenu}
          role="button"
          tabIndex={0}
          aria-label="Close navigation drawer"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') closeMenu();
          }}
        />
      )}

      {/* Navigation Sidebar / Mobile Drawer */}
      <aside
        className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}
        role="navigation"
        aria-label="Site navigation"
      >
        <div className="sidebar-header">
          <Link href="/" className="brand" onClick={closeMenu}>
            <span className="brand-mark">
              <Activity size={18} strokeWidth={2.2} />
            </span>
            <span>
              <strong>ATC</strong>
              <small>Trading Command</small>
            </span>
          </Link>

          <button
            type="button"
            className="mobile-menu-close"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={closeMenu}
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

      {/* Main Workspace Area */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <Link href="/" className="mobile-brand" onClick={closeMenu}>
              <span className="brand-mark">
                <Activity size={16} strokeWidth={2.2} />
              </span>
              <span className="mobile-brand-name">ATC</span>
            </Link>

            <span className="topbar-divider" aria-hidden="true" />

            <div className="topbar-heading">
              <span className="eyebrow">AI Trading Command</span>
              <h1>{active?.label ?? 'Workspace'}</h1>
            </div>
          </div>

          <div className="topbar-meta">
            <span
              className={`status-dot ${online ? 'ok' : 'error'}`}
              title={online ? 'API online' : 'API offline'}
              aria-label={online ? 'API online' : 'API offline'}
            />
            <span className="topbar-status-text">{online ? 'API online' : 'API offline'}</span>
            {health && (
              <span className="mono muted topbar-latency">
                {health.checks.database.latencyMs.toFixed(1)} ms db
              </span>
            )}
            {auth?.user && <span className="user-chip">{auth.user.username}</span>}

            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
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
                onClick={closeMenu}
              >
                <Icon size={22} strokeWidth={1.8} />
                <span className="bottom-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
