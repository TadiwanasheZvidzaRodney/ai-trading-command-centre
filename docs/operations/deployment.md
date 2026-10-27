# Deployment

**Status:** local development baseline. Production deployment is Phase 9.

## 1. Local development

Prerequisites: Node.js 22+, npm 11+, Docker Desktop.

```bash
npm install
cp .env.example .env
npm run db:up
npm run dev
```

Services:

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/health
- OpenAPI UI: http://localhost:4000/docs (development only)

## 2. Production topology (target)

```
Internet
  |
  v
Reverse proxy / TLS (HTTPS, HSTS)
  |-- /      -> Next.js web (port 3000)
  |-- /api   -> Fastify API (port 4000)
                 |
                 +--> MongoDB (private network, auth enabled)
                 +--> external providers (outbound HTTPS)
```

Recommended free-tier starting point:

- **Web:** Vercel free tier or a container host.
- **API:** Render/Fly.io/Railway free or low-cost container, with a health check.
- **DB:** MongoDB Atlas free tier (512 MB) or a small managed instance.
- **Secrets:** hosting provider's secret manager; never commit `.env`.

If the web and API are on different origins, set `WEB_URL` to the exact web origin and
`NEXT_PUBLIC_API_URL` to the API origin. CORS is restricted to `WEB_URL`.

## 3. Environment rules

Production startup must fail when:

- `NODE_ENV=production` and `AUTH_MODE=disabled`;
- `LIVE_TRADING_ENABLED=true` (live execution is not implemented);
- `SESSION_SECRET` is missing, too short, or the development placeholder;
- `MONGODB_URI` is missing;
- `WEB_URL`/`API_URL` are missing or invalid.

Provider keys are optional. Missing keys produce a visible `not_configured` state, not a
mock fallback.

## 4. Build and run

```bash
npm ci
npm run build
npm run start:api
npm run start:web
```

The API bundle is built with `tsup` and includes workspace packages. The web app uses
`next build`.

## 5. Database

- Enable MongoDB authentication in any shared environment.
- Restrict network access to the API host.
- Create indexes on first boot (the API runs an idempotent index setup).
- Candles and news grow over time; define retention (for example, keep daily candles
  indefinitely and intraday candles for 12 months).
- Back up daily; test restore quarterly.

## 6. Health and monitoring

- `/health` checks process liveness and database connectivity.
- `/health/providers` reports each provider's last success, latency, error and
  configuration state.
- Structured JSON logs include request id, route, status, duration and redacted actor.
- Alert on: API down, health failing, provider failing repeatedly, ingestion stale,
  disk/database near capacity, repeated login failures.

## 7. Backups and recovery

Minimum procedure:

1. `mongodump` (or Atlas snapshot) daily to encrypted storage.
2. Retain 7 daily, 4 weekly, 3 monthly copies.
3. Restore into a staging database and verify counts, indexes and a sample of candles,
   news and paper trades.
4. Record the restore date and result in the operations log.

## 8. Deployment checklist

- [ ] HTTPS and secure cookies.
- [ ] `AUTH_MODE=session` with a strong password hash.
- [ ] Unique 32+ character `SESSION_SECRET`.
- [ ] `LIVE_TRADING_ENABLED=false`.
- [ ] MongoDB auth + private network.
- [ ] Backups configured and a restore tested.
- [ ] Provider health visible.
- [ ] Rate limits enabled.
- [ ] Logs redacted and retained.
- [ ] Smoke test: health, login, dashboard, real quote with provenance, paper risk
      rejection.

## 9. Rollback

- Keep the previous container image/build.
- Roll back the app, then verify `/health` and a read-only dashboard.
- Do not roll back the database schema blindly; migrations/index changes must be
  backward compatible or have a documented reverse plan.
- Record the incident and the rollback reason.
