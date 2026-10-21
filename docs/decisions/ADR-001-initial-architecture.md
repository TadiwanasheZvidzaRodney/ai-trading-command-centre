# ADR-001: Initial architecture

- **Status:** Accepted for the Phase 1 foundation; provider and production choices remain open
- **Date:** 2026-10-21

## Context

The repository currently contains project documentation only. The intended product is a personal market-research and trade-planning application, initially covering XAU/USD, EUR/USD, and GBP/USD. Requirements call for Next.js/React/TypeScript, Node.js, MongoDB, real provider adapters, deterministic financial calculations, and research mode before paper trading. Live trading is not an initial deliverable.

## Decision proposal

Use a TypeScript modular monolith with a pnpm workspace, a Next.js web app, a separate Node.js API (Fastify), and MongoDB. Keep provider integrations behind server-side interfaces and keep domain/risk logic independent of vendors and AI. Add only packages and services needed by implemented features; do not create empty modules to match a target diagram.

For the initial API contracts and environment validation, evaluate a runtime schema library such as Zod. Select test tooling and charting only after implementation scope and current licensing are checked. Do not pin dependency versions or add dependencies in this architecture-only milestone.

## Rationale

This follows the stated stack preferences while keeping the first release small and provider-independent. A modular monolith is proportionate to a personal application and leaves service extraction as a later evidence-based choice. Separating web and API boundaries supports server-side credentials and centralized validation/risk enforcement.

## Consequences

- Phase 1 provides executable web/API scaffolding, but not a complete trading application.
- Provider, AI, news, calendar, charting, hosting, authentication, and job-scheduling choices remain open.
- Phase 1 must prove a reproducible local setup, health checks, environment validation, logging, persistence connectivity, and CI before market-data integration.
- No broker integration or live order route is authorized.
- The Next.js ESLint plugins in this scaffold currently require ESLint 9; the selected version is deprecated upstream, so revisit the linter once those plugins support a newer ESLint major without weakening peer-dependency checks.

## Revisit when

Revisit if deployment constraints, workload, team ownership, verified provider requirements, or an explicit user decision make the proposed workspace/API/database boundaries unsuitable.
