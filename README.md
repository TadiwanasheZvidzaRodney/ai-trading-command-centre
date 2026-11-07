# AI Trading Command Centre

A personal, evidence-first trading research and execution workspace for **XAU/USD, EUR/USD, and GBP/USD**. It unifies live market quotes, technical indicators, pattern and market-structure detection, macro intelligence, deterministic risk controls, paper execution, journaling, and backtesting.

> **Research & Paper Trading Notice:** This software is a personal decision-support system. Live trading is permanently disabled in the core system by default to protect capital (`LIVE_TRADING_ENABLED=false`). Market data feeds are reference-grade, and AI outputs are interpretation tools rather than trading advice.

---

## Key Features

- **Live Market Feeds:** Real-time bid/ask quotes, spreads, and historical candlestick data across multiple timeframes (`1m` to `1wk`) for XAU/USD, EUR/USD, and GBP/USD.
- **Deterministic Technical Analysis:** Causal calculations for 8 standard indicators (SMA, EMA, RSI, MACD, ATR, Bollinger Bands, Stochastic, Volume) and 9 candlestick chart patterns with confidence scoring.
- **Market Structure Detection:** Automated swing high/low mapping, dynamic support/resistance clustering, and trend/range regime classification.
- **Macro & News Intelligence:** RSS news aggregation with ticker relevance scoring alongside high-impact economic calendar scheduling with event blackout buffers.
- **AI Analysis & Copilot:** Evidence-grounded market interpretation powered by Google Gemini, local Ollama, or a deterministic facts-only local fallback. Built with strict prompt injection sanitization.
- **Deterministic Risk Engine:** Server-side rule validation calculating position sizes from contract specifications, enforcing maximum daily loss, per-trade risk percentage, maximum leverage, minimum reward-to-risk (R:R), correlation caps, and an instant kill switch.
- **Database-Backed Paper Trading:** Idempotent order placement (`idempotencyKey`), immediate market order execution with adverse slippage and commissions, trailing stop/target tracking, live mark-to-market valuations, and account state reconciliation.
- **Trade Journal & Analytics:** Detailed trade review logging gross P&L, fees/commissions, net P&L, R-multiple outcomes, win rates, and profit factors.
- **Event-Driven Backtesting:** Historical strategy simulation with next-bar open fills, stop-first intrabar exit handling, causal indicator series, and 60/20/20 development/validation/out-of-sample data splits. Rejects profitability claims without out-of-sample proof.
- **Production Hardening:** Session authentication with secure `HttpOnly` cookies, double-submit CSRF tokens, strict rate limits, Helmet security headers, structured Pino logging with credential redaction, audit logging, and automated backup/restore verification drills.

---

## Core Principles

1. **Evidence-First:** Never fabricate prices, candles, news, calendar events, balances, or performance numbers.
2. **Provenance & Freshness:** Explicitly display data provider, symbol, timestamps, and age wherever data is shown.
3. **Deterministic Financial Logic:** Hard risk limits, lot sizing, and P&L calculations are pure deterministic TypeScript; AI never has authority to execute, modify, or cancel orders.
4. **Fail Closed:** If market data or risk parameters are unavailable, order creation and plan validation fail closed.
5. **No Look-Ahead Bias:** Backtesting operates sequentially bar-by-bar; indicators and entries strictly depend on historical or current bar close data, filling on the next bar open.

---

## Technology Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | Next.js (App Router), React, TypeScript, CSS Variables |
| **Backend API** | Node.js, Fastify, Zod validation |
| **Persistence** | MongoDB (Native Node Driver, partial unique indexes) |
| **Charts** | TradingView Lightweight Charts |
| **Logging** | Pino structured JSON logging with sensitive field redaction |
| **Testing** | Vitest (580+ unit and integration tests) |
| **Monorepo** | npm workspaces |

---

## Repository Layout

```
apps/
  api/                  Fastify REST API, risk gate, paper trading, and backtest routes
  web/                  Next.js frontend application
packages/
  ai-copilot/           AI provider abstraction (Gemini, Ollama, Fallback) & sanitization
  backtesting/          Event-driven backtesting engine, strategies, metrics, and data splits
  config/               Environment variable schemas, defaults, and validation
  economic-calendar/    ForexFactory calendar ingestion and time normalisation
  market-data/          Multi-source quote and candle providers, caching, and health
  news/                 RSS feed ingestion, keyword relevance scoring, and deduplication
  paper-trading/        Position tracking, P&L calculations, and order execution helpers
  risk-engine/          Position sizing, R:R calculation, and risk validation
  shared/               Cross-cutting types, constants, instrument specifications, and schemas
  technical-analysis/   Deterministic indicators, candlestick patterns, and market structure
docs/                   Architecture, decisions, security model, and operational runbooks
scripts/                Operational tools (backup/restore drill, password hasher, seed data)
```

---

## Getting Started

### Prerequisites

- **Node.js** 22+ (tested on Node 24)
- **npm** 11+
- **Docker** (for local MongoDB)

### 1. Installation & Environment Configuration

Clone the repository and install dependencies:

```bash
npm install
cp .env.example .env
```

Key environment configurations in `.env`:

- `AUTH_MODE`: Set to `disabled` for local development; use `session` for production.
- `MONGODB_URI`: Connection string (defaults to `mongodb://localhost:27017`).
- `AI_PROVIDER`: `fallback` (offline, facts-only), `gemini` (Google AI Studio key), or `ollama`.
- `ENABLE_SCHEDULER`: Set to `true` to run background mark-to-market evaluation and ingestion.

### 2. Start the Local Database

Start the MongoDB container using Docker Compose:

```bash
npm run db:up
```

### 3. Run the Development Servers

Start both the API (`http://localhost:4000`) and the Web UI (`http://localhost:3000`):

```bash
npm run dev
```

### 4. Running Verification Checks

Verify the codebase across all packages:

```bash
npm run lint          # Run ESLint across monorepo
npm run typecheck     # Typecheck all packages and applications
npm test              # Run the complete Vitest test suite (586+ tests)
npm run build         # Build production API bundle and static Next.js pages
```

---

## Application Navigation

Once running locally, the following pages are accessible:

- **Dashboard / Overview (`/`):** Market summary, system health, and navigation cards.
- **Markets (`/markets`):** Live bid/ask watchlists, candlestick charts, and quote age provenance.
- **Analysis (`/analysis`):** Multi-timeframe technical indicator panels, pattern alerts, and swing structure.
- **Copilot (`/copilot`):** AI-assisted analysis and trade idea generation grounded in market evidence.
- **Planner (`/planner`):** Position size calculation and pre-trade risk constraint validation.
- **Paper Trading (`/paper`):** Simulated execution dashboard with kill-switch toggle, manual stop/target evaluator, and open order/position monitors.
- **Trade Journal (`/journal`):** Closed trade history, performance analytics (expectancy, profit factor, drawdown), and trade review notes.
- **Backtesting (`/backtests`):** Historical strategy evaluation, equity curve visualization, and out-of-sample performance verification.
- **Calendar (`/calendar`):** High-impact economic news releases with event blackout tracking.
- **News (`/news`):** Financial headlines with automated currency relevance tagging.
- **Tasks (`/tasks`):** Operational checklist and trade preparation task manager.

---

## Security & Operational Procedures

- **Authentication & CSRF:** In `session` mode, authentication requires secure HTTP cookies with double-submit CSRF headers on mutating requests. Password hashes are generated using bcrypt:
  ```bash
  npm run auth:hash
  ```
- **Disaster Recovery Drill:** Test MongoDB backup creation, snapshot extraction, drill database restoration, and verification:
  ```bash
  npm run drill:backup
  ```
- **Kill Switch:** To instantly halt paper trading and reject all incoming orders, engage the kill switch from the `/paper` dashboard or via the API:
  ```bash
  curl -X POST http://localhost:4000/api/v1/risk/kill-switch \
    -H "Content-Type: application/json" \
    -d '{"enabled": true, "reason": "Market volatility halt"}'
  ```

---

## Documentation Index

- [System Design Architecture](docs/architecture/system-design.md)
- [Data Flow Specification](docs/architecture/data-flow.md)
- [Security Model & Threat Boundaries](docs/architecture/security-model.md)
- [Provider Evaluation & Data Policy](docs/provider-evaluation.md)
- [Backup & Recovery Runbook](docs/operations/backup-recovery.md)
- [Deployment Runbook](docs/operations/deployment.md)
- [Incident Response Guide](docs/operations/incident-response.md)
- [Testing Strategy](docs/testing/test-strategy.md)

---

## Disclaimer

Financial trading involves substantial risk of loss. Historical performance and backtested simulations do not guarantee future returns. Data feeds may contain inaccuracies or delays, and paper fills do not simulate liquidity blackouts. You are solely responsible for testing, validating, and risk-managing any trading activity.
