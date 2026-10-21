# AI Trading Command Centre

A research-first foundation for market data, analysis, and trade planning for XAU/USD, EUR/USD, and GBP/USD. The current milestone provides a Next.js web shell and a Node.js API foundation; it does not yet retrieve market data or implement trading.

> Live execution is not implemented. Initial operation is research-only; do not treat generated or external information as a trading signal.

## Requirements

- Node.js 22.9 or newer (a supported Node 22 release is recommended).
- Corepack and pnpm 10.34.7.
- Docker Compose for the local MongoDB service.

## Local setup

```sh
corepack enable
corepack prepare pnpm@10.34.7 --activate
cp .env.example .env
docker compose up -d mongodb
pnpm install --frozen-lockfile
pnpm dev
```

Open the web app at <http://localhost:3000>. The API listens on `127.0.0.1:4000` by default:

- `GET /health` is a liveness check and does not imply that dependencies are available.
- `GET /ready` pings MongoDB and returns HTTP 503 if the database is missing or unavailable.
- The web app health endpoint is `GET /api/health`.

The Compose MongoDB service is for local development only. It has no authentication and binds its host port to loopback; do not expose it to a network or reuse this configuration in production. `MONGODB_URI`, `API_HOST`, and `API_PORT` may be changed in the ignored root `.env` file. Environment configuration is validated at API startup, and credentials must never be committed or sent to the browser.

## Quality checks

Run from the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions runs the same checks on pushes and pull requests. Current automated tests cover API environment validation, liveness, and fail-closed readiness behavior; they do not prove live provider reliability.

## Current limitations

- No market-data, news, calendar, AI, charting, authentication, or broker integration is configured.
- Provider evaluation remains open pending verifiable coverage, freshness, rate limits, cost, and licensing evidence.
- Database persistence is not yet implemented; the API readiness endpoint only checks connectivity.
- There are no trading features. Financial calculations, paper trading, and live execution are future phases and require separate validation.

See the [implementation plan](docs/implementation-plan.md), [system design](docs/architecture/system-design.md), and [master project prompt](COPILOT_MASTER_PROMPT.md).
