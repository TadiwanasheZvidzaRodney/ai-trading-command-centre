# Proposed data flow

**Status:** Phase 0 proposal; no data pipeline is implemented.

## Market observations

1. A server-side ingestion task requests quotes or candles from a configured provider adapter.
2. The adapter applies provider authentication, timeouts, and documented rate limits, then validates the response against a runtime schema.
3. Provider-specific symbols and fields are normalized into canonical instruments and UTC timestamps. Preserve source timestamp and retrieval timestamp separately.
4. Validate freshness, required fields, ordering, duplicates, gaps, and candle completeness. A failed or incomplete response is an explicit unavailable/degraded result, not a fabricated value.
5. Persist only data that the provider's terms permit. Keep provider identity and provenance with each record.
6. The API returns observations and their provider, instrument, timestamp/timezone, delay/freshness, and quality status to the web application.
7. The UI shows the data status and disables dependent analysis/planning when critical data is not trustworthy.

## Analysis and planning

1. The API gathers timestamped market observations and, in later phases, sourced news and calendar events.
2. Deterministic analysis computes configured technical features from validated inputs.
3. A later AI adapter may interpret a constrained evidence bundle and return schema-validated scenarios with citations, assumptions, limitations, and invalidation conditions.
4. A server-side deterministic risk module validates user-authored trade plans. It fails closed when required account/instrument specifications are unavailable.
5. Reports retain their input snapshot and model/prompt versions for review; analysis output never submits or changes an order.

## Trust boundaries

- Browser to API: authenticated/authorized requests and validated user inputs; never expose provider secrets.
- API to external provider/model: outbound requests with timeouts and explicit provider configuration. Treat all external text and payloads as untrusted.
- API to database: persist only validated, provenance-bearing records; apply access controls and retention rules.
- AI output to domain logic: untrusted, schema-validated interpretation only. It cannot override deterministic risk rules or initiate tool/order execution.

## Not yet decided

Provider polling versus streaming, scheduling/queue technology, caching duration, retention periods, database indexes, news/calendar sources, and model-provider selection depend on verified provider terms and workload. Do not assume market data may be redistributed or persisted indefinitely.
