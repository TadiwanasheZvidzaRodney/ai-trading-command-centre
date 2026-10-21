# Proposed system design

**Status:** Phase 1 foundation implemented; provider and production choices remain open.

## Repository assessment

The repository now contains a pnpm TypeScript workspace, a Next.js web shell, a Fastify API, environment validation, health checks, MongoDB readiness, and CI. Market data, persistence of application records, authentication, and trading behavior are not implemented.

The initial product is a personal research and decision-support tool for XAU/USD, EUR/USD, and GBP/USD. It should progress from research to paper trading; live order execution is explicitly out of scope for the initial design.

## Proposed architecture

Use a modular monolith in a pnpm-managed TypeScript workspace:

- `apps/web`: Next.js user interface. It presents provider provenance and freshness and does not hold provider or AI credentials.
- `apps/api`: Fastify Node.js API. It validates requests and will coordinate domain modules.
- MongoDB: persistence for normalized market observations and future user-owned research records.
- Provider adapters: isolated behind interfaces; vendor SDKs and API schemas stay outside domain logic.
- Domain modules: instrument/watchlist, market data, analysis, planning/risk, paper trading, journal/tasks, and provider health. Add modules as needed rather than scaffolding empty packages.
- Shared contracts: typed request/response schemas and domain types, introduced when there are concrete consumers.

The web/API foundation and local MongoDB readiness check are implemented. Keep deployment and ingestion simple until measured needs justify workers or additional services. Do not select charting, AI, news, or calendar vendors before checking capability, licensing, cost, and operational requirements.

## Module boundaries and core records

Provider-specific ingestion should produce normalized records with source provenance:

- `Instrument`: canonical instrument identifier, provider symbol mapping, and configured precision.
- `Quote`: instrument, bid/ask when supplied, provider timestamp, retrieval timestamp, provider, and quality/freshness state.
- `Candle`: instrument, interval, UTC open/close timestamps, OHLC values, volume when supplied, provider, and completeness state.
- `AnalysisSnapshot`: analysis time, input observation IDs/timestamps, sources, assumptions, limitations, and version metadata.
- `TradePlan`: user-authored proposed conditions and deterministic risk calculation; not an order.
- `PaperOrder` (future): simulated lifecycle with explicit spread/slippage assumptions; never routes to a broker.

These are design concepts only; no application records or schemas have been implemented or persisted. Values must retain decimal precision suitable for the selected provider and instrument; do not assume all instruments share tick or contract conventions.

## Financial and data-safety boundaries

- Deterministic code, not an LLM, is authoritative for indicators, position sizing, risk limits, and simulated fills.
- Analysis must distinguish observations, deterministic calculations, model interpretation, and hypotheses.
- Missing, stale, contradictory, or incomplete inputs must be visible and block dependent decisions.
- No invented data, silent mock fallback, automatic live mode, or live execution from model output.
- Instrument specifications and any position-size computation remain unimplemented until a provider/broker specification and account-currency conversion policy are verified.

## Proposed validation strategy

Current API tests validate configuration, liveness, and fail-closed readiness without MongoDB. Add unit tests for timestamp normalization, stale-data rules, and financial calculations when those modules are implemented; provider contract/integration tests that do not require secrets by default; and later UI/API workflow tests. Clearly distinguish fixture-based tests from tests against a provider sandbox or production account.
