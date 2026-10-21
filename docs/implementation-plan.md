# Implementation plan

**Current phase:** Phase 0 — Discovery and architecture  
**Status:** Repository assessment and proposed architecture documented; provider facts and architecture review remain open.

## Repository assessment

The initial branch contained a title-only `README.md`. After syncing the current `main`, the repository contains `README.md` and `COPILOT_MASTER_PROMPT.md` only. There is no application, framework, package manager, dependency manifest, scripts, test suite, environment configuration, CI, database, or provider credentials. No build, lint, typecheck, or test command exists or was run.

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

## Smallest useful next milestones

1. **Review Phase 0 decisions:** confirm or revise the proposed Next.js + TypeScript, Node.js API, MongoDB, and modular-monolith boundaries. Verify provider requirements and licensing before selecting a vendor.
2. **Phase 1 foundation:** after review, add a minimal workspace containing one web app and one API, configuration validation, health endpoints, structured redacted logging, MongoDB connectivity, CI, and a small test suite. Avoid empty feature packages.
3. **Phase 2 vertical slice:** implement one provider adapter only after terms/coverage are verified; demonstrate a real quote and candle with provenance for all three instruments before building AI or chart workflows.

No software dependencies, credentials, Docker setup, or app code are added in this Phase 0 documentation milestone.

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
- No application commands exist; no tests/build/lint were run.
