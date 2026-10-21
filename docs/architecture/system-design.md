# Proposed system design

**Status:** Phase 0 proposal; architecture and provider choices require review.

## Repository assessment

The inspected repository contains `README.md` and `COPILOT_MASTER_PROMPT.md` only. There is no application source, package manifest, framework, dependency lockfile, test suite, CI configuration, environment template, or database setup. No behavior has been implemented or tested.

The initial product is a personal research and decision-support tool for XAU/USD, EUR/USD, and GBP/USD. It should progress from research to paper trading; live order execution is explicitly out of scope for the initial design.

## Proposed architecture

Start with a modular monolith in a pnpm-managed TypeScript workspace:

- `apps/web`: Next.js user interface. It presents provider provenance and freshness and does not hold provider or AI credentials.
- `apps/api`: Node.js API, provisionally Fastify. It validates requests and coordinates domain modules.
- MongoDB: persistence for normalized market observations and future user-owned research records.
- Provider adapters: isolated behind interfaces; vendor SDKs and API schemas stay outside domain logic.
- Domain modules: instrument/watchlist, market data, analysis, planning/risk, paper trading, journal/tasks, and provider health. Add modules as needed rather than scaffolding empty packages.
- Shared contracts: typed request/response schemas and domain types, introduced when there are concrete consumers.

The workspace is a proposal, not an implemented stack. Keep deployment and ingestion simple until measured needs justify workers or additional services. Do not select charting, AI, news, or calendar vendors before checking capability, licensing, cost, and operational requirements.

## Module boundaries and core records

Provider-specific ingestion should produce normalized records with source provenance:

- `Instrument`: canonical instrument identifier, provider symbol mapping, and configured precision.
- `Quote`: instrument, bid/ask when supplied, provider timestamp, retrieval timestamp, provider, and quality/freshness state.
- `Candle`: instrument, interval, UTC open/close timestamps, OHLC values, volume when supplied, provider, and completeness state.
- `AnalysisSnapshot`: analysis time, input observation IDs/timestamps, sources, assumptions, limitations, and version metadata.
- `TradePlan`: user-authored proposed conditions and deterministic risk calculation; not an order.
- `PaperOrder` (future): simulated lifecycle with explicit spread/slippage assumptions; never routes to a broker.

These are design concepts only; no schemas or persistence have been implemented. Values must retain decimal precision suitable for the selected provider and instrument; do not assume all instruments share tick or contract conventions.

## Financial and data-safety boundaries

- Deterministic code, not an LLM, is authoritative for indicators, position sizing, risk limits, and simulated fills.
- Analysis must distinguish observations, deterministic calculations, model interpretation, and hypotheses.
- Missing, stale, contradictory, or incomplete inputs must be visible and block dependent decisions.
- No invented data, silent mock fallback, automatic live mode, or live execution from model output.
- Instrument specifications and any position-size computation remain unimplemented until a provider/broker specification and account-currency conversion policy are verified.

## Proposed validation strategy

When implementation begins, add unit tests for schemas, timestamp normalization, stale-data rules, and financial calculations; provider contract/integration tests that do not require secrets by default; and later UI/API workflow tests. Clearly distinguish fixture-based tests from tests against a provider sandbox or production account. There are currently no test commands to run.
