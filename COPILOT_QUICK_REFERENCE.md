# AI Copilot API Routes - Quick Reference

## Endpoints

### POST /api/v1/copilot/analyze
Generate AI analysis report for a market symbol and timeframe.

**Request:**
```json
{
  "instrument": "EUR/USD",
  "timeframe": "4h",
  "lookback": 200,
  "model": "auto",
  "temperature": 0.7,
  "include_history": false
}
```

**Response (200):**
```json
{
  "status": "ok",
  "data": {
    "report": "# Analysis Report\n...",
    "model": "gemini",
    "temperature": 0.7,
    "generated_at": "2026-10-30T17:45:32.210Z",
    "inference_time_ms": 2340,
    "input_hash": "abc123def456",
    "fallback": false,
    "evidence": { ... }
  },
  "timestamp": "2026-10-30T17:45:32.210Z"
}
```

**Parameters:**
- `instrument` (required): XAU/USD, EUR/USD, GBP/USD
- `timeframe` (required): 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1wk
- `lookback` (optional): 1-500, default 200
- `model` (optional): gemini, ollama, auto; default auto
- `temperature` (optional): 0-1, default 0.7
- `include_history` (optional): boolean, default false

**Error Responses:**
- 400: Invalid input (validation error with details)
- 500: Unexpected error

### POST /api/v1/copilot/history
Retrieve past analysis reports for an instrument/timeframe combination.

**Request:**
```json
{
  "instrument": "EUR/USD",
  "timeframe": "4h",
  "limit": 10
}
```

**Response (200):**
```json
{
  "status": "ok",
  "data": {
    "reports": [
      {
        "input_hash": "abc123def456",
        "generated_at": "2026-10-30T17:45:32.210Z",
        "model": "gemini",
        "summary": "Uptrend with morning star pattern"
      }
    ]
  },
  "timestamp": "2026-10-30T17:45:32.210Z"
}
```

**Parameters:**
- `instrument` (required): XAU/USD, EUR/USD, GBP/USD
- `timeframe` (required): 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1wk
- `limit` (optional): 1-100, default 10

## File Structure

```
apps/api/src/copilot/
├── types.ts          - Zod schemas for validation
├── routes.ts         - Route handlers and interfaces
└── routes.test.ts    - 23 comprehensive tests
```

## Key Classes & Interfaces

### AIAnalysisService
```typescript
interface AIAnalysisService {
  analyze(query: AnalyzeRequest): Promise<AnalysisReport>;
  getHistory(query: HistoryRequest): Promise<Report[]>;
  healthCheck(): Promise<{ status: string; latencyMs: number }>;
}
```

### AnalyzeRequest
```typescript
interface AnalyzeRequest {
  instrument: 'XAU/USD' | 'EUR/USD' | 'GBP/USD';
  timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1wk';
  lookback?: number; // 1-500, default 200
  model?: 'gemini' | 'ollama' | 'auto'; // default 'auto'
  temperature?: number; // 0-1, default 0.7
  include_history?: boolean;
}
```

### HistoryRequest
```typescript
interface HistoryRequest {
  instrument: 'XAU/USD' | 'EUR/USD' | 'GBP/USD';
  timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1wk';
  limit?: number; // 1-100, default 10
}
```

## Testing

Run copilot tests:
```bash
npm test -- apps/api/src/copilot/routes.test.ts
```

Run all API tests:
```bash
npm test -- apps/api
```

Expected results: **73 tests passing** (50 existing + 23 new)

## Server Integration

The routes are conditionally registered in `buildServer()`:

```typescript
if (options.aiAnalysis) {
  await registerCopilotRoutes(app, { aiAnalysis: options.aiAnalysis });
}
```

## Health Monitoring

AI provider health is reported in `/health/providers`:

```json
{
  "providerId": "ai-copilot",
  "displayName": "AI Copilot Analysis",
  "category": "ai",
  "status": "ok",
  "latencyMs": 45,
  "message": "AI copilot service operational"
}
```

## Configuration

Environment variables for AI:
```bash
AI_PROVIDER=disabled               # or: gemini, ollama, openai-compatible
AI_TEMPERATURE=0.7                 # default temperature for requests
AI_MAX_TOKENS=4000                 # safety limit
AI_REQUEST_TIMEOUT_MS=15000        # timeout before fallback
```

## Error Handling

All validation errors return 400 with format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [
      { "path": "instrument", "message": "Invalid enum value" }
    ],
    "requestId": "uuid-here"
  }
}
```

## Fallback Mode

When AI service is unavailable, endpoint still returns 200:
```json
{
  "status": "ok",
  "data": {
    "report": "# Analysis Report (Facts Only)\n...",
    "model": null,
    "fallback": true,
    "fallback_reason": "Gemini API unavailable",
    "evidence": { ... }
  }
}
```

## Cache Headers

Both endpoints set:
```
Cache-Control: no-store
```

This ensures analysis reports are never cached.

## Request IDs

All responses include request ID in headers:
```
x-request-id: uuid-string
```

Error responses include it in the body:
```json
{
  "error": {
    "requestId": "uuid-string"
  }
}
```

## Next Steps

1. **Implement AIAnalysisService** in @atc/ai-copilot package
2. **Add MongoDB indexes** on copilot_reports collection
3. **Integrate with AI providers** (Gemini, Ollama)
4. **Build frontend UI** for analysis requests
5. **Add performance monitoring** for inference times

## Files to Review

- `COPILOT_API_ROUTES_SUMMARY.md` - Detailed implementation notes
- `PHASE6_STATUS.md` - Complete status and checklist
- `apps/api/src/copilot/routes.test.ts` - Test examples and patterns
