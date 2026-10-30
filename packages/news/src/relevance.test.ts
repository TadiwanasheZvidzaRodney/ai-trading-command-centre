import { describe, expect, it } from 'vitest';
import { tagNews } from './relevance';

describe('news relevance tagging', () => {
  it('tags gold and USD stories for the gold instrument', () => {
    const result = tagNews('Gold rises as the Fed signals cuts', 'Bullion gained after FOMC remarks.');
    expect(result.currencies).toContain('XAU');
    expect(result.currencies).toContain('USD');
    expect(result.instruments).toContain('XAU/USD');
    expect(result.relevance).toBeGreaterThan(0);
    expect(result.tags).toContain('gold');
    expect(result.tags).toContain('fed');
  });

  it('maps EUR stories to EUR/USD only', () => {
    const result = tagNews('ECB holds rates', 'Lagarde said the euro area outlook is uncertain.');
    expect(result.currencies).toEqual(['EUR']);
    expect(result.instruments).toEqual(['EUR/USD']);
  });

  it('does not match short keywords inside longer words', () => {
    const result = tagNews('Ukraine grain exports rise', 'No currency story here.');
    expect(result.currencies).not.toContain('GBP');
    expect(result.instruments).toHaveLength(0);
    expect(result.relevance).toBe(0);
  });

  it('does not tag unrelated countries from generic macro words', () => {
    const result = tagNews(
      'Malaysia: Policy rate seen on hold – DBS',
      'Bank Negara Malaysia is expected to keep rates steady as inflation and GDP stay contained.',
    );
    expect(result.currencies).toHaveLength(0);
    expect(result.instruments).toHaveLength(0);
    expect(result.relevance).toBe(0);
  });

  it('tags explicit US macro stories without matching the pronoun "us"', () => {
    const explicit = tagNews('US CPI rises more than expected', 'Inflation remains sticky.');
    expect(explicit.currencies).toEqual(['USD']);
    expect(explicit.instruments).toContain('EUR/USD');

    const pronoun = tagNews('Analysts told us to wait', 'They gave us no detail.');
    expect(pronoun.currencies).toHaveLength(0);
  });

  it('caps relevance at 100', () => {
    const result = tagNews(
      'Dollar euro pound gold Fed FOMC Powell treasury inflation CPI GDP ECB BoE',
      'Dollar euro pound gold Fed FOMC Powell treasury inflation CPI GDP ECB BoE',
    );
    expect(result.relevance).toBe(100);
  });
});
