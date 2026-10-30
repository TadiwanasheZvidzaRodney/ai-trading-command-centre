'use client';

import type { Structure, PatternDetection } from '@atc/technical-analysis';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatIndicator, formatTime, formatTrend, getTrendLabel } from '@/lib/format';

export function StructurePanel({ structure }: { structure: Structure | null }) {
  if (!structure) {
    return (
      <div className="empty-state">
        <h3>No structure data</h3>
        <p>Structure analysis will appear once technical indicators are loaded.</p>
      </div>
    );
  }

  const { trend, support_levels, resistance_levels, swing_high, swing_low } = structure;

  return (
    <div className="structure-panel">
      {/* Trend Box */}
      <section className="structure-section">
        <h4 className="section-title">Trend</h4>
        <div className="trend-box">
          <div className="trend-header">
            <span className="trend-icon">
              {trend.direction === 'up' ? (
                <TrendingUp size={20} color="#34d399" />
              ) : trend.direction === 'down' ? (
                <TrendingDown size={20} color="#f87171" />
              ) : (
                <div style={{ width: 20, height: 20, color: '#60a5fa' }}>→</div>
              )}
            </span>
            <span className="trend-label">{getTrendLabel(trend.direction)}</span>
            <span className="trend-strength">
              Strength: <strong>{trend.strength.toFixed(0)}</strong>
            </span>
          </div>
          <div className="trend-details">
            <div className="detail-row">
              <span className="detail-label">Start Price</span>
              <span className="detail-value mono">{formatIndicator(trend.start_price, 4)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Started</span>
              <span className="detail-value mono">{formatTime(trend.start_timestamp)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Support Levels */}
      <section className="structure-section">
        <h4 className="section-title">Support Levels</h4>
        {support_levels.length === 0 ? (
          <div className="empty-levels">No support levels identified</div>
        ) : (
          <div className="levels-list">
            {support_levels
              .sort((a: any, b: any) => b.touches - a.touches)
              .map((level: any, idx: number) => (
                <div key={idx} className="level-item">
                  <div className="level-price mono">{formatIndicator(level.price, 4)}</div>
                  <div className="level-meta">
                    <span className="badge">{level.touches} touches</span>
                    <span className="muted text-xs">
                      Last bounce: {formatTime(level.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Resistance Levels */}
      <section className="structure-section">
        <h4 className="section-title">Resistance Levels</h4>
        {resistance_levels.length === 0 ? (
          <div className="empty-levels">No resistance levels identified</div>
        ) : (
          <div className="levels-list">
            {resistance_levels
              .sort((a: any, b: any) => b.touches - a.touches)
              .map((level: any, idx: number) => (
                <div key={idx} className="level-item">
                  <div className="level-price mono">{formatIndicator(level.price, 4)}</div>
                  <div className="level-meta">
                    <span className="badge">{level.touches} touches</span>
                    <span className="muted text-xs">
                      Last touch: {formatTime(level.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Swing High/Low */}
      <section className="structure-section">
        <h4 className="section-title">Recent Swings</h4>
        <div className="swings-grid">
          {swing_high && (
            <div className="swing-box swing-high">
              <span className="swing-label">Swing High</span>
              <span className="swing-price mono">{formatIndicator(swing_high.price, 4)}</span>
              <span className="swing-time text-xs muted">{formatTime(swing_high.timestamp)}</span>
            </div>
          )}
          {swing_low && (
            <div className="swing-box swing-low">
              <span className="swing-label">Swing Low</span>
              <span className="swing-price mono">{formatIndicator(swing_low.price, 4)}</span>
              <span className="swing-time text-xs muted">{formatTime(swing_low.timestamp)}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
