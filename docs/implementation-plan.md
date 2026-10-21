# Implementation plan

**Current phase:** Phase 1 — Project foundation
**Status:** Phase 0 documents are in place. Phase 1 foundation is implemented; provider research remains open and Phase 2 has not started.

## Repository assessment

The repository began with a title-only `README.md` and the master prompt. Phase 1 adds a pnpm TypeScript workspace containing a Next.js web application and Fastify API, MongoDB connectivity checks, environment validation, CI, and API tests. It still has no market-data provider credentials or trading behavior.

The repository currently targets a personal research-first trading copilot for XAU/USD, EUR/USD, and GBP/USD. It explicitly requires real-data provenance, deterministic risk calculations, no silent mock fallback, and a separate approval/validation gate for live trading.

## Phased roadmap

| Phase | Goal | Acceptance criteria |
|---|---|---|
| 0 — Discovery and architecture | Confirm boundaries, provider criteria, risks, and implementation sequence. | System/data-flow/security/ADR/provider/plan docs are reviewed; unresolved provider and infrastructure questions are explicit; no live execution exists. |
| 1 — Foundation | Create a reproducible TypeScript development environment. | Documented install and run commands work from a clean checkout; startup validates configuration; API and web health checks work; database connectivity is observable; logging is structured and redacted; CI runs lint, typecheck, tests, and build. |
| 2 — Real market data | Integrate one verified provider behind an adapter. | Real quote/candle responses for all three instruments are normalized; source, timestamp, delay and freshness are visible; missing/stale/provider errors fail safely; no mock fallback; provider terms and limits are documented. |
| 3 — Trading workspace | Present validated market context and user watchlists. | Chart/watchlist views use API data; loading, empty, stale, and error states are tested; configured instruments/timeframes are not hard-coded into calculations. |
| 4 — News and macro | Add licensed source-attributed news/calendar data. | UTC event time and local display are tested; attribution, deduplication, revisions, and missing values are represented; external text is treated as untrusted. |
| 5 — Technical analysis | Add deterministic features and configurable setup rules. | Unit and boundary tests cover indicator inputs, gaps, precision, and strategy rules; outputs retain data provenance; no unsupported predictive claims. |
| 6 — AI copilot | Generate constrained evidence-based reports. | Schema validation rejects malformed output; reports list sources, timestamps, assumptions and limitations; prompt-injection cases are tested; model output cannot execute orders. |
| 7 — Risk and paper trading | Add deterministic risk controls and simulation. | Position sizing uses verified specifications; risk limits fail closed; paper fills/costs/lifecycle are reproducible and tested; no broker route is available. |
| 8 — Backtesting | Evaluate strategies without leakage. | Reproducible runs use timestamped data, explicit costs, separate out-of-sample periods, gap handling, and validated metrics; results are not represented as future guarantees. |
| 9 — Production hardening | Prepare research/paper features for controlled deployment. | Authz, secrets, rate limits, monitoring, backups/recovery, deployment, incident handling, and security checks are tested and documented. |
| 10 — Optional broker integration | Consider a separate broker project/release only after explicit approval. | Broker/demo mode, mapping, reconciliation, idempotency, deterministic controls, kill switch, audit trail, and independent security review pass; live execution remains disabled absent explicit authorization. |

## Phase 1 foundation delivered

- `apps/web`: minimal Next.js App Router page and no-cache `/api/health` endpoint.
- `apps/api`: Fastify `/health` liveness and `/ready` database-readiness endpoints. Readiness returns HTTP 503 if MongoDB is unconfigured or unavailable.
- Runtime config is parsed with Zod; error messages identify invalid variable names without echoing values. Fastify redacts authorization and cookie headers.
- pnpm workspace uses a checked-in lockfile and Node 22.9+; `docker-compose.yml` provides a loopback-only, digest-pinned MongoDB service for local development.
- CI runs lint, typecheck, tests, and production builds. The API tests exercise config validation, health, and missing-database behavior.

This foundation does not persist application data, connect to any market-data provider, or provide authentication. The local MongoDB container has no authentication and must not be used as a production deployment.

## Smallest useful next milestones

1. **Review Phase 0 decisions:** confirm or revise the proposed Next.js + TypeScript, Node.js API, MongoDB, and modular-monolith boundaries. Verify provider requirements and licensing before selecting a vendor.
2. **Phase 2 provider gate:** verify provider coverage, history, quote semantics, costs, limits, and data-use terms. No provider is chosen yet.
3. **Phase 2 vertical slice:** after the provider gate passes, implement one adapter and demonstrate real quotes/candles with provenance for all three instruments before building AI or chart workflows.

## Phase 1 verification

Verified in this workspace: frozen pnpm install, lint, typecheck, all 6 API tests, and API/web production builds pass. The API `/health`, API `/ready` against the local MongoDB container, and web `/api/health` responded successfully in runtime smoke checks. The unit suite confirms `/ready` returns HTTP 503 when MongoDB is unconfigured or unreachable. CI is configured but has not yet run on GitHub.

## Open questions and risks

- Which market-data vendor/account/region and plan can provide the required instruments and permitted data use?
- Is bid/ask and streaming required for the first data slice, or are documented REST quote/candles sufficient?
- What hosting, authentication, secrets manager, domain, and MongoDB deployment are intended?
- Which timezone should the UI default to? The master prompt suggests `Africa/Harare`, but this has not been confirmed as a user requirement.
- Which news, economic-calendar, AI, and charting providers are acceptable under cost and licensing constraints?
- Contract specifications and account-currency conversion must be verified before any position-size feature.

## Verification record

- Inspected repository files and Git state after syncing `main`.
- Read the master prompt and confirmed the requested Phase 0 outputs.
- Attempted to retrieve vendor official docs; DNS lookup failed for each site. Provider coverage, prices, quotas, freshness, and licensing are explicitly unverified.
- Phase 1 local validation: `pnpm lint`, `pnpm typecheck`, `pnpm test` (6 passing), `pnpm build`, frozen install, Mongo-backed readiness, and web/API health smoke checks all passed.
- CI workflow has been committed locally but has not yet been observed running remotely.
