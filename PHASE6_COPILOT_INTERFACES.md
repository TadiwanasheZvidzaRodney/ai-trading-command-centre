# Phase 6 - AI Copilot Hook Interfaces & Contracts

## Overview

This document defines the complete interface contracts for the Copilot hooks and their expected API behaviors.

---

## Hook: `useCopilotAnalysis`

### Signature
```typescript
function useCopilotAnalysis(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
  lookback?: number
): CopilotAnalysisState
```

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `instrument` | `InstrumentSymbol \| null` | Yes | - | Trading instrument ('XAU/USD', 'EUR/USD', 'GBP/USD') or null to disable |
| `timeframe` | `Timeframe` | Yes | - | Chart timeframe ('1h', '4h', '1d', '1wk') |
| `lookback` | `number` | No | 200 | Number of historical candles to analyze |

### Return State

```typescript
interface CopilotAnalysisState {
  data: CopilotAnalysisResponse | null;    // Report data (null before generation)
  error: any | null;                       // Error object (null if no error)
  isGenerating: boolean;                   // True while API request in progress
  generate: () => Promise<void>;           // Function to trigger analysis
}
```

### Behavior

#### Initial State
```typescript
{
  data: null,
  error: null,
  isGenerating: false,
  generate: async () => { ... }
}
```

#### State Transitions

1. **User calls `generate()`**
   ```
   isGenerating: true
   error: null
   ```

2. **API request succeeds**
   ```
   isGenerating: false
   data: CopilotAnalysisResponse
   error: null
   ```

3. **API request fails**
   ```
   isGenerating: false
   data: null (or previous data if available)
   error: Error object
   ```

#### Side Effects

- Instrument change → State persists (no auto-refetch)
- Timeframe change → State persists (no auto-refetch)
- Lookback change → State persists (no auto-refetch)

#### Error Handling

```typescript
try {
  await api.post('/api/v1/copilot/analyze', {
    instrument,
    timeframe,
    lookback,
    model: 'auto',
    temperature: 0.7
  });
} catch (err) {
  setError(err); // Error object stored in state
}
```

### Usage Example

```typescript
const analysis = useCopilotAnalysis('EUR/USD', '4h', 200);

// Manual trigger
<button onClick={() => analysis.generate()}>
  Generate Analysis
</button>

// Conditional rendering
{analysis.isGenerating && <Spinner />}
{analysis.error && <ErrorBanner error={analysis.error} />}
{analysis.data && <AIAnalysisReport report={analysis.data} />}
```

### API Endpoint

**POST** `/api/v1/copilot/analyze`

**Request:**
```json
{
  "instrument": "EUR/USD",
  "timeframe": "4h",
  "lookback": 200,
  "model": "auto",
  "temperature": 0.7
}
```

**Response:** `CopilotAnalysisResponse`

**Error Response:**
```json
{
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "message": "AI model failed to generate analysis",
    "details": { ... }
  }
}
```

---

## Hook: `useCopilotHistory`

### Signature
```typescript
function useCopilotHistory(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
  limit?: number
): CopilotHistoryState
```

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `instrument` | `InstrumentSymbol \| null` | Yes | - | Trading instrument or null to disable |
| `timeframe` | `Timeframe` | Yes | - | Chart timeframe |
| `limit` | `number` | No | 10 | Maximum number of historical records to fetch |

### Return State

```typescript
interface CopilotHistoryState {
  data: CopilotHistoryResponse | null;    // History records
  error: any | null;                      // Error object
  isLoading: boolean;                     // True during fetch
  refetch: () => Promise<void>;           // Manually refetch
}
```

### Behavior

#### Initial State (Before Mount)
```typescript
{
  data: null,
  error: null,
  isLoading: true,
  refetch: async () => { ... }
}
```

#### Side Effects

- **On mount:** Immediately fetches history
- **On instrument change:** Refetch history for new instrument
- **On timeframe change:** Refetch history for new timeframe
- **On limit change:** Refetch with new limit

#### Auto-Refetch Triggers
```typescript
useEffect(() => {
  void fetch();
}, [instrument, timeframe, fetch]); // Triggers on these changes
```

### Error Handling

Similar to `useCopilotAnalysis` - errors stored in state, component renders error boundary.

### Usage Example

```typescript
const history = useCopilotHistory('EUR/USD', '4h', 5);

// Auto-loads on mount
// Displays history items
{history.data?.reports.map((report) => (
  <HistoryItem key={report.input_hash} report={report} />
))}

// Manual refetch
<button onClick={() => history.refetch()}>
  Refresh History
</button>
```

### API Endpoint

**POST** `/api/v1/copilot/history`

**Request:**
```json
{
  "instrument": "EUR/USD",
  "timeframe": "4h",
  "limit": 5
}
```

**Response:** `CopilotHistoryResponse`

---

## Interface: `CopilotAnalysisRequest`

### Definition
```typescript
interface CopilotAnalysisRequest {
  instrument: InstrumentSymbol;
  timeframe: Timeframe;
  lookback: number;
  model?: 'gemini' | 'ollama' | 'auto';
  temperature?: number;
  include_history?: boolean;
}
```

### Field Constraints

| Field | Type | Required | Min | Max | Default |
|-------|------|----------|-----|-----|---------|
| `instrument` | `InstrumentSymbol` | ✓ | - | - | - |
| `timeframe` | `Timeframe` | ✓ | - | - | - |
| `lookback` | `number` | ✓ | 20 | 1000 | - |
| `model` | `string` | ✗ | - | - | 'auto' |
| `temperature` | `number` | ✗ | 0.0 | 1.0 | 0.7 |
| `include_history` | `boolean` | ✗ | - | - | false |

---

## Interface: `CopilotAnalysisResponse`

### Complete Structure
```typescript
interface CopilotAnalysisResponse {
  // Report Content
  report: string;                           // Markdown formatted
  
  // Model Information
  model: string | null;                     // 'gemini', 'ollama', null if fallback
  model_version?: string;                   // e.g., '1.5-pro'
  temperature: number;                      // 0.0-1.0 used
  
  // Metadata
  generated_at: string;                     // ISO 8601 timestamp
  inference_time_ms: number;                // API latency
  input_hash: string;                       // SHA256 or similar
  
  // Fallback Information
  fallback?: boolean;                       // true if using fallback
  fallback_reason?: string;                 // Why fallback was used
  
  // Evidence Bundle
  evidence: {
    // Identifiers
    instrument: string;
    timeframe: string;
    lookback: number;
    
    // Data Freshness
    candle_count: number;                   // Actual candles analyzed
    latest_candle_time: string;             // ISO 8601
    
    // Technical Data
    indicators_used: string[];              // ['SMA20', 'RSI', ...]
    patterns_detected: Array<{
      type: string;                         // 'Hammer', 'EngulfingBullish', etc.
      confidence: number;                   // 0.0-1.0
      candle_index: number;                 // 0-based from latest
    }>;
    
    // Quote Data
    quote: {
      bid: number;
      ask: number;
      mid: number;
      spread: number;
      fetched_at: string;                   // ISO 8601
    };
    
    // Structure Analysis
    structure: {
      trend: 'uptrend' | 'downtrend' | 'range';
      trend_strength: number;               // 0.0-1.0
      resistance_levels: Array<{
        price: number;
        touches: number;                    // Number of times touched
        recent_bounce?: string;             // ISO 8601 of last bounce
      }>;
      support_levels: Array<{
        price: number;
        touches: number;
        recent_bounce?: string;
      }>;
    };
    
    // External Events
    macro_events: Array<{
      event: string;
      time: string;                         // ISO 8601
      impact: string;                       // 'High', 'Medium', 'Low'
      hours_until: number;
    }>;
    
    // Context
    recent_news_themes: string[];          // ['USD weakness', ...]
  };
}
```

### Evidence Substructure Details

#### patterns_detected
```typescript
{
  type: "Engulfing",        // Pattern name
  confidence: 0.92,         // 92% confidence
  candle_index: 0           // Most recent candle
}
```

#### structure.resistance_levels
```typescript
{
  price: 1.0850,
  touches: 3,               // Touched 3 times
  recent_bounce: "2026-10-30T14:30:00Z"
}
```

#### macro_events
```typescript
{
  event: "US Non-Farm Payrolls",
  time: "2026-11-01T13:30:00Z",
  impact: "High",
  hours_until: 73
}
```

---

## Interface: `CopilotHistoryResponse`

### Definition
```typescript
interface CopilotHistoryResponse {
  reports: Array<{
    input_hash: string;       // Unique identifier
    generated_at: string;     // ISO 8601 timestamp
    model: string | null;     // Model used or null
    summary?: string;         // Optional brief summary
  }>;
}
```

### Example Response
```json
{
  "reports": [
    {
      "input_hash": "abc123def456...",
      "generated_at": "2026-10-30T15:45:00Z",
      "model": "gemini",
      "summary": "Strong bullish structure with 3 resistance touches"
    },
    {
      "input_hash": "xyz789qwe123...",
      "generated_at": "2026-10-30T14:30:00Z",
      "model": null,
      "summary": "Fallback analysis: No AI available"
    }
  ]
}
```

### Ordering
- Newest first (descending by generated_at)
- Limited by `limit` parameter (default 10, max typically 100)

---

## Error Handling Contract

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable code
    message: string;        // Human-readable message
    details?: unknown;      // Optional error details
  }
}
```

### Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_INSTRUMENT` | 400 | Instrument not recognized |
| `INVALID_TIMEFRAME` | 400 | Timeframe not supported |
| `LOOKBACK_OUT_OF_RANGE` | 400 | Lookback too small or large |
| `AI_SERVICE_UNAVAILABLE` | 503 | AI model not available (triggers fallback) |
| `AI_RATE_LIMIT` | 429 | Too many requests to AI service |
| `INTERNAL_ERROR` | 500 | Server error |
| `AUTHENTICATION_REQUIRED` | 401 | User not authenticated |

### Hook Error Handling

```typescript
try {
  const response = await api.post('/api/v1/copilot/analyze', request);
  setData(response);
} catch (err) {
  // err is an ApiError with: status, code, message, details
  setError(err);
} finally {
  setIsGenerating(false);
}
```

---

## Fallback Behavior

### When Fallback Triggers
1. AI model service unavailable (HTTP 503)
2. AI model timeout
3. Rate limit exceeded
4. Model returns error

### Response with Fallback
```typescript
{
  report: "## Technical Analysis (Fallback Mode)\n...",
  model: null,
  fallback: true,
  fallback_reason: "AI model exceeded rate limit",
  generated_at: "...",
  inference_time_ms: 150,
  evidence: { ... }  // Still populated with technical data
}
```

### Fallback Report Content
- Uses raw technical indicators
- Structured format (not AI-generated prose)
- No reasoning or market context
- Clear "Fallback" label in response

---

## Rate Limiting & Throttling

### Client-Side Recommendations

```typescript
// Implement debounce to prevent rapid-fire requests
const debouncedGenerate = useCallback(
  debounce(async () => {
    await analysis.generate();
  }, 1000), // Wait 1s after last click
  [analysis]
);
```

### Server-Side Expectations

- Rate limit: ~10 requests per minute per user
- AI model specific limits may apply
- History fetch: No rate limit (lightweight)

---

## Performance Expectations

### Latency Targets

| Operation | Min | Target | Max |
|-----------|-----|--------|-----|
| Generate Analysis | 500ms | 2-5s | 30s (timeout) |
| Fetch History | 50ms | 100-200ms | 5s |
| Error Response | 50ms | 200ms | 5s |

### Data Size Expectations

| Item | Typical Size |
|------|--------------|
| Report markdown | 2-5 KB |
| Evidence bundle | 1-2 KB |
| History response (10 items) | 1-2 KB |

### Network Optimization

- Compression: gzip enabled
- Caching: History can be cached for 5 minutes
- Pagination: History supports limit parameter

---

## Type Safety

### TypeScript Checks

All interfaces are strict mode compliant:
```typescript
// ✅ Safe
const response: CopilotAnalysisResponse = data;

// ❌ Type error - instrument must be valid
const request: CopilotAnalysisRequest = {
  instrument: 'INVALID',  // Type error
  timeframe: '4h',
  lookback: 200
};
```

### Valid Enumerations

```typescript
type InstrumentSymbol = 'XAU/USD' | 'EUR/USD' | 'GBP/USD';
type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1wk';
type Trend = 'uptrend' | 'downtrend' | 'range';
type Impact = 'High' | 'Medium' | 'Low';
```

---

## Deprecation Policy

### No Deprecations Yet

This is Phase 6 initial release. Breaking changes will follow semantic versioning.

### Planned for Future Phases

- v1.1: Add `include_raw_indicators` option
- v1.2: Add model selection UI
- v2.0: Support for custom temperature ranges

---

**Document Version:** 1.0  
**Last Updated:** October 30, 2026  
**Compatibility:** Phase 6 Frontend + Backend API
