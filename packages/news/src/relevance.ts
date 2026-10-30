import type { CurrencyCode, InstrumentSymbol } from '@atc/shared';

const CURRENCY_ORDER: readonly CurrencyCode[] = ['USD', 'EUR', 'GBP', 'XAU'];

/**
 * Strong keywords identify the currency or country directly. Only these can add
 * a currency to a story, which prevents generic macro words from tagging every
 * instrument.
 */
const STRONG_KEYWORDS: Record<CurrencyCode, string[]> = {
  USD: [
    'usd',
    'us',
    'u.s',
    'dollar',
    'united states',
    'america',
    'american',
    'federal reserve',
    'fed',
    'fomc',
    'powell',
    'treasury',
    'white house',
  ],
  EUR: [
    'eur',
    'euro',
    'ecb',
    'lagarde',
    'eurozone',
    'euro area',
    'germany',
    'german',
    'france',
    'french',
    'italy',
    'italian',
    'spain',
    'spanish',
  ],
  GBP: [
    'gbp',
    'pound',
    'sterling',
    'boe',
    'bank of england',
    'bailey',
    'uk',
    'britain',
    'british',
    'england',
  ],
  XAU: [
    'xau',
    'gold',
    'bullion',
    'precious metal',
    'safe haven',
    'central bank buying',
  ],
};

/** Macro keywords add weight only when the same currency is already identified. */
const MACRO_KEYWORDS: Record<CurrencyCode, string[]> = {
  USD: [
    'nonfarm',
    'payrolls',
    'cpi',
    'inflation',
    'gdp',
    'unemployment',
    'jobless',
    'retail sales',
    'ism',
    'pmi',
    'yield',
    'bond',
  ],
  EUR: ['cpi', 'inflation', 'gdp', 'pmi', 'yield', 'bond'],
  GBP: ['cpi', 'inflation', 'gdp', 'pmi', 'yield', 'bond'],
  XAU: ['real yield'],
};

const INSTRUMENTS: Record<CurrencyCode, InstrumentSymbol[]> = {
  USD: ['XAU/USD', 'EUR/USD', 'GBP/USD'],
  EUR: ['EUR/USD'],
  GBP: ['GBP/USD'],
  XAU: ['XAU/USD'],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordPattern(keyword: string): RegExp {
  // Short country codes are matched as uppercase so pronouns such as "us" do
  // not create a false USD tag.
  if (keyword === 'us') return /\bUS\b/;
  if (keyword === 'uk') return /\bUK\b/;
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
}

function matchCount(keywords: string[], title: string, summary: string, tags: Set<string>) {
  let titleMatches = 0;
  let summaryMatches = 0;
  for (const keyword of keywords) {
    const pattern = keywordPattern(keyword);
    const inTitle = pattern.test(title);
    const inSummary = pattern.test(summary);
    if (!inTitle && !inSummary) continue;
    tags.add(keyword);
    if (inTitle) titleMatches += 1;
    if (inSummary) summaryMatches += 1;
  }
  return { titleMatches, summaryMatches };
}

export interface NewsTagging {
  currencies: CurrencyCode[];
  instruments: InstrumentSymbol[];
  relevance: number;
  tags: string[];
}

/**
 * Deterministic keyword tagging. It is intentionally simple and auditable:
 * a match is a string match, not a sentiment judgement or a price prediction.
 */
export function tagNews(title: string, summary: string): NewsTagging {
  const currencies: CurrencyCode[] = [];
  const instruments = new Set<InstrumentSymbol>();
  const tags = new Set<string>();
  let score = 0;

  for (const currency of CURRENCY_ORDER) {
    const strong = matchCount(STRONG_KEYWORDS[currency], title, summary, tags);
    if (strong.titleMatches === 0 && strong.summaryMatches === 0) continue;

    const macro = matchCount(MACRO_KEYWORDS[currency], title, summary, tags);
    currencies.push(currency);
    for (const instrument of INSTRUMENTS[currency]) instruments.add(instrument);
    score += Math.min(
      60,
      strong.titleMatches * 25 +
        strong.summaryMatches * 10 +
        macro.titleMatches * 10 +
        macro.summaryMatches * 5,
    );
  }

  return {
    currencies,
    instruments: [...instruments],
    relevance: Math.min(100, score),
    tags: [...tags],
  };
}
