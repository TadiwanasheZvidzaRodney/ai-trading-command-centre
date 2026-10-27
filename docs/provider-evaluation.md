# Provider Evaluation

**Evaluation date:** 2026-10-27
**Budget:** $0
**Instruments:** XAU/USD, EUR/USD, GBP/USD

This document records what was actually verified from this development environment, what
is documented by providers, and what remains unverified. It is deliberately conservative:
a source is not "trading-grade" just because it responds to HTTP.

## 1. Requirements

A market-data provider must supply:

- XAU/USD, EUR/USD and GBP/USD coverage with unambiguous symbols.
- OHLCV candles with reliable timestamps and enough history for indicators.
- Bid/ask or a clearly labelled mid-only quote.
- Reasonable rate limits for a single-user app.
- Terms that permit personal research use (or a documented free tier).
- A failure mode that is visible and does not fabricate values.

## 2. Summary

| Provider | Data | Auth | Cost | Status | Quality tier |
| --- | --- | --- | --- | --- | --- |
| Swissquote public feed | Quotes for all three, bid/ask | None | Free | **Verified working** | Reference (undocumented public feed) |
| Yahoo Finance chart | OHLCV for EUR/USD, GBP/USD, `GC=F` gold futures | None | Free | **Verified working** | Reference; `GC=F` is a proxy for XAU/USD |
| Twelve Data | Direct XAU/USD and FX candles/quotes | API key | Free tier | Adapter implemented; **not verified without key** | Intended production upgrade |
| OANDA practice | Direct XAU/USD/FX pricing and candles | Token + account | Free practice | Adapter implemented; **not verified without account** | Intended production upgrade |
| Forex Factory community JSON | Economic calendar (current week) | None | Free | **Verified working** | Reference; unofficial mirror |
| FXStreet RSS | News | None | Free | **Verified working** | Reference |
| MarketWatch RSS | News | None | Free | **Verified working** | Reference |
| ECB / Fed / BoE / BBC RSS | Official/primary news | None | Free | **Verified working** | Primary/reference |
| Ollama | Local LLM narrative | None | Free (local compute) | Not installed here | Optional |
| Gemini API | LLM narrative | API key | Free tier | Adapter implemented; **not verified without key** | Optional |

## 3. Verified market-data endpoints

### 3.1 Swissquote public quotes

```
GET https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD
GET https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/EUR/USD
GET https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/GBP/USD
```

Observed on 2026-10-27:

- HTTP 200 for all three.
- JSON array with `topo.platform`, `topo.server`, `ts` (epoch ms) and
  `spreadProfilePrices[]` containing `spreadProfile`, `bidSpread`, `askSpread`, `bid`,
  `ask`.
- Multiple platforms/servers per instrument. The adapter selects the tightest spread
  and records the platform/server in provenance.
- XAU/USD returned a bid/ask around 4009.47/4010.14, with `ts` matching the retrieval
  time.

Caveats:

- This is a public website feed, not a documented partner API.
- No SLA, no guaranteed latency, no historical data.
- Terms of use must be reviewed before public deployment. Personal/local reference use
  only for now.
- It is labelled `reference` in the UI and cannot enable live trading.

### 3.2 Yahoo Finance chart

```
GET https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=5d
GET https://query1.finance.yahoo.com/v8/finance/chart/GBPUSD=X?interval=1d&range=5d
GET https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=5d
```

Observed:

- HTTP 200 for all three; JSON `chart.result[0].timestamp[]` and
  `indicators.quote[0].open/high/low/close/volume`.
- `XAUUSD=X` returned HTTP 404; there is no verified spot XAU/USD symbol on this
  endpoint.
- `GC=F` returned COMEX gold futures data. It is **not** spot XAU/USD; the app labels
  it as a proxy and shows a warning.
- Meta includes exchange timezone and `regularMarketTime`.

Caveats:

- Unofficial public endpoint; terms and stability are not guaranteed.
- Daily data has weekend gaps (expected). Intraday history depth varies.
- Volume for FX is often zero/absent; do not treat it as reliable FX volume.

### 3.3 Twelve Data (upgrade path)

Documented free tier (verify current terms before relying on it):

- REST API with `time_series` and `quote` endpoints.
- Supports forex and metals symbols such as `XAU/USD`.
- Free tier historically limited to ~800 API credits/day and ~8 requests/minute.
- Requires an API key; no key is configured here, so no live response was verified.

Adapter behaviour without a key: `not_configured`; no fallback to fabricated data.

### 3.4 OANDA practice (upgrade path)

Documented practice environment:

- `https://api-fxpractice.oanda.com/v3/...`
- Candles: `/v3/instruments/XAU_USD/candles?granularity=D&count=...`
- Pricing: `/v3/accounts/{accountId}/pricing?instruments=XAU_USD,EUR_USD,GBP_USD`
- Requires a free practice account, personal access token and account id.
- Free demo account; no real funds required.
- Not verified here because no account exists.

Adapter behaviour without credentials: `not_configured`.

### 3.5 Rejected / unavailable sources

| Source | Observed | Decision |
| --- | --- | --- |
| Stooq CSV | HTTP 200 but returned a JavaScript bot challenge, not CSV | Not used |
| FRED CSV | Request timed out from this environment | Not used; key-based API is a later option |
| Trading Economics guest | HTTP 410 Gone | Not used |
| TradingView economic calendar | HTTP 403 | Not used |
| Forex Factory HTML | HTTP 403 | Use the community JSON mirror with caveats |
| Goldprice.org JSON | HTTP 403 | Not used |
| LBMA JSON | HTTP 403 | Not used |
| Alpha Vantage demo | Demo key only; no usable free response for XAU | Deferred |
| FMP demo | HTTP 401 | Deferred |

## 4. News sources

Verified RSS feeds:

| Source | URL | Observed |
| --- | --- | --- |
| FXStreet | `https://www.fxstreet.com/rss/news` | HTTP 200, RSS 2.0 |
| MarketWatch top stories | `https://feeds.content.dowjones.io/public/rss/mw_topstories` | HTTP 200, RSS |
| ECB press | `https://www.ecb.europa.eu/rss/press.html` | HTTP 200, RSS |
| Federal Reserve press | `https://www.federalreserve.gov/feeds/press_all.xml` | HTTP 200, RSS |
| Bank of England news | `https://www.bankofengland.co.uk/rss/news` | HTTP 200, RSS |
| BBC Business | `https://feeds.bbci.co.uk/news/business/rss.xml` | HTTP 200, RSS |

Rules:

- Store headline, short summary, canonical link, publisher, published time and fetched
  time. Do not store full article bodies.
- Deduplicate by canonical URL and normalised title.
- A sentiment/relevance score is not a price prediction.
- Review each publisher's terms before public deployment.

## 5. Economic calendar

Verified:

```
GET https://nfs.faireconomy.media/ff_calendar_thisweek.json
```

Observed: HTTP 200, JSON array with `title`, `country`, `date` (ISO with offset),
`impact`, `forecast`, `previous`. No `actual` field. The "next week" URL returned 404
during evaluation.

Caveats:

- Unofficial community mirror of Forex Factory data.
- Current week only.
- Times include an offset; normalise to UTC and display in the user's timezone.
- Impact labels are source metadata, not a guarantee of market reaction.
- Verify high-impact events against the primary statistical agency before trading.

## 6. AI providers

| Provider | Auth | Cost | Notes |
| --- | --- | --- | --- |
| Ollama | None (local) | Free compute | Requires local installation and a model; not installed in this environment. |
| Gemini API | API key | Free tier (limits apply) | Hosted; requires account and key. |
| OpenAI-compatible | Base URL + key | Varies | Supports OpenRouter/Groq/local LM Studio-style endpoints. |

AI is optional. The deterministic analysis pipeline runs without a model. AI output is
schema-validated and never has order authority.

## 7. Recommendation

1. **Ship the free reference tier now** for development and personal research:
   Swissquote quotes + Yahoo candles + RSS news + community calendar.
2. **Label every limitation** (gold proxy, delayed/reference tier, current-week calendar,
   unofficial feeds).
3. **Add Twelve Data or OANDA practice** as the first paid/account upgrade for direct
   XAU/USD history and intraday candles.
4. **Do not describe any of these sources as trading-grade** until a provider with
   documented SLA, licensing and verified instrument coverage is in place.
5. **Re-check terms, limits and endpoints** before public deployment or any live use.

## 8. Verification log

| Date | Check | Result |
| --- | --- | --- |
| 2026-10-27 | Swissquote XAU/USD, EUR/USD, GBP/USD quotes | 200, bid/ask + timestamps |
| 2026-10-27 | Yahoo `EURUSD=X`, `GBPUSD=X`, `GC=F` | 200, OHLCV |
| 2026-10-27 | Yahoo `XAUUSD=X` | 404 |
| 2026-10-27 | Forex Factory weekly JSON | 200, fields present, no actual |
| 2026-10-27 | RSS feeds (six) | 200, valid XML |
| 2026-10-27 | Stooq CSV | Bot challenge, not usable |
| 2026-10-27 | Trading Economics guest | 410 |
| 2026-10-27 | TradingView calendar | 403 |
| 2026-10-27 | Twelve Data / OANDA | Not tested (no credentials) |
| 2026-10-27 | Ollama | Not installed |
