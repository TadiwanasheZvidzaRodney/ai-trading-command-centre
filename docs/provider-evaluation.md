# Market-data provider evaluation

**Status:** Research pending; no provider selected  
**Last checked:** 2026-10-21

## User requirements and provisional ingestion choice

- Region: Zimbabwe. The user marked this “Allowed / Not Applicable”; this is user-provided context, not confirmation that a particular provider permits Zimbabwean accounts or API access.
- Use: personal research, with data stored for personal use.
- Budget: $0.
- Bid/ask: not required for the initial research workflow.
- Trading style: intraday analysis; no order execution is implemented.
- **Provisional choice: polling, not streaming.** Streaming is not needed for non-executing intraday research and adds connection/reconnect complexity. Start with a conservative 15-minute polling cadence, subject to the selected provider’s documented free-tier quotas and permitted use. This is a product decision, not a claim that a provider allows that cadence.
- Candle intervals and history depth remain provider/plan-gated. Prefer useful intraday bars and request the maximum history the verified zero-cost tier permits; never claim historical coverage until demonstrated.

## Current repository and research status

The project requires real quotes and historical candles for XAU/USD, EUR/USD, and GBP/USD. Price freshness, bid/ask fields, streaming, historical depth, cost, quotas, production terms, and permission to store/display data must be verified for the exact account region and plan.

Official vendor pages could not be retrieved in this session because outbound DNS lookups failed, including during the latest review after the user clarified requirements. The links below are starting points for a future review, not sources verified during this assessment. No current coverage, price, quota, latency, Zimbabwe eligibility, or licensing claim is made here.

## Candidate research queue

| Candidate | Official references to verify | Status |
|---|---|---|
| OANDA | [Instrument endpoints](https://developer.oanda.com/rest-live-v20/instrument-ep/), [pricing endpoints](https://developer.oanda.com/rest-live-v20/pricing-ep/), [API access](https://www.oanda.com/us-en/trading/api/), [legal](https://www.oanda.com/us-en/legal/) | Candidate only. Verify account/region eligibility, all three instrument mappings, quote/candle fields, history, stream limits, cost, and use/redistribution rights. |
| Twelve Data | [API documentation](https://twelvedata.com/docs), [pricing](https://twelvedata.com/pricing), [terms](https://twelvedata.com/terms-of-use) | Candidate only. Verify exact symbols, real-time/delay status, OHLC intervals/history, bid/ask and streaming by plan, quotas, cost, and data-use rights. |
| Alpha Vantage | [API documentation](https://www.alphavantage.co/documentation/), [premium plans](https://www.alphavantage.co/premium/), [terms](https://www.alphavantage.co/terms_of_service/) | Candidate only. In particular verify XAU/USD coverage, FX freshness/history, bid/ask or streaming support, current quotas/cost, and permitted use. |

This shortlist is not a recommendation. Do not infer XAU/USD support from a general FX coverage statement or assume that a REST endpoint provides streaming or executable prices.

## Required comparison before selection

For each provider and intended account/region, record official evidence for:

1. Exact symbol identifiers and coverage of XAU/USD, EUR/USD, and GBP/USD.
2. Quote semantics: bid, ask, midpoint, timestamp timezone, precision, source venue, and whether prices are delayed.
3. Candle intervals, available history, timezone/boundary rules, revisions, and volume meaning/availability.
4. Streaming availability, latency/update behavior, connection limits, and reconnect requirements.
5. Rate limits, concurrency, quotas, request costs, plan pricing, and overage behavior.
6. Personal/internal use, display, storage/retention, derived-data, and redistribution licensing.
7. API availability by jurisdiction, service support, production SLA, and failure behavior.

Use published product documentation and terms, not marketing assumptions. Record access date and direct URL for each verified claim; if terms are ambiguous, mark them unresolved and contact the provider before implementation.

## Proof-of-capability gate

Before choosing a provider:

- Make authorized test requests for all three instruments and a representative candle interval.
- Confirm the actual response fields, timestamps, freshness, precision, and history boundaries.
- Check the intended plan's stream/REST limits and test documented error/rate-limit behavior.
- Confirm licensing for the application's personal use, display, and persistence.
- Verify API access is available for the user's region and account.

No test requests or provider integration were performed. Credentials and subscriptions are not present in the repository.

## Phase 2 acceptance gate

Selection is complete only when coverage and plan terms are documented and the integration demonstrates real, timestamped values for all required instruments; stale/missing/error paths are surfaced; no mock fallback occurs; and terms permit the intended use. Provider selection alone is not evidence that the integration works.

Until this gate passes, no provider is selected and the application must show market data as unavailable rather than substitute fixture, generated, or stale values.
