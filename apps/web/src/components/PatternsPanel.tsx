'use client';

import type { PatternDetection } from '@atc/technical-analysis';
import { formatIndicator } from '@/lib/format';

const PATTERN_NAMES: Record<string, string> = {
  engulfing_bull: 'Bullish Engulfing',
  engulfing_bear: 'Bearish Engulfing',
  pinbar_bull: 'Bullish Pin Bar',
  pinbar_bear: 'Bearish Pin Bar',
  three_inside_up: 'Three Inside Up',
  three_inside_down: 'Three Inside Down',
  hammer: 'Hammer',
  inverted_hammer: 'Inverted Hammer',
  doji: 'Doji',
  morning_star: 'Morning Star',
  evening_star: 'Evening Star',
};

export function PatternsPanel({ patterns }: { patterns: PatternDetection[] | null }) {
  if (!patterns || patterns.length === 0) {
    return (
      <div className="empty-state">
        <h3>No patterns detected</h3>
        <p>Pattern detection results will appear here when patterns are found.</p>
      </div>
    );
  }

  const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="patterns-panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Candle Index</th>
              <th>Confidence</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((pattern, idx) => (
              <tr key={idx}>
                <td className="font-medium">{PATTERN_NAMES[pattern.pattern] || pattern.pattern}</td>
                <td className="mono text-center">{pattern.index}</td>
                <td>
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{
                        width: `${pattern.confidence}%`,
                        backgroundColor:
                          pattern.confidence >= 80
                            ? '#34d399'
                            : pattern.confidence >= 60
                              ? '#fbbf24'
                              : '#60a5fa',
                      }}
                    />
                  </div>
                  <span className="mono text-xs">{formatIndicator(pattern.confidence, 1)}%</span>
                </td>
                <td className="text-xs muted">{pattern.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
