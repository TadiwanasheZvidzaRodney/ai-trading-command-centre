# Data Flow

**Status:** Phase 0 baseline; updated with implementation.
**Last updated:** 2026-10-27

## 1. Market quotes

```
Scheduler / API request
  -> provider registry (configured quote provider)
  -> adapter fetch (timeout, retry, rate limit)
  -> normalise symbol, bid/ask/mid, timestamp, provider metadata
  -> quality checks: non-negative, bid <= ask, timestamp parse, freshness
  -> cache (short TTL) + upsert latest quote in MongoDB
  -> API response with provenance + freshness
  -> UI badge: provider, time, age, stale/delayed/proxy
```

Rules:

- A failed fetch never replaces the last good quote with a fabricated value. The last
  good quote may be returned with `stale: true` and its original timestamp.
- Bid/ask are preserved when available. If a provider only supplies a mid price, the
  quote is labelled `no bid/ask`.
- The quote's `observedAt` is the provider timestamp, not the request time. `fetchedAt`
  is recorded separately.

## 2. Historical candles

```
API request (instrument, timeframe, limit)
  -> cache lookup
  -> provider adapter (Yahoo chart / Twelve Data / OANDA)
  -> parse OHLCV, timestamps to UTC, numeric validation
  -> sort ascending, drop duplicates, flag gaps
  -> persist to candles collection (idempotent upsert)
  -> return series + quality metadata
```

Look-ahead protection:

- Indicators only use candles at or before the evaluation timestamp.
- Backtests enter on the **next** bar after a signal, never the signal bar's close.
- The analysis report records the exact candle window and input hash.

Gold history caveat:

- With no key, XAU/USD candles come from Yahoo `GC=F` (COMEX gold futures). The API
  returns `proxy: true`, `proxyFor: "XAU/USD"` and a human-readable note. The UI shows a
  persistent warning. This is context, not spot XAU/USD.
- With a Twelve Data or OANDA key, the direct XAU/USD adapter is used and the proxy
  warning disappears.

## 3. News ingestion

```
Scheduler (every N minutes)
  -> fetch each configured RSS feed (timeout, ETag/Last-Modified where available)
  -> parse title, link, publishedAt, source, summary
  -> strip HTML, truncate summary, canonicalise URL
  -> dedupe by canonical URL and normalised-title hash
  -> relevance: currencies/instruments from keywords and source tags
  -> upsert news_items
  -> API feed sorted by publishedAt
```

Only headline, short summary, link and metadata are stored. Full article text is not
copied. AI summaries are stored separately and labelled as generated.

## 4. Economic calendar

```
Scheduler (hourly)
  -> fetch community calendar JSON
  -> parse event time with its offset -> UTC
  -> normalise impact, currency, forecast/previous/actual
  -> dedupe by source + title + scheduledAt
  -> upsert calendar_events
  -> API returns events in UTC + user timezone
  -> UI groups by day, highlights high-impact events
```

The initial free feed covers the current week and omits actual values. The UI states
this limitation and links to primary sources for verification.

## 5. Deterministic analysis

```
Analysis request (instrument, timeframe)
  -> validate freshness/completeness of candles and quote
  -> calculate indicators and market structure (technical-analysis package)
  -> evaluate configured strategy rules
  -> attach upcoming events and relevant news
  -> build evidence bundle with timestamps and source ids
  -> risk/event filters (no order authority)
  -> deterministic scenario report (always available)
  -> optional AI narrative (if configured), validated against schema
  -> store analysis + input snapshot hash
  -> API/UI report with facts, calculations, interpretation and limitations
```

The report separates:

1. **Facts:** quotes/candles, provider, timestamps.
2. **Calculations:** indicator values, levels, volatility, RR.
3. **Interpretation:** trend/scenario narrative, AI or deterministic.
4. **Limitations:** missing/stale data, proxy data, event risk.

## 6. Trade planning and risk

```
User proposal (instrument, side, entry, stop, target, risk %)
  -> schema validation
  -> risk engine:
       account equity + open risk + daily P&L
       instrument contract specs
       position size (Decimal, lot step, min/max)
       RR, spread, volatility, event blackout, kill switch
  -> accept: return size, risk amount, RR, warnings
  -> reject: return structured reasons; nothing is stored as executable
```

The UI never computes the authoritative size. It displays the server result.

## 7. Paper trading

```
Order request (idempotency key)
  -> auth + CSRF + schema validation
  -> risk engine (hard limits, fail closed)
  -> create paper_order (pending)
  -> market order: fill at ask/bid + configured slippage
     limit order: wait for quote to cross
  -> position monitor checks stop/target on fresh quotes
  -> close -> P&L, R multiple, costs, journal entry
  -> performance analytics
```

No broker API is called. A paper fill is explicitly labelled simulated.

## 8. Backtesting

```
Backtest request (instrument, timeframe, date range, strategy config, costs)
  -> load candles (fail if insufficient)
  -> split development/validation/out-of-sample
  -> event loop:
       signal at bar close
       enter next bar open + spread/slippage
       size with risk engine
       stop/target with conservative intrabar assumption
       record every trade and configuration hash
  -> metrics: trades, expectancy, net return, profit factor, max drawdown,
     average win/loss, exposure, cost sensitivity
  -> store run for reproducibility
```

No parameter is described as "optimal" or "profitable" without out-of-sample and
cost-sensitivity evidence.

## 9. Scheduling and caching

| Job | Default | Notes |
| --- | --- | --- |
| Quote refresh | 20 s | Only while the API is running; cache TTL 15 s |
| News ingestion | 15 min | ETag/Last-Modified when available |
| Calendar ingestion | 60 min | Weekly feed |
| Paper monitor | 20 s | Uses fresh quotes; skips stale quotes |
| Health snapshot | 60 s | Provider latency/error state |

Caches are in-process and bounded. MongoDB is the durable store. The scheduler can be
disabled with `ENABLE_SCHEDULER=false` for tests and read-only deployments.

## 10. Data quality checks

- Reject NaN/Infinity, negative prices, high < low, open/close outside [low, high].
- Reject duplicate timestamps after normalisation; keep the latest revision.
- Sort ascending before calculations.
- Flag stale quotes by age threshold (per provider quality tier).
- Flag candle gaps (weekends are expected for daily FX/gold data).
- Flag proxy data and unverified community feeds.
- Never silently downgrade a provider or substitute sample data.
