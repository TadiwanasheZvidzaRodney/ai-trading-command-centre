# AI Trading Command Centre

A personal, evidence-first trading research workspace for **XAU/USD, EUR/USD and GBP/USD**.
It combines real market data, deterministic technical analysis, news, an economic calendar,
trade planning, risk controls, paper trading, journaling and backtesting in one place.

> This is a decision-support and research tool, **not** a promise of profitability.
> It starts in research mode and moves to paper trading. Live execution is disabled by
> default and is not implemented. Market data can be delayed, incomplete or wrong.

**Current status:** Phase 0 (architecture and provider decisions), Phase 1
(foundation), Phase 2 (real market data) and Phase 3 (trading workspace) are
implemented. Feature phases are being built incrementally. See
[`docs/implementation-plan.md`](docs/implementation-plan.md) for the live status and
acceptance evidence.

## Principles

1. Never fabricate prices, candles, news, calendar events, balances or results.
2. Show provider, instrument, timestamp, timezone and freshness wherever data appears.
3. Deterministic code owns every financial calculation and hard risk rule.
4. AI output is an interpretation layer: schema-validated, source-linked and never
   able to place, modify or cancel an order.
5. Fail closed when critical data or risk inputs are missing.
6. Mock data is allowed only in tests or explicitly labelled development fixtures.
7. Live trading stays off until a separate, explicitly authorised release gate.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript |
| API | Node.js, Fastify 5, TypeScript |
| Database | MongoDB 8 (local Docker Compose; Atlas free tier is a later option) |
| Validation | Zod |
| Charts | TradingView Lightweight Charts (Apache-2.0) |
| Testing | Vitest; Playwright for critical journeys |
| Logging | Pino structured logs |
| Monorepo | npm workspaces |
| CI | GitHub Actions |

## Repository layout

```
apps/
  api/                  Fastify API, providers, schedulers, persistence
  web/                  Next.js workspace UI
packages/
  shared/               Domain types, schemas, time and formatting helpers
  config/               Environment schema and instrument/risk defaults
  market-data/          Provider interfaces, adapters, normalisation, quality checks
  technical-analysis/   Deterministic indicators, structure and strategy rules
  news/                 RSS ingestion, deduplication, relevance
  economic-calendar/    Calendar ingestion and timezone normalisation
  ai-engine/            Evidence bundle, prompt, adapters, output validation
  risk-engine/          Position sizing and hard risk limits
  trading-domain/       Orders, paper fills, journal and performance
docs/                   Architecture, ADRs, provider research, operations, testing
scripts/                Operational scripts (password hash, seed)
```

Packages below `packages/config` are added phase by phase; see the implementation plan
for what exists today.

## Quick start

### Prerequisites

- Node.js 22+ (tested on Node 24)
- npm 11+
- Docker Desktop (for local MongoDB)

### 1. Install and configure

```bash
npm install
cp .env.example .env
```

For local development the template uses `AUTH_MODE=disabled`, which shows a visible
warning in the UI. To use the login flow instead:

```bash
npm run auth:hash -- "your-password"
# put the printed hash in AUTH_PASSWORD_HASH, set AUTH_USERNAME and AUTH_MODE=session
```

### 2. Start MongoDB

```bash
npm run db:up
```

### 3. Run the app

```bash
npm run dev
```

- Web: <http://localhost:3000>
- Markets (watchlist, candlestick chart, provenance): <http://localhost:3000/markets>
- Tasks (preparation tasks and reminders): <http://localhost:3000/tasks>
- Calendar (UTC week view; event ingestion lands in Phase 4): <http://localhost:3000/calendar>
- API: <http://localhost:4000>
- API health: <http://localhost:4000/health>
- OpenAPI UI: <http://localhost:4000/docs> (development only)

### 4. Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Only claim a check passed if it was actually run. The implementation plan records
the commands and results for each phase.

## Free, no-key data providers

The project is designed to run at **$0** while keeping provider boundaries clean.
The initial adapters use public, no-key feeds and label their limitations in the UI:

| Data | Provider | Auth | Notes |
| --- | --- | --- | --- |
| Quotes (XAU/USD, EUR/USD, GBP/USD) | Swissquote public quote feed | None | Real bid/ask, but an undocumented public website feed. Latency and terms are not guaranteed. Reference only, not trading-grade. |
| Candles (EUR/USD, GBP/USD) | Yahoo Finance chart endpoint | None | Unofficial public endpoint. Reference data, not trading-grade. |
| Candles (XAU/USD) | Yahoo `GC=F` | None | **COMEX gold futures proxy**, clearly labelled. Not spot XAU/USD. |
| News | Public RSS feeds (FXStreet, MarketWatch, ECB, Fed, BoE, BBC) | None | Headline + link + published time only. |
| Economic calendar | Forex Factory community JSON feed | None | This week only, no actual values. Verify against primary sources. |
| AI narrative | Ollama (local) or Gemini free tier | Optional | Disabled by default; deterministic evidence reports still work. |

Optional upgrade providers are planned behind the same interfaces:
**Twelve Data** (free key, XAU/USD history) and **OANDA practice** (free demo
account, XAU/USD candles and pricing). Add credentials to `.env` when available.

See [`docs/provider-evaluation.md`](docs/provider-evaluation.md) for verification
details, costs, limits and licensing caveats.

## Safety model

- `TRADING_MODE=research` by default.
- `LIVE_TRADING_ENABLED=false` is enforced; setting it to `true` does not enable
  live trading and makes the API refuse to start until a live broker integration
  exists.
- Risk limits are server-side and evaluated with deterministic code.
- All mutating endpoints require authentication (when enabled) and CSRF protection.
- External news and calendar text is treated as untrusted data and delimited in AI
  prompts. It cannot grant tools, reveal secrets or bypass risk checks.

## Documentation

- [System design](docs/architecture/system-design.md)
- [Data flow](docs/architecture/data-flow.md)
- [Security model](docs/architecture/security-model.md)
- [ADR-001: initial architecture](docs/decisions/ADR-001-initial-architecture.md)
- [ADR-002: zero-budget data strategy](docs/decisions/ADR-002-zero-budget-data-strategy.md)
- [Provider evaluation](docs/provider-evaluation.md)
- [Implementation plan](docs/implementation-plan.md)
- [Test strategy](docs/testing/test-strategy.md)
- [Deployment](docs/operations/deployment.md)
- [Incident response](docs/operations/incident-response.md)

## Disclaimer

Financial markets involve substantial risk. Historical results do not guarantee
future results. Data may be delayed or incorrect, AI-generated analysis may be
wrong, and simulated fills may differ from live execution. You are responsible for
verifying information, complying with provider terms and laws, and authorising any
live trading activity.
