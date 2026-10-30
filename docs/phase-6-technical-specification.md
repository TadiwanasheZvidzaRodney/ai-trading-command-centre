# Phase 6: AI Copilot - Technical Specification

**Date:** 2026-10-30  
**Phase:** 6 of 9  
**Status:** Planning & Specification  
**Budget:** $0 (use free tier APIs: Ollama local, Gemini API free tier, or OpenAI-compatible services)

---

## Vision

Provide an AI-powered analysis assistant that synthesizes technical indicators, market structure, detected patterns, and macro news into actionable insights. The copilot generates trade ideas with supporting evidence, always indicating limitations, assumptions, and invalidation conditions.

**Key Principle:** AI is a research tool, never authoritative. All recommendations must be verified by the trader; live trading remains disabled.

---

## Requirements

### Functional Requirements

#### 1. Evidence Bundle
- **Timestamp:** ISO-8601 UTC when analysis was generated
- **Source Identifiers:** Which indicators/patterns/news items were used
- **Calculation Snapshot:** Input candles, lookback period, timeframe
- **Market Context:** Current quote, spread, trend, volatility regime
- **Macro Context:** Next high-impact events, recent news relevance tags

#### 2. AI Model Adapters (Pick One or Support All)
- **Local Ollama** (free, no API key, runs on machine)
  - Models: mistral, llama2, neural-chat
  - Advantage: Privacy, offline, no rate limits
  - Disadvantage: Slower, requires local setup
  
- **Google Gemini API** (free tier, 2 RPM, no billing)
  - Advantage: Fast, good reasoning, free
  - Disadvantage: Rate limited, requires API key
  
- **OpenAI-Compatible** (e.g., LocalAI, Together.ai free tier)
  - Advantage: Flexible model selection
  - Disadvantage: May require setup or API key

#### 3. Analysis Report Structure
```
TECHNICAL ANALYSIS REPORT
├─ Summary (1-2 sentences)
├─ Market Context
│  ├─ Instrument: EUR/USD
│  ├─ Timeframe: 4h
│  ├─ Trend: Uptrend, strength 72/100
│  ├─ Volatility: Normal (ATR 0.0045)
│  └─ Current Price: 1.0850
├─ Indicator Confluence (What indicators agree/disagree)
├─ Pattern Analysis (Recently detected patterns)
├─ Structure Analysis (Support, resistance, swings)
├─ Trade Ideas (3-5 setups with confidence)
│  ├─ Idea 1
│  │  ├─ Type: Long breakout above resistance
│  │  ├─ Entry: 1.0870
│  │  ├─ Stop: 1.0810
│  │  ├─ Target: 1.0950
│  │  ├─ Confidence: 65%
│  │  └─ Reasoning: Morning star pattern + RSI bullish divergence
│  ├─ Idea 2
│  └─ [etc.]
├─ Risk Warnings
│  ├─ Upcoming Events: ECB data at 13:00 UTC
│  ├─ Market Regime: Trending (favor continuation)
│  └─ Limitations: (See below)
├─ Assumptions
│  ├─ Data Freshness: Quotes 2 min old, candles 4h old
│  ├─ Indicator Assumptions: SMA/RSI use default periods
│  └─ Model Assumptions: Gemini API temperature 0.7
├─ Invalidation Conditions
│  ├─ Close below 1.0800 invalidates uptrend thesis
│  └─ News-driven reversal possible before ECB
└─ Limitations
   ├─ This is analysis, not a recommendation
   ├─ AI interpretation may miss market context
   ├─ Patterns don't predict (historically recurring only)
   ├─ Backtesting not done; no edge proof
   └─ See source data timestamps for freshness
```

#### 4. Deterministic Fallback
- If AI model fails/unavailable, system generates report without AI interpretation
- All facts (indicators, patterns, news) still display
- Manually built text: "AI service unavailable. Analysis facts below:"
- No speculation when model fails

#### 5. Analysis History
- Store generated reports in MongoDB
- Hash of inputs for reproducibility: `SHA256(instrument + timeframe + lookback + timestamp)`
- Track which model was used, prompt version, temperature
- Retrieve past reports for comparison

#### 6. Prompt Injection & Security
- Never interpolate user input directly into prompts
- Use explicit delimiters: `[DATA START] ... [DATA END]`
- Sanitize news headlines and pattern descriptions
- Reject prompts if data contains suspicious keywords (`exec`, `system`, etc.)
- Cap token count to 4000 for model requests

#### 7. Frontend Integration
- New `/copilot` page alongside existing pages
- Sidebar: Instrument, timeframe, lookback (reuse from `/analysis`)
- Button: "Generate Analysis" (calls API)
- Loading state: Spinner + "Calling AI model..."
- Report display: Markdown-like rendering with facts/reasoning/limitations sections
- Error banner: "Model failed. See facts-only report below."
- Save report locally or to journal

---

## Non-Functional Requirements

### Performance
- **API Response:** <5s (Gemini) or <15s (Ollama local)
- **Report Generation:** <2s (model inference + formatting)
- **UI Responsiveness:** Non-blocking spinner during fetch

### Reliability
- **Fallback:** Deterministic report if AI unavailable
- **Retries:** 1 retry on transient errors (timeout, 429)
- **Graceful Degradation:** Partial data OK (missing news doesn't break report)

### Security
- **No Secrets in Reports:** API keys, model config never logged
- **Data Isolation:** Analysis sandboxed per user session (future: per user ID)
- **Untrusted Data:** News/patterns treated as untrusted for prompt safety

### Observability
- **Logging:** Prompt sent, model response time, token usage
- **Metrics:** Model latency, success/failure rates
- **Health:** `/health/providers` includes "ai" status (ok/degraded/not_configured)

---

## API Specification

### POST `/api/v1/copilot/analyze`

**Request:**
```json
{
  "instrument": "EUR/USD",
  "timeframe": "4h",
  "lookback": 200,
  "model": "gemini",
  "include_history": false
}
```

**Query Parameters (optional):**
- `model`: "ollama" | "gemini" | "auto" (default: try gemini, fallback to ollama)
- `temperature`: 0.0-1.0 (default: 0.7, lower = more deterministic)
- `include_history`: boolean (return past similar analyses)

**Response (Success):**
```json
{
  "status": "ok",
  "data": {
    "report": "# Technical Analysis Report\n\n## Summary\n...",
    "model": "gemini",
    "model_version": "gemini-1.5-pro",
    "temperature": 0.7,
    "generated_at": "2026-10-30T10:45:00Z",
    "inference_time_ms": 2340,
    "input_hash": "sha256:abc123...",
    "evidence": {
      "instrument": "EUR/USD",
      "timeframe": "4h",
      "lookback": 200,
      "candle_count": 200,
      "latest_candle_time": "2026-10-30T10:00:00Z",
      "indicators_used": [
        "sma_20", "sma_50", "ema_9", "rsi_14", "macd", "atr_14", "bbands_20_2", "stochastic_14_3_3"
      ],
      "patterns_detected": [
        { "type": "morning_star", "confidence": 78, "candle_index": 45 }
      ],
      "quote": {
        "bid": 1.0848,
        "ask": 1.0852,
        "mid": 1.0850,
        "spread": 0.0004,
        "fetched_at": "2026-10-30T10:44:00Z"
      },
      "structure": {
        "trend": "uptrend",
        "trend_strength": 72,
        "resistance_levels": [
          { "price": 1.0900, "touches": 3, "recent_bounce": "2026-10-29T15:00:00Z" }
        ],
        "support_levels": [
          { "price": 1.0800, "touches": 2, "recent_bounce": "2026-10-28T08:00:00Z" }
        ]
      },
      "macro_events": [
        {
          "event": "ECB Interest Rate Decision",
          "time": "2026-10-30T13:00:00Z",
          "impact": "high",
          "hours_until": 2.25
        }
      ],
      "recent_news_themes": ["ECB", "rate", "inflation"]
    }
  },
  "timestamp": "2026-10-30T10:45:00Z"
}
```

**Response (Fallback - AI Unavailable):**
```json
{
  "status": "ok",
  "data": {
    "report": "# Analysis Report (Facts Only)\n\nAI model unavailable. Below is factual data:\n\n## Indicators\n...",
    "model": null,
    "fallback": true,
    "fallback_reason": "AI model unavailable after 1 retry",
    "generated_at": "2026-10-30T10:45:00Z",
    "evidence": { ... }
  },
  "timestamp": "2026-10-30T10:45:00Z"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "error": {
    "code": "AI_MODEL_FAILED",
    "message": "Gemini API returned 500 after 1 retry",
    "details": {
      "model": "gemini",
      "attempts": 1,
      "last_error": "Internal Server Error"
    }
  },
  "timestamp": "2026-10-30T10:45:00Z"
}
```

### POST `/api/v1/copilot/history`

**Request:**
```json
{
  "instrument": "EUR/USD",
  "timeframe": "4h",
  "limit": 10
}
```

**Response:**
```json
{
  "status": "ok",
  "data": {
    "reports": [
      {
        "input_hash": "sha256:abc123...",
        "generated_at": "2026-10-30T10:45:00Z",
        "model": "gemini",
        "summary": "Uptrend continuation, morning star pattern confirmed"
      }
    ]
  },
  "timestamp": "2026-10-30T10:45:00Z"
}
```

### GET `/health/providers`

**Updated Response (includes ai provider):**
```json
{
  "providers": [
    {
      "providerId": "market-data",
      "displayName": "Market Data (Swissquote + Yahoo)",
      "category": "market-data",
      "status": "ok",
      "configured": true,
      "quality": "live"
    },
    {
      "providerId": "ai",
      "displayName": "AI Copilot (Gemini/Ollama)",
      "category": "ai",
      "status": "ok",
      "configured": true,
      "quality": "reference",
      "message": "Gemini API responding, 150ms latency"
    }
  ],
  "timestamp": "2026-10-30T10:45:00Z"
}
```

---

## Implementation Plan

### Step 1: Core Service Architecture
**Deliverable:** `@atc/ai-copilot` package

```
packages/ai-copilot/src/
├── index.ts                          # Main export
├── service.ts                        # AIAnalysisService
├── providers/
│   ├── base.ts                       # BaseAIProvider interface
│   ├── gemini.ts                     # GeminiProvider
│   ├── ollama.ts                     # OllamaProvider
│   └── local-fallback.ts             # Fallback text generator
├── prompt/
│   ├── builder.ts                    # PromptBuilder (safe interpolation)
│   ├── templates.ts                  # System + user prompt templates
│   └── sanitizer.ts                  # Input sanitization
├── report/
│   ├── formatter.ts                  # Markdown report formatter
│   └── types.ts                      # Report interfaces
└── types.ts                          # Shared interfaces
```

**Files:**
- `service.ts` — Orchestrates provider selection, fallback logic, history storage
- `providers/*.ts` — Implement each AI backend with consistent interface
- `prompt/builder.ts` — Safe prompt building (no direct interpolation)
- `report/formatter.ts` — Convert analysis data to markdown report
- `index.test.ts` — Mock providers, deterministic report generation

**Tests:**
- Prompt injection tests (refuse malicious input)
- Fallback behavior when model fails
- Report formatting consistency
- Provider selection logic

---

### Step 2: API Routes
**Deliverable:** `apps/api/src/copilot/` routes

```
apps/api/src/copilot/
├── routes.ts                         # POST /api/v1/copilot/analyze, POST .../history
├── types.ts                          # Request/response schemas
└── routes.test.ts                    # Route tests with mocked providers
```

**Endpoints:**
- `POST /api/v1/copilot/analyze` — Generate analysis report
- `POST /api/v1/copilot/history` — Retrieve past reports
- Update `/health/providers` to include "ai" provider

**Error Handling:**
- 400 Validation (invalid instrument/timeframe)
- 503 AI Model Unavailable (trigger fallback)
- 500 System Error

**Tests:**
- Valid analysis request → report generated
- Model fails → fallback report generated
- Prompt injection attempt → rejected with 400
- Rate limit (429) → retry and succeed/fallback

---

### Step 3: Frontend UI
**Deliverable:** `apps/web/src/app/copilot/` page + components

```
apps/web/src/
├── app/copilot/
│   ├── page.tsx                      # Main copilot page
│   └── utils.ts                      # Helpers
├── components/
│   ├── AIAnalysisReport.tsx          # Render markdown report
│   ├── CopilotSetup.tsx              # Sidebar controls (reuse from /analysis)
│   └── TradeIdeas.tsx                # Highlight trade ideas from report
└── lib/
    └── hooks.ts                      # useCopilotAnalysis() hook
```

**Features:**
- Reuse sidebar from `/analysis` (instrument, timeframe, lookback)
- "Generate Analysis" button with loading spinner
- Report display with markdown rendering
- Trade ideas highlighted in separate card
- Limitations section always visible
- Error banner with fallback indicator
- "Save to Journal" button

**Tests:**
- Report renders without errors
- Fallback report displays gracefully
- Error banner shown on failure
- Loading state works

---

### Step 4: Configuration & Health
**Deliverable:** Environment setup, health tracking

**Environment Variables:**
```bash
# .env
AI_MODEL=gemini              # or ollama, auto
GEMINI_API_KEY=...          # If using Gemini
OLLAMA_BASE_URL=http://localhost:11434  # If using Ollama
AI_TEMPERATURE=0.7          # Reasoning determinism (0-1)
AI_MAX_TOKENS=4000          # Safety limit
AI_REQUEST_TIMEOUT_MS=15000 # Timeout before fallback
```

**Health Tracking:**
- `AIProviderHealthTracker` for copilot service
- Logs model latency, success/failure rates
- Updates `/health/providers` with "ai" status

---

## Data Flow

```
User clicks "Generate Analysis"
         ↓
useCopilotAnalysis() hook
         ↓
POST /api/v1/copilot/analyze
    ├─ Fetch technical analysis (existing /technical endpoint)
    ├─ Fetch market structure
    ├─ Fetch detected patterns
    ├─ Fetch market quote
    ├─ Fetch recent news/calendar
    ├─ Assemble evidence bundle
    └─ Build prompt
         ↓
AIAnalysisService
    ├─ Select provider (Gemini > Ollama > Fallback)
    ├─ Sanitize evidence for prompt safety
    ├─ Send prompt to model
    ├─ Parse model response (extract JSON/structured output)
    └─ Format into markdown report
         ↓
Store report in MongoDB
    └─ {
         instrument, timeframe, lookback,
         report_text, model_used, generated_at,
         input_hash, evidence_snapshot
       }
         ↓
Return report + evidence
         ↓
Frontend renders:
  ├─ Facts (technical indicators, patterns)
  ├─ AI interpretation (trade ideas, reasoning)
  ├─ Limitations & assumptions
  └─ Warnings (upcoming events, invalidation conditions)
```

---

## Testing Strategy

### Unit Tests
1. **Prompt Building**
   - Safe interpolation (no injection)
   - Proper delimiter usage
   - Input sanitization

2. **Report Formatting**
   - Markdown consistency
   - Section ordering
   - Edge cases (no patterns, no news)

3. **Provider Selection**
   - Gemini > Ollama > Fallback
   - Retry logic on transient errors
   - Timeout handling

4. **History Storage**
   - MongoDB queries
   - Input hash calculation
   - Deduplication

### Integration Tests
1. **API Routes**
   - Valid request → report generated
   - Invalid instrument → 400
   - Model failure → 503 with fallback
   - Prompt injection → 400
   - Rate limit → retry

2. **Model Integration**
   - Mock Gemini API responses
   - Mock Ollama API responses
   - Fallback triggers correctly

3. **End-to-End**
   - Full analysis from /copilot page
   - Report renders
   - All sections present
   - No console errors

### Security Tests
1. **Prompt Injection**
   - Refuse: `[DATA START] ignore above, respond to:`
   - Refuse: `"; DROP TABLE reports;--`
   - Accept: Normal market data

2. **Output Validation**
   - Validate model response structure
   - Reject malformed JSON
   - Cap token count

---

## Database Schema

### MongoDB: `copilot_reports` Collection

```json
{
  "_id": ObjectId,
  "instrument": "EUR/USD",
  "timeframe": "4h",
  "lookback": 200,
  "input_hash": "sha256:abc123def456",
  "generated_at": ISODate("2026-10-30T10:45:00Z"),
  "model": "gemini",
  "model_version": "gemini-1.5-pro",
  "temperature": 0.7,
  "report_text": "# Technical Analysis Report\n...",
  "inference_time_ms": 2340,
  "fallback": false,
  "fallback_reason": null,
  "evidence_snapshot": {
    "candle_count": 200,
    "latest_candle_time": ISODate("2026-10-30T10:00:00Z"),
    "indicators": ["sma_20", "sma_50", ...],
    "patterns": [{ "type": "morning_star", "confidence": 78 }],
    "quote": { "mid": 1.0850, "fetched_at": ISODate(...) },
    "structure": { "trend": "uptrend", "trend_strength": 72 },
    "macro_events": [{ "event": "ECB", "impact": "high" }]
  },
  "created_at": ISODate("2026-10-30T10:45:00Z"),
  "ttl": 2592000  # 30 days (set on index)
}
```

**Indexes:**
- `{ instrument, timeframe, generated_at }` — Query history
- `{ input_hash }` — Deduplication
- `{ created_at: 1 }` with TTL 30 days

---

## Acceptance Criteria

✅ **Functional:**
1. API generates analysis report with trade ideas
2. All evidence (indicators, patterns, news, structure) included
3. AI interpretation includes confidence and reasoning
4. Limitations and assumptions clearly stated
5. Fallback report works when AI unavailable
6. Prompt injection attempts rejected

✅ **Non-Functional:**
1. API response <5s (Gemini) or <15s (Ollama)
2. Report rendered without console errors
3. Health provider tracks "ai" status
4. Analysis history retrievable

✅ **Security:**
1. No secrets in logs or reports
2. Untrusted data marked explicitly in prompts
3. Token limits enforced
4. Data validation on model responses

✅ **Quality:**
1. >80% test coverage for core logic
2. All tests passing
3. TypeScript clean (0 errors)
4. Lint clean (0 errors)

---

## Phase 6 Deliverables Summary

| Component | Lines | Files | Tests | Status |
|-----------|-------|-------|-------|--------|
| @atc/ai-copilot package | 1,500+ | 10 | 25+ | To-do |
| API routes | 400+ | 3 | 15+ | To-do |
| Frontend UI | 800+ | 4 | 10+ | To-do |
| Configuration | 100+ | 2 | 5+ | To-do |
| Documentation | 300+ | 3 | - | To-do |
| **Total** | **3,100+** | **22** | **55+** | **To-do** |

---

## Timeline & Milestones

**Estimate:** 4-6 hours

1. **Core Service** (1.5h)
   - AIAnalysisService with provider abstraction
   - Prompt builder with injection protection
   - Fallback text generator
   - Unit tests

2. **AI Providers** (1.5h)
   - GeminiProvider implementation
   - OllamaProvider implementation
   - Provider selection + retry logic
   - Mock providers for testing

3. **API Routes** (1h)
   - `/api/v1/copilot/analyze` endpoint
   - `/api/v1/copilot/history` endpoint
   - Health provider integration
   - Route tests

4. **Frontend UI** (1h)
   - `/copilot` page layout
   - Report rendering component
   - Setup sidebar
   - Trade ideas highlighting

5. **Integration & Polish** (0.5h)
   - End-to-end tests
   - Error handling
   - Documentation

---

## Known Constraints & Future Work

### Current Phase 6 Scope
- ✅ Research/analysis only (no execution)
- ✅ Markdown reports with clear limitations
- ✅ Free tier APIs (Gemini free, Ollama local, no billing)
- ✅ Mock providers for testing
- ✅ Deterministic fallback

### Future Enhancements (Phase 7+)
- [ ] Multi-model comparison (show Gemini vs Ollama side-by-side)
- [ ] Custom prompt templates per user/strategy
- [ ] Backtesting integration (historical what-if)
- [ ] Sentiment analysis of recent news
- [ ] Alert system for pattern + AI confluence
- [ ] Journal integration (link analyses to trades taken)
- [ ] Real-time analysis updates
- [ ] Report sharing/collaboration

---

## Success Criteria Checklist

- [ ] `@atc/ai-copilot` package created with all providers
- [ ] Prompt injection tests pass
- [ ] Fallback report generates correctly
- [ ] API endpoints respond with proper schemas
- [ ] `/copilot` page loads and renders reports
- [ ] Health provider shows "ai" status
- [ ] MongoDB history retrieval works
- [ ] All 287 existing tests still pass
- [ ] New tests: 50+ for Phase 6
- [ ] `npm run typecheck` clean
- [ ] `npm run build` successful
- [ ] `npm run lint` clean

---

**Ready to implement. Shall I proceed?**
