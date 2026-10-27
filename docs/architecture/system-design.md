# System Design

**Status:** Phase 0 baseline, updated as implementation proceeds.
**Last updated:** 2026-10-27

## 1. Purpose and scope

The AI Trading Command Centre is a single-user, web-based research and decision-support
workspace for spot gold (XAU/USD), EUR/USD and GBP/USD. It brings market data,
deterministic technical analysis, news, economic events, trade planning, risk controls,
paper trading, journaling and backtesting into one application.

It is **not**:

- a guaranteed-profit system or signal service;
- a substitute for broker execution, market-data licensing or financial advice;
- a live-trading platform in the current release.

The release path is **research -> paper trading -> optional, separately authorised broker
integration**.

## 2. Operating constraints

| Constraint | Decision |
| --- | --- |
| Budget | $0 for development and the initial deployment. Free/no-key data sources first. |
| Users | Single user, personal application. No multi-tenant concerns in v1. |
| Credentials | None initially. Provider adapters must show `not_configured` rather than fake data. |
| Live execution | Disabled and not implemented. |
| Deployment | Local first; container-friendly; free-tier hosting possible later. |
| Platform | Windows development, Node.js 22+, npm workspaces. |

## 3. Architecture style

A **modular monolith** with explicit package boundaries. One API process, one web
process, one MongoDB database. Modules communicate through typed interfaces and domain
objects, never by reaching into each other's provider-specific code.

```
Browser
  |
  v
Next.js web app (apps/web)
  |  HTTPS/JSON, session cookie, CSRF header
  v
Fastify API (apps/api)
  |-- auth / sessions / audit
  |-- instruments & watchlists
  |-- market data (quotes, candles, quality, cache)
  |-- technical analysis (deterministic)
  |-- news (RSS ingestion, dedupe, relevance)
  |-- economic calendar (normalise, timezone)
  |-- AI analysis (evidence bundle -> optional model -> validated report)
  |-- trade planning & risk engine (deterministic)
  |-- paper trading (simulated orders, fills, P&L)
  |-- journal & performance
  |-- tasks & reminders
  |-- settings, provider health, operations
  |
  +--> MongoDB
  +--> Swissquote public quotes        (no key)
  +--> Yahoo chart endpoint            (no key)
  +--> Public RSS feeds                (no key)
  +--> Forex Factory community feed    (no key)
  +--> Ollama / Gemini / OpenAI-compatible (optional)
  +--> Twelve Data / OANDA practice    (optional keys)
```

## 4. Module boundaries

| Module | Owns | Must not own |
| --- | --- | --- |
| `shared` | Domain types, Zod schemas, time/format helpers, result types | Provider SDKs, HTTP, database |
| `config` | Environment schema, instrument defaults, risk defaults | Runtime state, secrets in code |
| `market-data` | Provider interfaces, adapters, normalisation, freshness, quality checks | Risk decisions, UI |
| `technical-analysis` | Indicators, structure, strategy evaluation | Order execution, data fetching |
| `news` | Feed parsing, dedupe, relevance, source attribution | Sentiment-as-price-prediction |
| `economic-calendar` | Event parsing, UTC normalisation, impact classification | Trading decisions |
| `ai-engine` | Evidence bundle, prompt construction, adapters, output validation | Financial arithmetic, order submission |
| `risk-engine` | Position sizing, hard limits, rejection reasons | Market-data fetching, UI |
| `trading-domain` | Orders, paper fills, positions, journal, metrics | Broker credentials, live execution |
| `apps/api` | HTTP composition, auth, persistence wiring, schedulers | Domain calculations duplicated from packages |
| `apps/web` | Presentation, interaction, loading/empty/error states | Secrets, risk enforcement, authoritative calculations |

Dependency direction is one-way: `apps -> packages`, with `shared` at the bottom.
`risk-engine` and `technical-analysis` never import each other. `ai-engine` may import
analysis outputs but never the risk engine's enforcement path.

## 5. Provider abstraction

Every external source implements a narrow interface in `packages/market-data`,
`packages/news` or `packages/economic-calendar`:

```ts
interface MarketDataProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  getQuote(instrument: Instrument): Promise<Quote>;
  getCandles(request: CandleRequest): Promise<CandleSeries>;
  health(): Promise<ProviderHealth>;
}
```

Rules:

- Adapters normalise symbols, timestamps (UTC), decimals and field names.
- Adapters return explicit errors; they never substitute generated data.
- The registry selects a provider from configuration. A missing key produces a
  `not_configured` status, not a fake quote.
- Provider metadata (id, display name, delay status, quality tier, proxy flag) travels
  with every observation into the API and UI.
- Switching providers must not require changes in the AI, risk or trading modules.

## 6. Data model (MongoDB collections)

| Collection | Purpose | Key indexes |
| --- | --- | --- |
| `instruments` | Configured instruments and contract metadata | `symbol` unique |
| `quotes` | Latest normalised quote per provider/instrument | `provider+symbol` unique |
| `candles` | Normalised OHLCV history | `provider+symbol+timeframe+openTime` unique |
| `news_items` | Headlines, links, source and relevance | `canonicalUrl` unique, `publishedAt` |
| `calendar_events` | Normalised economic events | `source+externalId` unique, `scheduledAt` |
| `analyses` | Evidence snapshot + deterministic/AI report | `instrument+createdAt` |
| `setups` | Planned trade ideas and status | `instrument+status` |
| `paper_orders` | Simulated order lifecycle | `idempotencyKey` unique |
| `paper_positions` | Open/closed simulated positions | `status+instrument` |
| `journal_entries` | Trade reviews and notes | `createdAt` |
| `tasks` | Personal tasks and reminders | `status+dueAt` |
| `backtest_runs` | Reproducible configurations and results | `createdAt` |
| `users` | Single-user credential record | `username` unique |
| `sessions` | Opaque server-side sessions | `tokenHash` unique, TTL |
| `audit_logs` | Sensitive actions | `createdAt`, `actor` |
| `provider_health` | Last success/failure/latency per provider | `providerId` unique |
| `settings` | User-editable non-secret preferences | `key` unique |

Timestamps are stored as UTC `Date` values. The user's IANA timezone is applied at the
presentation boundary.

## 7. Runtime and scheduling

- Web and API are separate processes in development (`:3000`, `:4000`).
- The API runs in-process schedulers for quote refresh, news ingestion, calendar
  ingestion and paper-trade monitoring. Schedulers are disabled in tests and can be
  disabled with `ENABLE_SCHEDULER=false`.
- Scheduled work never runs only inside a browser session.
- Long-running work uses timeouts, bounded retries with backoff and circuit-breaker
  state per provider.
- The API exposes `/health` (liveness/readiness) and `/health/providers` (data-source
  status) plus structured logs with request IDs.

## 8. Freshness, provenance and failure semantics

Every quote and candle carries:

- provider id and display name;
- instrument and timeframe;
- observation timestamp (UTC);
- retrieval timestamp (UTC);
- delay/quality tier (`live`, `delayed`, `reference`, `proxy`);
- a `stale` flag and freshness age.

Failure behaviour:

| Condition | Behaviour |
| --- | --- |
| Provider key missing | Status `not_configured`; dependent features show a setup message. |
| Provider timeout/5xx | Bounded retry; surface stale/error state; do not fabricate. |
| Quote older than threshold | Mark stale, warn in UI, block new paper entries and AI "actionable" language. |
| Candle gaps/duplicates | Deduplicate, sort, flag gaps; block analysis if insufficient history. |
| Missing risk input | Reject the proposed order with a reason. |
| AI output invalid | Reject and store the validation error; never execute. |

## 9. Trading modes

- **Research (default):** read-only analysis, calendar, news, planning.
- **Paper:** simulated orders with recorded quotes, spread, slippage, costs and P&L.
- **Live:** not implemented. `LIVE_TRADING_ENABLED=true` causes startup failure with an
  explicit message until a future, separately reviewed broker integration exists.

## 10. Technology decisions

| Concern | Choice | Reason |
| --- | --- | --- |
| Web | Next.js 16 / React 19 | Server rendering, routing, mature deployment story |
| API | Fastify 5 | Small, typed, fast, good plugin model |
| Validation | Zod 4 | Shared runtime schemas between API and UI |
| DB | MongoDB 8 | Flexible document model, free local/Atlas options |
| Charts | Lightweight Charts 5 | Apache-2.0, purpose-built financial charts |
| Tests | Vitest 5 | Fast TS-native tests |
| Logging | Pino | Structured JSON logs, low overhead |
| Money math | Decimal.js | Avoid binary floating-point in risk/P&L |

## 11. Repository layout

See the root `README.md`. The layout is intentionally small: packages are created when
they have real code, not to fill a diagram.

## 12. Non-goals for the current release

- Multi-user accounts, teams or sharing.
- Mobile native apps.
- Live broker order routing.
- Tick-level backtesting or high-frequency execution.
- Guaranteed real-time data.
- Storing full copyrighted news articles.

## 13. Phase gates

A phase is complete only with documented acceptance criteria, passing automated tests,
a successful build where applicable, honest data-provenance evidence, safe failure
behaviour and updated documentation. UI presence alone is not completion.
