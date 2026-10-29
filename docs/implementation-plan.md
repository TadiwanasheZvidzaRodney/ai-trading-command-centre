# Implementation Plan

**Last updated:** 2026-10-29
**Current phase:** Phase 2 complete. Phase 3 is next.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` complete with evidence.

## Phase 0 - Discovery and architecture

Goal: understand the repository, decide the architecture and data strategy, and define
testable acceptance criteria.

- [x] Inspect repository, git history and toolchain.
- [x] Record current state (empty scaffold, Node 24, npm 11, Docker available).
- [x] Verify free data sources from this environment.
- [x] Write system design, data flow and security model.
- [x] Write ADR-001 (architecture) and ADR-002 (zero-budget data strategy).
- [x] Write provider evaluation with verified/unverified distinctions.
- [x] Write test strategy and operations baselines.
- [x] Define phased acceptance criteria.

**Evidence:** `docs/architecture/*`, `docs/decisions/*`, `docs/provider-evaluation.md`,
`docs/testing/test-strategy.md`.

## Phase 1 - Project foundation

Goal: a reproducible local environment with type safety, linting, tests, logging,
database connectivity, health checks and CI.

- [x] npm workspace with `apps/api`, `apps/web` and domain packages.
- [x] Shared TypeScript config, strict mode, path aliases.
- [x] ESLint + Prettier with a clean run.
- [x] Zod-validated environment with safe production rules.
- [x] MongoDB connection with health check and graceful shutdown.
- [x] Structured Pino logging with request ids and secret redaction.
- [x] `/health` and `/health/providers` endpoints.
- [x] Next.js shell with a visible system-status page.
- [x] Unit tests for env validation, time helpers and health.
- [x] GitHub Actions CI (install, lint, typecheck, test, build).
- [x] `docker-compose.yml` for MongoDB.
- [x] README with verified commands.

**Acceptance criteria:** `npm install`, `npm run lint`, `npm run typecheck`, `npm test`
and `npm run build` pass; the API starts against MongoDB and reports healthy; the web
app renders the status page; no secrets are committed.

**Verified 2026-10-27:**
- `npm install` — 389 packages, 0 vulnerabilities.
- `npm run lint` — clean, 0 errors and 0 warnings.
- `npm run typecheck` — API, web, config and shared workspaces pass.
- `npm test` — 6 files, 33 tests passed.
- `npm run build` — API ESM bundle 123.63 KB; Next.js production build completed with
  14 static routes.
- MongoDB — Docker container `atc-mongo` healthy on `127.0.0.1:27017`.
- `GET http://127.0.0.1:4000/health` — `status: ok`, database `ok` at 3 ms,
  `tradingMode: research`, `liveTradingEnabled: false`, `authMode: disabled`.
- Browser at `http://localhost:3000` — overview rendered with API online, database
  connected, five providers, development-auth warning, and no console errors.
- Auth is disabled only because this is a local development run; production startup
  rejects `AUTH_MODE=disabled`, development secrets and live trading.

## Phase 2 - Real market data

Goal: verified real quotes and candles with provenance, freshness and quality flags.

- [x] Provider interface and registry.
- [x] Swissquote quote adapter (no key).
- [x] Yahoo candle adapter (no key), with labelled `GC=F` proxy for XAU/USD.
- [x] Twelve Data and OANDA adapters (disabled without credentials).
- [x] Caching, timeouts, retries and provider health.
- [x] Quote/candle validation, deduplication, sorting and gap flags.
- [x] MongoDB persistence for quotes/candles.
- [x] API routes for quotes, candles, instruments and provider health.
- [x] Contract/unit tests with recorded fixtures.
- [x] Live smoke check showing real timestamps in the API and UI.

**Acceptance criteria:** the UI shows provider, instrument, observation time, age and
quality tier; a provider failure produces a visible error/stale state, never a fabricated
quote; gold proxy data is unmistakably labelled.

**Verified 2026-10-29:**
- `npm run lint` — clean, 0 errors and 0 warnings.
- `npm run typecheck` — API, web, config, market-data and shared workspaces pass.
- `npm test` — 15 files, 83 tests passed.
- `npm run build` — API ESM bundle 168.21 KB; Next.js production build completed with
  14 static routes including `/markets`.
- Live API smoke against `http://127.0.0.1:4000`:
  - `/api/v1/instruments` returned XAU/USD, EUR/USD and GBP/USD, with XAU/USD
    `candleProxySymbol: "GC=F"`.
  - `/api/v1/market/quotes` returned live Swissquote quotes with provider, observation
    time, age, quality and cache metadata.
  - `/api/v1/market/candles/XAU/USD?timeframe=1d` returned 60 Yahoo `GC=F` candles with
    `quality: "proxy"`, `proxyFor: "XAU/USD"` and explicit proxy notes.
  - `/api/v1/market/candles/EUR/USD?timeframe=4h` returned UTC-aggregated 4h candles.
  - `/health/providers` reported Swissquote and Yahoo `ok`, RSS/calendar `degraded`
    (not yet ingested) and AI `not_configured`.
  - Invalid instruments and timeframes returned structured `400 VALIDATION_ERROR`
    responses.
- Browser at `http://localhost:3000/markets`: quote cards, instrument/timeframe
  switching, SVG candle preview, provenance panel, proxy badges, recent-candle table and
  market-provider health rendered with live data and no console errors.
- Twelve Data and OANDA adapters are fixture-tested only; no live keys have been used, so
  their real network behaviour remains unverified. They stay disabled without credentials.

## Phase 3 - Trading workspace

Goal: a usable research workspace.

- [ ] Responsive app shell, navigation and design system.
- [ ] Overview dashboard.
- [ ] Watchlist with live quotes and freshness.
- [ ] Candlestick chart with timeframes and volume where available.
- [ ] Instrument detail with technical snapshot.
- [ ] Tasks and reminders UI.
- [ ] Calendar UI.
- [ ] Loading, empty and error states.

**Acceptance criteria:** a user can open the app, see real quotes/candles, switch
timeframes, read provenance warnings, and manage tasks without console errors.

## Phase 4 - News and macro intelligence

- [ ] RSS ingestion with dedupe and source attribution.
- [ ] Relevance tagging for USD/EUR/GBP/XAU.
- [ ] Economic calendar ingestion and UTC normalisation.
- [ ] Upcoming high-impact event highlighting.
- [ ] News/calendar API routes and UI.
- [ ] Ingestion failure monitoring.

**Acceptance criteria:** source-linked items appear with timestamps; duplicates are
suppressed; timezone conversion is correct across DST; the current-week limitation is
stated.

## Phase 5 - Technical analysis

- [ ] SMA, EMA, RSI, MACD, ATR, ADX, Bollinger, stochastic.
- [ ] Swing highs/lows, support/resistance clustering.
- [ ] Trend/range/volatility classification.
- [ ] Candle pattern detection.
- [ ] Configurable strategy rules and setup candidates.
- [ ] Deterministic tests with known fixtures.
- [ ] API and UI technical summary.

**Acceptance criteria:** indicator outputs match reference values within tolerance;
strategy evaluation is deterministic and configurable; no look-ahead.

## Phase 6 - AI copilot

- [ ] Evidence bundle with timestamps and source ids.
- [ ] Deterministic scenario report (always available).
- [ ] Ollama, Gemini and OpenAI-compatible adapters.
- [ ] Strict JSON schema validation and rejection handling.
- [ ] Prompt-injection defences and untrusted-data delimiters.
- [ ] Analysis history and input snapshot hash.
- [ ] UI report separating facts, calculations, interpretation and limitations.

**Acceptance criteria:** malformed model output is rejected and stored as failed; no
analysis can trigger an order; deterministic reports work without a model; every report
lists sources, assumptions, invalidation conditions and data limitations.

## Phase 7 - Risk and paper trading

- [ ] Decimal position sizing with instrument contract specs.
- [ ] Risk limits: per trade, daily loss, open risk, positions, correlation, RR,
      spread/volatility, event blackout, kill switch.
- [ ] Structured rejection reasons.
- [ ] Simulated order lifecycle with idempotency.
- [ ] Fills, stops, targets, costs, P&L and R multiple.
- [ ] Journal and performance analytics.
- [ ] Boundary and duplicate-order tests.

**Acceptance criteria:** hard limits cannot be bypassed by the UI; missing inputs fail
closed; duplicate submissions are prevented; paper P&L reconciles with recorded fills.

## Phase 8 - Backtesting and validation

- [ ] Event-driven backtester using timestamped candles.
- [ ] Next-bar entry, spread, commission, slippage and conservative stop/target.
- [ ] Development/validation/out-of-sample split and walk-forward support.
- [ ] Metrics: trades, expectancy, net return, profit factor, max drawdown, average
      win/loss, exposure.
- [ ] Reproducible configuration hashes and stored runs.
- [ ] Look-ahead and cost-sensitivity tests.

**Acceptance criteria:** no look-ahead in tests; results are reproducible from stored
config; costs change results in the expected direction; no "profitable" claim without
out-of-sample evidence.

## Phase 9 - Production hardening

- [ ] Session auth, CSRF, rate limits and security headers.
- [ ] Audit logging and redaction.
- [ ] Backup/recovery procedure and tested restore.
- [ ] Provider health monitoring and alerts.
- [ ] Deployment automation and smoke tests.
- [ ] Dependency/container scanning.
- [ ] Incident response and rollback docs.

**Acceptance criteria:** production config cannot run with auth disabled or live trading
enabled; security tests pass; restore drill documented; health/monitoring verified.

## Phase 10 - Optional broker integration

Not started. Requires explicit approval, a supported broker, demo verification,
instrument mapping, reconciliation, idempotency, kill switch and a separate release
review. Not part of the current release.

## Known limitations

- Free data feeds are reference quality and can change or block access.
- Gold history is a futures proxy until a direct provider is configured.
- The community calendar covers the current week and lacks actual values.
- In-process schedulers stop with the API.
- Single-user auth only.
- No live execution.
