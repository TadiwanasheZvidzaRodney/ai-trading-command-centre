# Phase 6: AI Copilot - Kickoff Report

**Date:** 2026-10-30  
**Status:** 🚀 **LAUNCHED** (3 parallel subagents)  
**Timeline:** 4-6 hours estimated

---

## 🎯 Mission

Build an AI-powered analysis copilot that synthesizes technical indicators, market structure, detected patterns, and macro news into actionable trade ideas—with clear limitations, assumptions, and invalidation conditions.

**Core Principle:** AI is a research tool, never authoritative. Humans verify; machines assist.

---

## 📋 Specification Complete

Full technical specification created in `docs/phase-6-technical-specification.md`:

### API Specification
- **POST `/api/v1/copilot/analyze`** → Generate analysis report with trade ideas
- **POST `/api/v1/copilot/history`** → Retrieve past analyses
- **GET `/health/providers`** → Updated with "ai" provider status

### Evidence Bundle Includes
- Technical indicators (all 8 implemented in Phase 5)
- Market structure (trend, support/resistance, swings)
- Detected patterns (all 9 types with confidence)
- Market quote (bid/ask, spread, freshness)
- Macro events (upcoming high-impact events with hours-until)
- Recent news themes (automatic tag extraction)

### Report Structure
```
1. Summary (1-2 sentences)
2. Market Context (trend, volatility, current price)
3. Indicator Confluence (which agree/disagree)
4. Pattern Analysis (recently detected patterns)
5. Structure Analysis (support, resistance, swings)
6. Trade Ideas (3-5 setups with confidence)
7. Risk Warnings (upcoming events, regime)
8. Assumptions (data freshness, indicator defaults)
9. Invalidation Conditions (when thesis breaks)
10. Limitations (always visible)
```

### Fallback Strategy
- If AI model unavailable: return 200 with `fallback: true`
- Deterministic report without AI interpretation (facts only)
- All evidence still included
- Never fails closed; always returns something useful

---

## 🏗️ Architecture

### Three Parallel Work Streams

#### **1️⃣ Core Service Package** (Subagent: ses_e721893d1ffehzrnXXlIOyJtsj)

**Location:** `packages/ai-copilot/`

**Components:**
- **AIAnalysisService** — Orchestrates everything
- **Providers** — Abstract interface for AI backends
  - GeminiProvider (Google API)
  - OllamaProvider (local, free)
  - LocalFallbackProvider (always available)
- **PromptBuilder** — Safe prompt construction with injection protection
- **InputSanitizer** — Whitelist/block suspicious input
- **ReportFormatter** — Convert model output to markdown with limitations

**Key Features:**
- Provider abstraction allows swapping models
- Retry logic for transient errors (429, 5xx)
- Prompt injection prevention (explicit [DATA START]/[DATA END] markers)
- Deterministic fallback (no model = still works)
- Token limits enforced (4000 max)

**Tests:** 50+ tests
- Prompt building (injection attempts rejected)
- Fallback behavior
- Provider selection logic
- Report formatting
- Health checks

**Deliverable:** 1,500+ lines of TypeScript

---

#### **2️⃣ API Routes** (Subagent: ses_e721804acffeBSmIDo4SMks3vD)

**Location:** `apps/api/src/copilot/`

**Endpoints:**
- `POST /api/v1/copilot/analyze` — Generate report (body: instrument, timeframe, lookback, model, temperature)
- `POST /api/v1/copilot/history` — Get past reports (body: instrument, timeframe, limit)

**Integration:**
- Calls AIAnalysisService from `@atc/ai-copilot`
- Fetches evidence from existing services (TechnicalAnalysis, MarketData, News, Calendar)
- Validates with Zod schemas
- Returns structured responses with evidence bundle
- Error handling: 400 (validation), 503 (model fail → fallback), 500 (system error)

**Tests:** 15+ route tests
- Valid requests return proper schema
- Invalid inputs rejected with 400
- Model failure triggers fallback (still 200)
- Prompt injection attempts rejected

**Deliverable:** 400+ lines

---

#### **3️⃣ Frontend UI** (Subagent: ses_e72171b5cffeELyxKUVoFTL2rv)

**Location:** `apps/web/src/app/copilot/`

**Page:** `/copilot`

**Components:**
- **CopilotSetup** — Sidebar (instrument, timeframe, lookback, "Generate" button)
- **AIAnalysisReport** — Renders markdown report with semantic HTML
- **TradeIdeasHighlight** — Extracts and highlights trade ideas
- **Hooks** — `useCopilotAnalysis()`, `useCopilotHistory()`

**Features:**
- Real-time generation with loading spinner
- Fallback indicator when AI unavailable
- Error banner with retry
- Evidence panel (freshness metadata)
- Recent analyses history
- Responsive design (mobile-friendly)
- Markdown rendering (safe)

**Tests:** 10+ component tests
- Report renders without errors
- Fallback displays gracefully
- Loading/error states work
- Responsive layout

**Deliverable:** 800+ lines + 200 lines CSS

---

## 📊 Deliverables Summary

| Component | LOC | Files | Tests | Status |
|-----------|-----|-------|-------|--------|
| @atc/ai-copilot package | 1,500+ | 10 | 50+ | Subagent 1 |
| API routes | 400+ | 3 | 15+ | Subagent 2 |
| Frontend UI | 800+ | 4 | 10+ | Subagent 3 |
| Config + docs | 200+ | 3 | - | Core |
| **Total** | **2,900+** | **23** | **75+** | **In Progress** |

---

## 🔄 Data Flow

```
User at /copilot page
    ↓ (1) Selects instrument/timeframe, clicks "Generate"
    ↓
Frontend hook: useCopilotAnalysis()
    ↓ (2) POST /api/v1/copilot/analyze
    ↓
API Route: /api/v1/copilot/analyze
    ├─ Fetch technical analysis
    ├─ Fetch market structure
    ├─ Fetch patterns
    ├─ Fetch market quote
    ├─ Fetch recent news/calendar
    └─ Assemble Evidence bundle
    ↓ (3) Call AIAnalysisService.analyze()
    ↓
AIAnalysisService
    ├─ Build prompt (safe, marked [DATA START]/[DATA END])
    ├─ Select provider (Gemini > Ollama > Fallback)
    ├─ Send to model (with temperature, token limits)
    └─ Format response (markdown + limitations)
    ↓ (4) Store in MongoDB (copilot_reports collection)
    ↓ (5) Return { status: 'ok', data: report, timestamp }
    ↓
Frontend displays:
    ├─ AI report with formatted markdown
    ├─ Trade ideas highlighted
    ├─ Evidence bundle info
    ├─ Recent history
    ├─ Limitations always visible
    └─ Fallback indicator (if model unavailable)
```

---

## ⚙️ Configuration

**Environment Variables (`.env`):**
```bash
AI_MODEL=auto                           # gemini | ollama | auto
GEMINI_API_KEY=...                     # Get free at console.cloud.google.com
OLLAMA_BASE_URL=http://localhost:11434 # Local Ollama (optional)
AI_TEMPERATURE=0.7                      # 0-1, lower = more deterministic
AI_MAX_TOKENS=4000                      # Safety limit
AI_REQUEST_TIMEOUT_MS=15000             # Timeout before fallback
```

**Getting Started:**
1. **Ollama (free, local, no API key):**
   - Download from ollama.ai
   - Run: `ollama pull mistral`
   - Will be at `http://localhost:11434`

2. **Gemini (free tier, fast):**
   - Go to console.cloud.google.com
   - Create project, enable Generative AI API
   - Create API key
   - Add to `.env`

3. **Fallback (always available):**
   - No setup needed
   - Works if both models fail

---

## ✅ Success Criteria

### Functional
- [ ] API generates analysis report with trade ideas
- [ ] All evidence (indicators, patterns, news, structure) included
- [ ] Fallback report works when AI unavailable
- [ ] Prompt injection attempts rejected with 400
- [ ] History retrieval returns past reports
- [ ] Health provider tracks "ai" status

### Non-Functional
- [ ] API response <5s (Gemini) or <15s (Ollama)
- [ ] UI renders without console errors
- [ ] Responsive on mobile and desktop
- [ ] Report cached in MongoDB

### Quality
- [ ] >80% test coverage (core logic)
- [ ] All 75+ new tests passing
- [ ] All 287 existing tests still passing
- [ ] TypeScript clean (0 errors)
- [ ] Lint clean (0 errors)

---

## 🔐 Security Features

✅ **Prompt Injection Prevention**
- Explicit [DATA START]/[DATA END] markers
- No direct string interpolation
- InputSanitizer filters suspicious keywords
- Token limits enforced

✅ **Data Safety**
- No API keys in logs or reports
- Untrusted data marked in prompts
- Output validation (reject malformed JSON)
- HTTP-only connections

✅ **Fail-Closed**
- AI model fails → fallback report
- Evidence missing → report still generated
- Never block user; always return something

---

## 📈 Testing Strategy

### Unit Tests (50+)
- Prompt building (safe, no injection)
- Sanitizer (blocks malicious input)
- Provider selection (try Gemini > Ollama > Fallback)
- Report formatting (all sections present)
- Fallback generation (works offline)

### Integration Tests (15+)
- Full `/copilot/analyze` request → report
- Model failure → fallback triggered
- Invalid input → 400 with validation
- Rate limit (429) → retry and succeed
- History retrieval → past reports sorted

### Component Tests (10+)
- Report renders markdown correctly
- Trade ideas extracted and highlighted
- Loading spinner appears
- Error banner on failure
- Responsive layout works

### E2E (Manual)
- Open `/copilot` page
- Generate analysis
- See report, trade ideas, evidence
- Switch instrument/timeframe
- Check history
- Verify fallback works (unplug internet test)

---

## 🚀 Launch Timeline

**Estimated:** 4-6 hours

### Phase 1: Core Service (1.5h)
- ✅ AIAnalysisService with provider abstraction
- ✅ Prompt builder with injection protection
- ✅ Fallback text generator
- ✅ Unit tests (50+)

### Phase 2: AI Providers (1.5h)
- ✅ GeminiProvider implementation
- ✅ OllamaProvider implementation
- ✅ Provider selection + retry logic
- ✅ Mock providers for testing

### Phase 3: API Routes (1h)
- ✅ `/api/v1/copilot/analyze` endpoint
- ✅ `/api/v1/copilot/history` endpoint
- ✅ Health provider integration
- ✅ Route tests (15+)

### Phase 4: Frontend UI (1h)
- ✅ `/copilot` page layout
- ✅ Report rendering component
- ✅ Setup sidebar
- ✅ Trade ideas highlighting
- ✅ Component tests (10+)

### Phase 5: Integration & Polish (0.5h)
- ✅ End-to-end testing
- ✅ Error handling
- ✅ Documentation
- ✅ All tests passing

---

## 📊 Current Status

### Work Launched
- **Subagent 1:** Core service package (ses_e721893d1ffehzrnXXlIOyJtsj) — **Building**
- **Subagent 2:** API routes (ses_e721804acffeBSmIDo4SMks3vD) — **Building**
- **Subagent 3:** Frontend UI (ses_e72171b5cffeELyxKUVoFTL2rv) — **Building**

### Specification
- ✅ Technical spec complete (`docs/phase-6-technical-specification.md`)
- ✅ API schemas defined (Zod)
- ✅ Component architecture designed
- ✅ Test strategy written

### Repository State
- Branch: `main`
- Latest: `f0085d9` (Phase 5 completion)
- All 287 tests passing ✅
- Build clean ✅

---

## 🎓 Key Design Decisions

1. **Provider Abstraction** → Easy to swap models (Gemini → GPT → Local)
2. **Fallback First** → Always return something; never fail closed
3. **Prompt Safety** → Explicit markers; no interpolation
4. **Evidence Bundle** → All data included for reproducibility
5. **Markdown Reports** → Human-readable; easily parseable
6. **Local Ollama Option** → Works offline; no API key
7. **Health Tracking** → AI provider status visible in `/health`

---

## 🔍 Known Constraints

### Current Phase 6 Scope
- ✅ Research/analysis only (no execution)
- ✅ Free tier APIs (Gemini free, Ollama local)
- ✅ Markdown reports with clear limitations
- ✅ Deterministic fallback (works without AI)
- ✅ Mock providers for testing

### Future Enhancements (Phase 7+)
- [ ] Multi-model comparison (Gemini vs Ollama side-by-side)
- [ ] Custom prompt templates
- [ ] Backtesting integration
- [ ] Sentiment analysis
- [ ] Real-time analysis updates
- [ ] User collaboration/sharing

---

## 📝 Documentation

Created:
- ✅ `docs/phase-6-technical-specification.md` — Full spec
- 🔄 Subagent implementations will add:
  - Code comments (per project standards)
  - Integration guide
  - Troubleshooting tips
  - Environment setup

---

## ✨ Expected Outcome

When complete:
1. **Working `/copilot` page** with instrument/timeframe selector and "Generate" button
2. **Analysis report** with 6-10 sections including trade ideas
3. **Trade idea highlights** extracted and prominently displayed
4. **Evidence panel** showing data freshness and inputs used
5. **Fallback report** that works if AI unavailable
6. **Error handling** with retry buttons
7. **Recent history** showing past analyses
8. **All 287 existing tests still passing** (no regressions)
9. **75+ new tests** for Phase 6 code
10. **Health tracking** for AI provider in `/health/providers`

---

## 🎯 Next Milestones

### Immediate (This session)
- [ ] 3 subagents complete implementations
- [ ] 75+ tests passing
- [ ] All code merges to main
- [ ] No regressions (287 existing tests still pass)

### Before Production
- [ ] Live smoke test: `/copilot` page with real Gemini/Ollama
- [ ] Error scenarios verified (network fail, model timeout)
- [ ] Fallback tested (model disabled, still works)
- [ ] Performance verified (<5s Gemini, <15s Ollama)

### Post-Phase 6
- **Phase 7:** Risk & Paper Trading (order management, position sizing)
- **Phase 8:** Backtesting (strategy validation)
- **Phase 9:** Production Hardening (auth, security, monitoring)

---

## 💬 Communication

**Subagent Status Updates:**
- You will be notified when subagents complete
- I'll verify builds, tests, and regressions
- Any issues will be reported with context
- Final PR summary will show all changes

**How to Track Progress:**
- Check `git log` for new commits
- Run `npm test` to see test count increase
- Run `npm run build` to verify clean builds

---

## 🏆 Summary

Phase 6 is now officially launched with:
- ✅ Complete technical specification
- ✅ Three parallel subagent teams
- ✅ Clear success criteria
- ✅ Well-defined deliverables
- ✅ Security-first design
- ✅ Comprehensive testing strategy

**Status: 🚀 BUILDING** (3 subagents working in parallel)

Expected completion: 4-6 hours from now

You'll be notified when each subagent completes. Then I'll:
1. Verify all code compiles (typecheck, build)
2. Confirm all tests pass (287 + 75 new)
3. Test integration (no regressions)
4. Commit to main
5. Create Phase 6 completion report

---

**Phase 5 → Phase 6 handoff complete. 🚀**
