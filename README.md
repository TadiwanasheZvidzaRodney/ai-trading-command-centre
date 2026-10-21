# AI Trading Command Centre

A planned research-first platform for market data, technical and macro analysis, trade planning, risk controls, and paper trading for XAU/USD, EUR/USD, and GBP/USD.

> This repository is in Phase 0 (discovery and architecture). It does not yet contain a runnable application, verified market-data integration, or trading functionality. Live execution is out of scope and must remain disabled unless separately implemented, validated, and explicitly approved.

## Project status

The repository currently contains project documentation only. Provider selection is pending verification of instrument coverage, data freshness, history, bid/ask availability, cost, limits, and licensing against current vendor documentation.

## Documentation

- [Master project prompt](COPILOT_MASTER_PROMPT.md)
- [System design](docs/architecture/system-design.md)
- [Data flow](docs/architecture/data-flow.md)
- [Security model](docs/architecture/security-model.md)
- [Initial architecture decision](docs/decisions/ADR-001-initial-architecture.md)
- [Provider evaluation](docs/provider-evaluation.md)
- [Implementation plan](docs/implementation-plan.md)

## Planned development setup

No package manager, application scripts, environment variables, database configuration, or tests have been added yet. Do not run the intended commands from the master prompt until they are implemented and documented here.

The proposed foundation is a TypeScript workspace with a Next.js web application, a Node.js API, and MongoDB. These choices remain proposals pending review; no dependencies or credentials are required for the current documentation-only milestone.

## Operating principles

- Begin in research mode; add paper trading only after deterministic risk and simulation tests.
- Use verified data with provider attribution and timestamps; surface missing or stale data rather than substituting mock values.
- Keep secrets server-side and financial arithmetic deterministic.
- Never represent AI output or historical performance as a guarantee.
- Do not implement or enable live order execution without separate approval and validation.

See the [implementation plan](docs/implementation-plan.md) for proposed phases and acceptance criteria.
