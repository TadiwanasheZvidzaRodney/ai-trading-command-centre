import { describe, expect, it } from 'vitest';
import { canonicalJson, canonicalUrl, normaliseTitle, stableHash } from './ids';

describe('id helpers', () => {
  it('canonicalises URLs by removing tracking parameters and fragments', () => {
    expect(canonicalUrl('https://Example.com/news/story/?utm_source=x&b=2#top')).toBe(
      'https://example.com/news/story?b=2',
    );
  });

  it('normalises titles for deduplication', () => {
    expect(normaliseTitle('  Gold  rallies — again! ')).toBe('gold rallies again');
  });

  it('produces stable canonical JSON regardless of key order', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });

  it('produces a deterministic stable hash', () => {
    expect(stableHash('hello')).toBe(stableHash('hello'));
    expect(stableHash('hello')).not.toBe(stableHash('hello!'));
  });
});
