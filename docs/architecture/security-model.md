# Proposed security model

**Status:** Phase 0 proposal; no authentication, API, database, or deployment exists yet.

## Assets and trust boundaries

Protect user research and journal data, provider/model credentials, database access, and any future broker credentials. Treat the browser, external market/news/calendar responses, AI output, and user-supplied text as untrusted. A future broker integration has a separate approval and security gate and is not part of the initial application.

## Required controls before deployment

- Keep secrets server-side, out of the browser bundle, logs, source control, and error responses. Use a managed secret store in production.
- Validate environment configuration at startup and fail clearly for missing required values.
- Authenticate users and authorize every private API resource; use secure cookies/session handling, CSRF protection where applicable, restrictive CORS, and rate limiting.
- Validate incoming and external data with schemas; encode output and avoid unsafe rendering of external text.
- Set request timeouts and bounded retry/backoff policies; avoid retrying non-idempotent actions blindly.
- Use least-privilege database credentials, protected network access, backups, and tested restore procedures.
- Log security-relevant events without credentials or sensitive payloads; define retention and deletion behavior.
- Pin and audit dependencies, and add CI checks before claiming a production-ready release.
- Fail closed when stale or missing data prevents a safe calculation; never fall back silently to mock values.

## AI and external-content defenses

External articles and API fields are data, never instructions. Isolate external text from system instructions, limit the evidence and tools available to the model, validate model output against a strict schema, and reject malformed output. Model output is advisory and cannot access secrets, call arbitrary tools, or bypass server-side risk controls.

## Trading safety

Initial mode is research only. Paper trading, if later approved, must be isolated from broker credentials and real order routes. Live execution is disabled by default and requires separate explicit approval, broker-specific validation, deterministic server-side limits, idempotency, reconciliation, audit, and an emergency stop. No AI text can submit, modify, or cancel live orders.

## Open security decisions

Authentication provider, session model, hosting, secrets manager, personal-data retention, and database deployment have not been selected. Decide and test these before collecting sensitive user data or deploying beyond local development.
