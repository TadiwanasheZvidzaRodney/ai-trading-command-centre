# Security Model

**Status:** Phase 0 baseline; implementation details updated as code lands.
**Last updated:** 2026-10-27

## 1. Assets to protect

- Provider API keys, broker credentials (future) and the session secret.
- The single user's password hash and active sessions.
- Trading plans, paper positions, journal entries and account settings.
- Audit logs and analysis history.
- Integrity of risk limits and market-data provenance.

## 2. Actors and trust boundaries

| Actor | Trust | Notes |
| --- | --- | --- |
| Single user | Authenticated principal | Full access to their own data |
| Browser | Untrusted | Can be tampered with; server enforces all rules |
| External market/news/calendar APIs | Untrusted data | May be wrong, delayed or malicious |
| AI model provider | Untrusted output | Cannot authorise tools or orders |
| Internet attacker | Untrusted | Rate limits, auth, input validation |
| MongoDB | Trusted infrastructure | Network-restricted in production |

Boundaries:

```
Browser --(HTTPS, session cookie, CSRF)--> API
API --(server-side keys, timeouts)--> external providers
API --(structured evidence, no tools)--> AI provider
API --(authenticated connection)--> MongoDB
```

## 3. Authentication and authorisation

- Single-user model. One `users` record with a bcrypt password hash (cost 12).
- `AUTH_MODE=disabled` is allowed **only** in development and displays a persistent UI
  warning. Production startup fails if auth is disabled.
- `AUTH_MODE=session` requires `AUTH_USERNAME` and `AUTH_PASSWORD_HASH`.
- Login creates an opaque random session token; only its SHA-256 hash is stored in
  MongoDB. The raw token lives in an `HttpOnly`, `SameSite=Lax`, `Secure` (production)
  cookie with a TTL.
- Logout deletes the session. Password or configuration changes invalidate sessions.
- Every API route is private by default except `/health`, `/docs` (development only),
  `/api/v1/auth/login` and `/api/v1/auth/status`.
- There is no role system in v1. Authorisation is "the single user or nobody".

## 4. CSRF, CORS and browser protections

- State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a CSRF token:
  a random value in a non-HttpOnly cookie must match the `X-CSRF-Token` header.
- `SameSite=Lax` session cookies plus CSRF tokens protect against cross-site writes.
- CORS allows only `WEB_URL` with credentials; no wildcard origins.
- Security headers via Helmet: CSP, `X-Content-Type-Options`, frame denial,
  referrer policy, HSTS in production.
- JSON body size is capped; unknown fields are rejected by Zod schemas where practical.
- Output is rendered as text by React; no `dangerouslySetInnerHTML` for external
  content. Links open with `rel="noopener noreferrer"`.

## 5. Secrets

- Secrets live only in `.env` locally or a managed secret store in deployment.
- `.env` is git-ignored; `.env.example` contains placeholders only.
- The browser receives only `NEXT_PUBLIC_API_URL`; no provider keys.
- Logs redact `authorization`, `cookie`, `x-csrf-token`, API keys and passwords.
- Error responses never echo secrets or full provider payloads.
- Rotating `SESSION_SECRET` invalidates sessions (acceptable for a single user).

## 6. Input validation and data handling

- Zod validates every request body, query, params and provider response.
- Numeric financial inputs must be finite, positive where required, and bounded.
- Strings are length-limited and trimmed. URLs must be http(s).
- MongoDB queries use typed filters; no user-controlled operators or `$where`.
- News/calendar text is sanitised (HTML stripped) before storage/display.
- Uploads are not supported in v1.

## 7. Prompt injection and AI safety

External content is untrusted. The AI prompt:

- wraps news, calendar and provider text in explicit `<untrusted_data>` delimiters;
- instructs the model that content inside those delimiters is data, never instructions;
- exposes no tools, shell, browser, database or order functions;
- asks for JSON only, validated by a strict Zod schema;
- records model, prompt version and input snapshot hash.

Rejected or malformed output is stored as a failed analysis and never used for orders.
AI output can never:

- submit, modify or cancel an order;
- change risk limits or account settings;
- reveal secrets;
- trigger arbitrary network calls.

The risk engine and order validation are deterministic and independent of the model.

## 8. Rate limiting and abuse protection

- Global API rate limit (default 120 requests/minute/IP) via `@fastify/rate-limit`.
- Login attempts are limited more aggressively (default 10/15 minutes/IP).
- Provider adapters use per-provider concurrency limits, caching and backoff.
- The API enforces request timeouts and bounded response sizes.

## 9. Audit logging

Audit events include:

- login success/failure, logout, session invalidation;
- settings and risk-limit changes;
- analysis generation (model/prompt version, input hash);
- paper order create/fill/cancel/close and risk rejections;
- kill-switch activation/deactivation;
- provider configuration changes (not secret values).

Audit records contain actor, action, target, timestamp, request id and a redacted
metadata object. They are append-only from the application's perspective.

## 10. Data retention and privacy

- Single-user personal data; no third-party analytics or advertising.
- News stores headline, summary, link and metadata only.
- Raw provider payloads are not retained longer than needed for debugging.
- Sessions expire automatically (TTL index).
- A documented deletion procedure removes user data collections and backups according
  to the chosen hosting provider's retention.
- Backups must be encrypted and access-controlled.

## 11. Live-trading gate (future)

Live execution is **not implemented**. The following must exist before it is considered:

- a documented, supported broker API in demo mode;
- verified instrument mappings and contract specifications;
- deterministic server-side order validation and risk enforcement;
- idempotency, reconciliation and timeout handling;
- a kill switch and documented emergency procedure;
- audit trails, monitoring and alerting;
- explicit user authorisation and a separate release review.

`LIVE_TRADING_ENABLED=true` currently causes the API to refuse to start. It never
silently enables execution.

## 12. Threat table

| Threat | Impact | Mitigation |
| --- | --- | --- |
| Stolen session cookie | Account takeover | HttpOnly/Secure/SameSite, TTL, rotation, rate limits |
| CSRF on order/settings | Unauthorised changes | Double-submit CSRF token, SameSite, origin allowlist |
| XSS via news headline | Script execution | React escaping, HTML stripping, CSP |
| Prompt injection in news | Model misbehaviour | Delimited untrusted data, no tools, schema validation |
| Malicious provider payload | Bad prices/DoS | Zod validation, bounds, timeouts, circuit breaker |
| Fake data fallback | Unsafe decisions | Explicit errors, provenance, no silent mock fallback |
| Risk-limit bypass via UI | Excess loss | Server-side deterministic risk engine |
| Brute-force login | Account takeover | bcrypt, login rate limit, strong password guidance |
| Dependency compromise | Supply-chain attack | Lockfile, `npm audit`, Dependabot, minimal deps |
| Log leakage | Secret exposure | Redaction, structured logging, no payload dumps |

## 13. Open security items

- Add automated dependency and container scanning in CI.
- Add Playwright tests for login, CSRF and order rejection.
- Document production secret injection and backup encryption.
- Review provider terms of use before any public deployment.
