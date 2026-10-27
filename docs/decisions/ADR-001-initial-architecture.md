# ADR-001: Initial Architecture

- **Status:** Accepted
- **Date:** 2026-10-27
- **Deciders:** Project owner

## Context

The project is a personal, single-user trading research platform for XAU/USD, EUR/USD
and GBP/USD. It must start at $0, run locally, use real data, and later support paper
trading and optional broker integration. The repository began empty apart from a
master prompt and a one-line README.

Key forces:

- Correctness and provenance matter more than feature count.
- Financial arithmetic and risk enforcement must be deterministic and testable.
- External providers must be replaceable without rewriting domain logic.
- The system must run on a developer laptop with free tooling.
- Live execution must be impossible to enable accidentally.

## Decision

Build a **TypeScript modular monolith** with:

- **npm workspaces** monorepo (`apps/*`, `packages/*`).
- **Next.js 16 / React 19** web app in `apps/web`.
- **Fastify 5** API in `apps/api`.
- **MongoDB 8** for persistence, with local Docker Compose and an in-memory option for
  tests.
- **Zod 4** for runtime validation and shared schemas.
- **Vitest 5** for unit/integration tests.
- **Pino** for structured logging.
- **TradingView Lightweight Charts** for candlesticks.
- **Decimal.js** for position sizing and P&L.
- **Provider interfaces** in dedicated packages; adapters are the only vendor-specific
  code.
- **Single-user session auth** with bcrypt, opaque server-side sessions and CSRF tokens.
- **In-process schedulers** for ingestion and paper-trade monitoring, with a documented
  path to a durable worker when needed.

The API composes domain packages; the web app never contains authoritative financial
logic.

## Alternatives considered

| Alternative | Why not now |
| --- | --- |
| Microservices | No demonstrated scaling need; adds operational cost and failure modes. |
| NestJS | Capable, but heavier than needed for a single-user API. Fastify keeps the surface small. |
| PostgreSQL | MongoDB is the stated preference and fits flexible provider payloads/history. Can revisit if relational reporting becomes dominant. |
| Separate worker service | Adds deployment complexity; in-process scheduler is sufficient for one user. Revisit if jobs must survive API restarts or scale independently. |
| Next.js API routes only | Mixes UI and long-running ingestion; a separate API gives clearer security and scheduling boundaries. |
| pnpm | The environment did not have pnpm; npm workspaces are built in and sufficient. |
| JWT sessions | Opaque server-side sessions allow immediate revocation and simpler single-user semantics. |

## Consequences

Positive:

- One deployable API and one web app; easy local development.
- Strong typing and shared schemas reduce API/UI drift.
- Provider swaps are isolated.
- Risk and analysis logic can be tested without HTTP or a database.
- npm is already installed; no extra package-manager bootstrap.

Negative:

- A monorepo needs disciplined dependency direction; lint and review must enforce it.
- In-process schedulers stop when the API stops; acceptable for a personal app, but
  documented as a limitation.
- MongoDB document modelling requires care for time-series candles; indexes and
  retention must be managed.
- Single-user auth is intentionally simple and not a multi-tenant design.

## Follow-up decisions

- ADR-002: zero-budget data strategy.
- ADR-003: single-user authentication and session handling (implementation phase).
- ADR-004: paper-trading fill model and cost assumptions (implementation phase).
