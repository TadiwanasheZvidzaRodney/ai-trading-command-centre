import pino from 'pino';
import type { Evidence } from '../types.js';

const logger = pino();

export class InputSanitizer {
  private forbiddenPatterns = [
    /ignore\s+instructions?/i,
    /disregard/i,
    /system\s*prompt/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /system\s*\(/i,
    /system\s*\(/i,
    /exec\s*command/i,
    /DROP\s+TABLE/i,
    /DELETE\s+FROM/i,
    /INSERT\s+INTO/i,
    /UPDATE\s+FROM/i,
    /UNION\s+SELECT/i,
  ];

  private maxStringLength = 500;
  private maxArrayLength = 100;

  sanitizeEvidence(evidence: Evidence): Evidence {
    try {
      return {
        ...evidence,
        instrument: this.sanitizeString(evidence.instrument),
        timeframe: this.sanitizeString(evidence.timeframe),
        recent_news_themes: this.sanitizeStringArray(evidence.recent_news_themes),
        macro_events: evidence.macro_events.map(e => ({
          ...e,
          event: this.sanitizeString(e.event),
        })),
        patterns_detected: evidence.patterns_detected.map(p => ({
          ...p,
          type: this.sanitizeString(p.type),
        })),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to sanitize evidence');
      throw error;
    }
  }

  private sanitizeString(str: string): string {
    // Remove control characters (intentional control-character class).
    // eslint-disable-next-line no-control-regex
    let cleaned = str.replace(/[\x00-\x1F\x7F]/g, ' ');

    // Check for forbidden patterns
    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(cleaned)) {
        logger.warn(
          { pattern: pattern.source, value: str },
          'Forbidden pattern detected, sanitizing'
        );
        cleaned = cleaned.replace(pattern, '');
      }
    }

    // Limit length
    if (cleaned.length > this.maxStringLength) {
      cleaned = cleaned.substring(0, this.maxStringLength);
    }

    return cleaned.trim();
  }

  private sanitizeStringArray(arr: string[]): string[] {
    if (!Array.isArray(arr)) return [];

    if (arr.length > this.maxArrayLength) {
      logger.warn(
        { length: arr.length, maxLength: this.maxArrayLength },
        'Array exceeds max length, truncating'
      );
    }

    return arr
      .slice(0, this.maxArrayLength)
      .map(item => (typeof item === 'string' ? this.sanitizeString(item) : ''))
      .filter(item => item.length > 0);
  }
}
