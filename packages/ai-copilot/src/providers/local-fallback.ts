import type { HealthCheckResult } from '../types.js';
import { BaseAIProvider } from './base.js';

export class LocalFallbackProvider extends BaseAIProvider {
  name = 'local-fallback';

  async available(): Promise<boolean> {
    return true;
  }

  async analyze(prompt: string, temperature?: number): Promise<string> {
    return this.generateFactsOnlyReport(prompt);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'ok',
      latencyMs: 0,
      message: 'Fallback always available (no AI model)',
    };
  }

  private generateFactsOnlyReport(prompt: string): string {
    // Extract facts from evidence markers
    const dataStartIdx = prompt.indexOf('[DATA START]');
    const dataEndIdx = prompt.indexOf('[DATA END]');

    let factsSection = '';

    if (dataStartIdx !== -1 && dataEndIdx !== -1 && dataStartIdx < dataEndIdx) {
      const jsonStr = prompt.substring(dataStartIdx + '[DATA START]'.length, dataEndIdx).trim();

      try {
        const evidence = JSON.parse(jsonStr);
        factsSection = this.formatEvidenceFacts(evidence);
      } catch (error) {
        this.log.warn({ error }, 'Failed to parse evidence JSON');
        factsSection = 'Could not parse evidence data.';
      }
    }

    return `# Analysis Report (Facts Only)

> **Note:** AI model unavailable. This report contains factual data extracted from technical analysis only.

## Market Data
${factsSection}

## Limitations
- **This is not an analysis** - it is raw factual data only
- No AI interpretation or pattern synthesis
- No trading recommendations provided
- Based on snapshot data at analysis time only

**IMPORTANT:** This report should not be used as a basis for any trading decisions.

---

## Disclaimer

**NEVER use this analysis as the sole basis for trading decisions.** This report:
- Contains no position sizing or risk management guidance
- Does not account for your account size or risk tolerance
- Cannot predict sudden market moves or gaps
- Is not a recommendation and should be combined with your own research

**Trade at your own risk. You can lose more than you risk.**`;
  }

  private formatEvidenceFacts(evidence: Record<string, unknown>): string {
    const parts: string[] = [];

    if (evidence.instrument) {
      parts.push(`- **Instrument:** ${evidence.instrument}`);
    }
    if (evidence.timeframe) {
      parts.push(`- **Timeframe:** ${evidence.timeframe}`);
    }

    if (evidence.quote && typeof evidence.quote === 'object') {
      const quote = evidence.quote as Record<string, unknown>;
      parts.push(`- **Quote:**`);
      parts.push(`  - Bid: ${quote.bid}`);
      parts.push(`  - Ask: ${quote.ask}`);
      parts.push(`  - Mid: ${quote.mid}`);
      parts.push(`  - Spread: ${quote.spread}`);
    }

    if (evidence.structure && typeof evidence.structure === 'object') {
      const structure = evidence.structure as Record<string, unknown>;
      parts.push(`- **Structure:**`);
      parts.push(`  - Trend: ${structure.trend}`);
      parts.push(`  - Trend Strength: ${structure.trend_strength}`);
    }

    if (
      Array.isArray(evidence.indicators_used) &&
      evidence.indicators_used.length > 0
    ) {
      parts.push(`- **Indicators Used:** ${evidence.indicators_used.join(', ')}`);
    }

    if (
      Array.isArray(evidence.patterns_detected) &&
      evidence.patterns_detected.length > 0
    ) {
      parts.push(`- **Patterns Detected:** ${evidence.patterns_detected.length} pattern(s)`);
    }

    return parts.length > 0 ? parts.join('\n') : 'No evidence data available';
  }
}
