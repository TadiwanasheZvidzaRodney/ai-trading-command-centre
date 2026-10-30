import pino from 'pino';
import type { Evidence } from '../types.js';

const logger = pino();

export class ReportFormatter {
  formatAnalysisReport(modelResponse: string, evidence: Evidence): string {
    try {
      const ageMinutes = this.getAgeMinutes(evidence.quote.fetched_at);
      const generatedAt = new Date().toISOString();

      return `${modelResponse}

---

## Data Freshness & Context

- **Quote Age:** ${ageMinutes} minutes (as of ${evidence.quote.fetched_at})
- **Latest Candle:** ${evidence.latest_candle_time}
- **Candles Analyzed:** ${evidence.candle_count}
- **Analysis Generated:** ${generatedAt}

## Technical Setup

**Indicators Used:** ${evidence.indicators_used.join(', ') || 'None specified'}

**Patterns Detected:** ${evidence.patterns_detected.length} pattern(s)
${this.formatPatterns(evidence.patterns_detected)}

**Trend Structure:** ${evidence.structure.trend} (strength: ${(evidence.structure.trend_strength * 100).toFixed(0)}%)

**Resistance Levels:**
${this.formatLevels(evidence.structure.resistance_levels)}

**Support Levels:**
${this.formatLevels(evidence.structure.support_levels)}

## Market Events

${this.formatMacroEvents(evidence.macro_events)}

## Important Limitations

- **This is analysis, not a recommendation.** Do not treat it as trading advice.
- **Indicators are lagging**, showing past price action not predicting future moves
- **Patterns don't guarantee outcomes.** Historical patterns have no predictive power
- **No backtesting evidence** of any edge or strategy validity
- **AI interpretation may miss context** - always verify signals yourself
- **Quote data is ${ageMinutes} minutes old** - live prices may differ significantly
- **Correlation and regime changes** can invalidate the entire setup

## Invalidation Conditions

- Trends reverse if price breaks key support/resistance levels with volume
- Major macro events (central bank decisions, data misses) can invalidate thesis overnight
- Indicator divergence patterns break if correlated assets move differently
- Market structure invalidates if price makes new highs/lows beyond swing levels

## Disclaimer

**NEVER use this analysis as the sole basis for trading decisions.** This report:
- Contains no position sizing or risk management guidance
- Does not account for your account size or risk tolerance
- Cannot predict sudden market moves or gaps
- Should be combined with your own research and risk controls

**Trade at your own risk. You can lose more than you risk.**`;
    } catch (error) {
      logger.error({ error }, 'Failed to format analysis report');
      throw error;
    }
  }

  private getAgeMinutes(isoTime: string): number {
    try {
      const diff = Date.now() - new Date(isoTime).getTime();
      return Math.floor(diff / 60000);
    } catch {
      return -1;
    }
  }

  private formatPatterns(
    patterns: Array<{
      type: string;
      confidence: number;
      candle_index: number;
    }>
  ): string {
    if (patterns.length === 0) return '- No patterns detected';

    return patterns
      .map(
        p =>
          `- ${p.type} (confidence: ${(p.confidence * 100).toFixed(0)}%, candle: ${p.candle_index})`
      )
      .join('\n');
  }

  private formatLevels(
    levels: Array<{
      price: number;
      touches: number;
      recent_bounce?: string;
    }>
  ): string {
    if (levels.length === 0) return '- No levels identified';

    return levels
      .map(
        l =>
          `- ${l.price.toFixed(4)} (${l.touches} touch${l.touches !== 1 ? 'es' : ''}${l.recent_bounce ? `, recent bounce: ${l.recent_bounce}` : ''})`
      )
      .join('\n');
  }

  private formatMacroEvents(
    events: Array<{
      event: string;
      time: string;
      impact: 'high' | 'medium' | 'low';
      hours_until: number;
    }>
  ): string {
    if (events.length === 0) {
      return 'No upcoming events within lookback period.';
    }

    const sorted = [...events].sort((a, b) => a.hours_until - b.hours_until);

    return sorted
      .map(
        e =>
          `- **${e.event}** (${e.impact} impact, in ${e.hours_until.toFixed(1)}h) - ${e.time}`
      )
      .join('\n');
  }
}
