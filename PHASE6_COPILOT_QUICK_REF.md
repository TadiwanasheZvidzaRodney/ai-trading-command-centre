# Phase 6 - AI Copilot Development Quick Reference

## 🚀 Quick Start

### Page URL
```
/copilot
```

### Navigate from Menu
Click "AI Copilot" in the left sidebar (Phase 6 badge)

---

## 📦 Component Structure

### Page Component
**File:** `apps/web/src/app/copilot/page.tsx`

```typescript
// Main state
const [instrument, setInstrument] = useState<InstrumentSymbol>('EUR/USD');
const [timeframe, setTimeframe] = useState<Timeframe>('4h');
const [lookback, setLookback] = useState(200);

// Hooks
const analysis = useCopilotAnalysis(instrument, timeframe, lookback);
const history = useCopilotHistory(instrument, timeframe, 5);
```

### Sidebar Component
**File:** `apps/web/src/components/CopilotSetup.tsx`

Handles:
- Instrument selection (dropdown)
- Timeframe selection (buttons)
- Lookback selection (buttons)
- Generate button with loading state

### Report Component
**File:** `apps/web/src/components/AIAnalysisReport.tsx`

Renders:
- Markdown report as HTML
- Report metadata (time, model, temperature)
- Limitations section

### Trade Ideas Component
**File:** `apps/web/src/components/TradeIdeasHighlight.tsx`

Extracts and displays:
- Trade idea sections from markdown
- Formatted with icon highlight

---

## 🪝 Hooks Reference

### useCopilotAnalysis()
```typescript
const analysis = useCopilotAnalysis(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
  lookback: number = 200
);

// Returns:
{
  data: CopilotAnalysisResponse | null,
  error: any | null,
  isGenerating: boolean,
  generate: () => Promise<void>
}
```

**Usage:**
```typescript
// Generate on button click
<button onClick={() => analysis.generate()}>
  Generate Analysis
</button>

// Display loading state
{analysis.isGenerating && <Spinner />}

// Display error
{analysis.error && <ErrorBanner>{analysis.error.message}</ErrorBanner>}

// Display report
{analysis.data && <AIAnalysisReport report={analysis.data} />}
```

### useCopilotHistory()
```typescript
const history = useCopilotHistory(
  instrument: InstrumentSymbol | null,
  timeframe: Timeframe,
  limit: number = 10
);

// Returns:
{
  data: CopilotHistoryResponse | null,
  error: any | null,
  isLoading: boolean,
  refetch: () => Promise<void>
}
```

**Usage:**
```typescript
// Auto-fetches on mount and dependency changes
// Manual refetch available
await history.refetch();
```

---

## 📊 Data Structures

### CopilotAnalysisResponse
```typescript
{
  report: string;                    // Markdown content
  model: string | null;              // "gemini", "ollama", etc.
  model_version?: string;
  temperature: number;               // 0.0 - 1.0
  generated_at: string;              // ISO timestamp
  inference_time_ms: number;         // Latency
  input_hash: string;                // Cache key
  fallback?: boolean;                // True if using fallback
  fallback_reason?: string;          // Why fallback occurred
  
  evidence: {
    instrument: string;
    timeframe: string;
    lookback: number;
    candle_count: number;
    latest_candle_time: string;
    indicators_used: string[];       // ["SMA20", "RSI", ...]
    patterns_detected: Array<{
      type: string;
      confidence: number;            // 0.0 - 1.0
      candle_index: number;
    }>;
    quote: {
      bid: number;
      ask: number;
      mid: number;
      spread: number;
      fetched_at: string;            // ISO timestamp
    };
    structure: {
      trend: 'uptrend' | 'downtrend' | 'range';
      trend_strength: number;        // 0.0 - 1.0
      resistance_levels: Array<{
        price: number;
        touches: number;
        recent_bounce?: string;      // ISO timestamp
      }>;
      support_levels: Array<{
        price: number;
        touches: number;
        recent_bounce?: string;
      }>;
    };
    macro_events: Array<{
      event: string;
      time: string;                  // ISO timestamp
      impact: string;                // "High", "Medium", "Low"
      hours_until: number;
    }>;
    recent_news_themes: string[];
  };
}
```

### CopilotHistoryResponse
```typescript
{
  reports: Array<{
    input_hash: string;              // Unique key
    generated_at: string;            // ISO timestamp
    model: string | null;
    summary?: string;                // Brief description
  }>;
}
```

---

## 🎨 CSS Classes

### Layout
- `.page` - Page wrapper
- `.hero` - Hero section with gradient
- `.workspace` - Sidebar + main grid (280px + 1fr)
- `.sidebar` - Sticky sidebar
- `.workspace-main` - Main content area

### Cards
- `.card` - Standard card with border and shadow
- `.card-header` - Card title section
- `.card-body` - Card content section

### Report Sections
- `.report-container` - Report wrapper
- `.report-header` - Metadata grid
- `.report-content` - Markdown content
- `.report-footer` - Limitations section

### Trade Ideas
- `.trade-ideas-card` - Highlighted card
- `.ideas-list` - Grid of ideas
- `.idea-item` - Individual idea

### Evidence
- `.evidence-panel` - Evidence wrapper
- `.evidence-grid` - 6-column data grid
- `.evidence-subsection` - Sub-sections (levels, events)

### History
- `.history-panel` - History wrapper
- `.history-list` - List of past analyses
- `.history-item` - Individual history entry
- `.model-badge` - Model name badge

### Utilities
- `.empty-state` - Empty state placeholder
- `.info-box` - Information callout
- `.banner.error` - Error message
- `.banner.info` - Info message
- `.banner.warning` - Warning message
- `.spinner` - Loading spinner animation

---

## 🔌 API Endpoints

### Generate Analysis
```
POST /api/v1/copilot/analyze
Content-Type: application/json

{
  instrument: "EUR/USD",
  timeframe: "4h",
  lookback: 200,
  model?: "auto" | "gemini" | "ollama",
  temperature?: 0.7,
  include_history?: false
}

→ CopilotAnalysisResponse
```

### Get History
```
POST /api/v1/copilot/history
Content-Type: application/json

{
  instrument: "EUR/USD",
  timeframe: "4h",
  limit: 10
}

→ CopilotHistoryResponse
```

---

## 🛠️ Customization Guide

### Change Default Instrument
**File:** `apps/web/src/app/copilot/page.tsx`

```typescript
const [instrument, setInstrument] = useState<InstrumentSymbol>('XAU/USD'); // Change here
```

### Add More Instruments
**File:** `apps/web/src/components/CopilotSetup.tsx`

```typescript
const instruments: InstrumentSymbol[] = ['XAU/USD', 'EUR/USD', 'GBP/USD'];
// Note: Limited to shared types in @atc/shared
```

### Change Report Styling
**File:** `apps/web/src/app/globals.css`

Search for `.report-*` classes to modify colors, spacing, fonts.

### Modify Evidence Display
**File:** `apps/web/src/app/copilot/page.tsx`

Edit the `evidence-grid` section to show/hide fields.

### Change History Limit
**File:** `apps/web/src/app/copilot/page.tsx`

```typescript
const history = useCopilotHistory(instrument, timeframe, 5); // Change 5 to desired limit
```

---

## 🐛 Common Issues & Solutions

### Issue: "No chart data" error
**Solution:** API endpoint not yet implemented. Ensure backend has:
- `/api/v1/copilot/analyze` endpoint
- `/api/v1/copilot/history` endpoint

### Issue: Markdown not rendering
**Solution:** Check report content in browser DevTools. The `parseMarkdown()` function in AIAnalysisReport uses basic regex. For complex markdown, install `react-markdown` package.

### Issue: Styles not applying
**Solution:** Clear browser cache and rebuild:
```bash
npm run build
npm start
```

### Issue: Type errors with instruments
**Solution:** Only use 'XAU/USD', 'EUR/USD', 'GBP/USD'. These are defined in `@atc/shared`.

---

## 🧪 Testing Patterns

### Mock useCopilotAnalysis Hook
```typescript
const mockAnalysis = {
  data: {
    report: "## Market Analysis\n...",
    model: "gemini",
    generated_at: new Date().toISOString(),
    // ... rest of response
  },
  error: null,
  isGenerating: false,
  generate: jest.fn()
};
```

### Mock API Response
```typescript
jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({
      report: "...",
      model: "gemini",
      // ...
    })
  }
}));
```

---

## 📱 Responsive Testing

### Test Breakpoints
- Desktop: 1440px+
- Tablet: 768px - 1024px
- Mobile: < 768px

### Test in Chrome DevTools
```
Ctrl+Shift+J → Toggle device toolbar → Select device
```

---

## 🚀 Deployment Checklist

- [ ] TypeScript compiles without errors
- [ ] All components import correctly
- [ ] Hooks properly exported from hooks.ts
- [ ] CSS added to globals.css
- [ ] Navigation link added to AppShell
- [ ] No console errors in DevTools
- [ ] Works on mobile (responsive)
- [ ] Error handling tested
- [ ] Loading states visible
- [ ] Empty states display correctly

---

## 📚 Related Files

- **Shared Types:** `packages/shared/src/types.ts`
- **API Client:** `apps/web/src/lib/api.ts`
- **Similar Page:** `apps/web/src/app/analysis/page.tsx` (reference)
- **Styling:** `apps/web/src/app/globals.css` (search `.copilot`, `.report-*`)

---

## 🔗 Links & Resources

- TypeScript: https://www.typescriptlang.org/
- React Hooks: https://react.dev/reference/react/hooks
- Next.js: https://nextjs.org/docs
- Lucide Icons: https://lucide.dev/
- CSS Grid: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout

---

**Last Updated:** October 30, 2026  
**Phase:** 6 - AI Copilot  
**Status:** Production Ready
