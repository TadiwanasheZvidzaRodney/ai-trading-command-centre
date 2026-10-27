# Test Strategy

**Last updated:** 2026-10-27

## 1. Principles

- Tests prove behaviour, not the presence of UI.
- Mocked providers prove adapter logic; they do **not** prove live-provider reliability.
- Fixtures must be clearly labelled, committed under `__fixtures__`, and never served by
  a running app as if they were live data.
- Financial calculations use fixed inputs and exact/tolerance assertions.
- Failure paths (stale data, missing provider, invalid AI output, risk breach) are
  tested as first-class cases.
- A command is reported as passing only when it was actually run.

## 2. Layers

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | Indicators, risk sizing, freshness, parsers, formatting, schemas |
| Contract | Vitest + fixtures | Provider response parsing and error handling |
| Integration | Vitest + Fastify `inject` | Routes, auth, CSRF, validation, persistence wiring |
| Frontend component | Vitest + Testing Library (later) | Loading/empty/error states, key interactions |
| End-to-end | Playwright (later) | Login, dashboard, chart, planner, paper order |
| Smoke | Scripts/CI | Build, start, health check against MongoDB |

## 3. Required coverage by domain

### Market data

- Parse valid quote/candle payloads.
- Reject NaN, negative prices, `high < low`, open/close outside range.
- Sort ascending and dedupe timestamps.
- Detect stale quotes and expected weekend gaps.
- Missing key -> `not_configured`; timeout -> error; no fabricated fallback.
- Gold proxy flag propagates to the API/UI.

### Technical analysis

- SMA/EMA/RSI/MACD/ATR/ADX against reference values.
- Insufficient history -> explicit error, not zeros.
- No look-ahead: a signal at bar `i` may only use bars `<= i`.
- Deterministic output for the same input.

### Risk engine

- Position size respects risk %, contract size, lot step, min/max volume.
- Reject when stop distance is zero, RR is below minimum, spread is too wide, daily loss
  is exceeded, open risk is exceeded, max positions is reached, or inputs are missing.
- Decimal rounding never increases risk beyond the limit.
- Kill switch blocks all new orders.

### Paper trading

- Market fill uses ask for buys, bid for sells, plus slippage.
- Limit order fills only when the quote crosses.
- Stop/target closes produce the expected P&L and R multiple.
- Idempotency key prevents duplicates.
- Stale quotes block fills.

### Backtesting

- Entry is next bar open, never the signal bar close.
- Spread/commission/slippage reduce net P&L.
- Conservative stop-first assumption when stop and target are both inside one bar.
- Metrics reconcile with the trade list.
- Stored configuration reproduces the same result.

### AI engine

- Invalid JSON/schema is rejected and recorded as failed.
- Prompt includes untrusted-data delimiters and no tools.
- AI output cannot call order functions (architecture test).
- Deterministic report works with AI disabled.
- Sources, timestamps, assumptions and invalidation conditions are present.

### Auth/security

- Login rate limit.
- Session cookie flags.
- CSRF required for mutations.
- Unauthenticated requests are rejected (when auth is enabled).
- Production refuses auth-disabled or live-enabled configuration.
- Logs redact secrets.

### Timezones

- UTC storage and Africa/Harare display.
- DST transitions for Europe/London and America/New_York.
- Calendar events with offsets convert correctly.

## 4. Fixtures policy

- `__fixtures__` contains recorded provider responses with a comment stating the source
  and retrieval date.
- Fixtures are used only in tests or explicit development tooling.
- A fixture is never returned by the production API.
- Live smoke checks are separate from automated tests and are documented honestly.

## 5. CI

GitHub Actions runs on push/PR:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

A MongoDB service container is used for integration tests when needed. Provider keys are
not required for CI; adapter contract tests use fixtures.

## 6. Manual verification checklist

- Start MongoDB and the API; confirm `/health` and `/health/providers`.
- Confirm real quotes show provider, timestamp, age and quality tier.
- Disconnect the provider/network; confirm a visible error/stale state and no fake data.
- Confirm the gold proxy warning appears for XAU/USD history without a direct provider.
- Place a paper order; confirm risk rejection reasons and idempotency.
- Run a backtest twice with the same config; confirm identical results.

## 7. What is not proven

- That a strategy is profitable.
- That free feeds are reliable, licensed for public use, or trading-grade.
- That simulated fills match a broker.
- That AI analysis is accurate.
