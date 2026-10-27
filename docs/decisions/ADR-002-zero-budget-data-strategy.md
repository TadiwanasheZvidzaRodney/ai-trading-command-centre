# ADR-002: Zero-Budget Data Strategy

- **Status:** Accepted
- **Date:** 2026-10-27
- **Deciders:** Project owner

## Context

The application must run at **$0** and start without any API keys. It still must use
real data and never fabricate values. The initial instruments are XAU/USD, EUR/USD and
GBP/USD. Historical candles, bid/ask quotes, news and economic events are required for
the research workflow.

A free source is acceptable for development and personal research if:

- it returns real observations with timestamps;
- its limitations are visible in the UI;
- it is behind a replaceable adapter;
- it is not presented as trading-grade or guaranteed real-time.

## Decision

Use the following **free, no-key** sources as the initial reference tier:

| Data | Adapter | Endpoint | Caveat |
| --- | --- | --- | --- |
| Quotes | Swissquote public feed | `forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/{BASE}/{QUOTE}` | Undocumented public website feed; latency/terms not guaranteed; reference only. |
| Candles (EUR/USD, GBP/USD) | Yahoo chart | `query1.finance.yahoo.com/v8/finance/chart/{symbol}` | Unofficial endpoint; reference data. |
| Candles (XAU/USD) | Yahoo `GC=F` | same | COMEX gold futures **proxy**, not spot XAU/USD; must be labelled. |
| News | Public RSS | FXStreet, MarketWatch, ECB, Fed, BoE, BBC Business | Headline + link + summary only; terms vary. |
| Calendar | Forex Factory community JSON | `nfs.faireconomy.media/ff_calendar_thisweek.json` | Current week only; no actual values; unofficial mirror. |
| AI narrative | Ollama local or Gemini free tier | local / Google API | Optional; disabled by default; deterministic reports still work. |

Optional upgrade adapters (implemented, disabled without credentials):

- **Twelve Data** free tier for direct XAU/USD candles and quotes.
- **OANDA practice** for direct XAU/USD/EUR/USD/GBP/USD candles and pricing.

## Why these sources

- Swissquote returned real bid/ask for all three instruments during verification,
  including a provider timestamp and multiple spread profiles.
- Yahoo returned OHLCV candles for `EURUSD=X`, `GBPUSD=X` and `GC=F`; it had no
  `XAUUSD=X` symbol, so gold history is explicitly a futures proxy.
- The RSS feeds returned valid XML with publication timestamps.
- The Forex Factory JSON returned this week's events with title, currency, time,
  impact, forecast and previous values.
- All of the above worked without an account or key.

## Rejected or deferred

| Source | Reason |
| --- | --- |
| Stooq CSV | Returned a JavaScript bot challenge instead of CSV from this environment. |
| FRED CSV | Timed out from this environment; also requires a key for the API. |
| Trading Economics guest API | Returned HTTP 410. |
| TradingView calendar endpoint | Returned HTTP 403. |
| Forex Factory HTML | Returned HTTP 403; the community JSON mirror is used instead. |
| Goldprice.org / LBMA JSON | Returned HTTP 403. |
| NewsAPI free tier | Requires a key and has development-only restrictions. |
| Scraping restricted sites | Not permitted by project rules. |

## Guardrails

1. The UI always displays provider, observation time, age and quality tier.
2. Proxy data is flagged in the API and UI; it is never labelled spot XAU/USD.
3. A missing key or failed fetch produces an explicit `not_configured`/`error` state.
4. No silent fallback to sample data. Tests may use fixtures, but fixtures never enter
   a live response.
5. Provider terms are reviewed before public deployment. Personal local use only for
   the reference tier.
6. The reference tier cannot enable live trading. Live execution remains unimplemented.

## Upgrade path

When the owner creates accounts:

1. Add a **Twelve Data** free key for direct XAU/USD history and quotes.
2. Or open a free **OANDA practice** account for direct pricing and candles.
3. Set `MARKET_DATA_CANDLE_PROVIDER` / `MARKET_DATA_QUOTE_PROVIDER` and the relevant
   key in `.env`.
4. Verify the provider returns the required instrument, timestamps and history depth.
5. The UI should automatically stop showing the gold proxy warning.

## Consequences

- The app is usable immediately at $0 with honest caveats.
- Gold intraday history is limited until a direct provider is configured.
- Public feeds can change or block access without notice; adapters must fail visibly.
- Provider licensing and rate limits must be re-checked before any public deployment.
