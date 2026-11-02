# Phase 7 Frontend - Quick Reference

## File Structure

```
apps/web/src/
├── app/
│   ├── planner/page.tsx           # Trade planning page
│   ├── paper/page.tsx             # Paper trading dashboard
│   └── journal/page.tsx           # Trade journal
├── components/
│   ├── PlannerSetup.tsx           # Planner: Input form
│   ├── PlannerCalculation.tsx     # Planner: Calculations display
│   ├── RiskSummary.tsx            # Planner: Risk validation
│   ├── PositionSizeCalculator.tsx # Planner: Position details
│   ├── OrderEntryForm.tsx         # Paper: Quick order creation
│   ├── OpenPositionsList.tsx      # Paper: Active positions
│   ├── OpenOrdersList.tsx         # Paper: Pending orders
│   ├── PaperAccountHeader.tsx     # Paper: Account summary
│   ├── EquityCurveChart.tsx       # Paper: Equity trend
│   ├── AnalyticsMetrics.tsx       # Journal: Performance cards
│   ├── PerformanceCharts.tsx      # Journal: Analysis charts
│   ├── JournalTradesTable.tsx     # Journal: Trade history
│   └── TradeNotesModal.tsx        # Journal: Trade notes editor
└── lib/
    └── hooks.ts                    # SWR hooks for API calls
```

## Key Interfaces

### Trade Parameters
```typescript
interface TradeParams {
  instrument: InstrumentSymbol;
  side: 'buy' | 'sell';
  entryPrice: number | '';
  stopPrice: number | '';
  targetPrice: number | '';
  riskPct: number;
}
```

### API Response Types
```typescript
interface PaperAccountResponse {
  startingBalance: number;
  currentBalance: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  accountPnLPct: number;
}

interface PaperOrder {
  id: string;
  instrument: InstrumentSymbol;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  status: 'pending' | 'filled' | 'cancelled';
  createdAt: string;
}

interface PaperPosition {
  id: string;
  instrument: InstrumentSymbol;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

interface PaperTrade {
  id: string;
  instrument: InstrumentSymbol;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnL: number;
  realizedPnLPct: number;
  rMultiple: number;
  duration: string;
}

interface PaperAnalyticsResponse {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxDD: number;
  totalRealizedPnL: number;
  accountBalance: number;
}
```

## Hook Usage Examples

### Get Account Data
```typescript
const account = usePaperAccount();
// account.data, account.error, account.isLoading, account.mutate()
```

### Get Positions with Auto-Refresh
```typescript
const positions = usePaperPositions();
// Refreshes every 10 seconds
```

### Get Paginated Trades
```typescript
const trades = usePaperTrades(page, { instrument: 'XAU/USD' });
// Filter by instrument, paginate with page number
```

### Create an Order
```typescript
const response = await api.post('/api/v1/paper-orders', {
  instrument: 'XAU/USD',
  side: 'buy',
  entryPrice: 2000,
  stopPrice: 1950,
  targetPrice: 2050,
  quantity: 1.5,
  notes: 'Manual order'
});
// Returns { orderId: string, status: string, ... }
```

## Component Props

### PlannerSetup
```typescript
<PlannerSetup
  isLoading={boolean}
  onParamsChange={(params: TradeParams) => void}
  onSubmit={(params: TradeParams) => Promise<void>}
/>
```

### PlannerCalculation
```typescript
<PlannerCalculation
  calculations={{
    quantity: number;
    contracts: number;
    cost: number;
    maxLoss: number;
    leverage: number;
    potentialReward: number;
    rrRatio: number;
  } | null}
  isLoading={boolean}
  error={string | null}
  instrument={InstrumentSymbol}
/>
```

### OpenPositionsList
```typescript
<OpenPositionsList
  positions={PaperPosition[] | null}
  isLoading={boolean}
  onClose={() => Promise<void>}
  error={Error | null}
/>
```

### JournalTradesTable
```typescript
<JournalTradesTable
  trades={PaperTrade[] | null}
  isLoading={boolean}
  total={number}
  currentPage={number}
  onPageChange={(page: number) => void}
  onNotesUpdated={() => Promise<void>}
  error={Error | null}
/>
```

## Styling Classes

### Layout
- `.page` - Main page container
- `.workspace` - Sidebar + main area layout
- `.card` - Content card
- `.grid`, `.grid-2`, `.grid-3`, `.grid-4` - Grid layouts
- `.stack` - Vertical flex stack
- `.row`, `.row-between` - Horizontal flex row

### Input
- `.input`, `.select`, `.textarea` - Form inputs
- `.label` - Form label
- `.slider` - Range slider (NEW)
- `.segmented` - Button group (NEW)

### Display
- `.stat` - Statistic card
- `.stat-label`, `.stat-value`, `.stat-hint` - Stat styling
- `.badge` - Badge with colors: `.badge.ok`, `.badge.warn`, `.badge.error`, `.badge.info`
- `.positive`, `.negative`, `.warning-text` - Text colors

### Table
- `.table-wrap` - Scrollable table container
- `.table-note` - Table note text

### Buttons
- `.btn` - Default button
- `.btn-primary` - Primary action
- `.btn-danger` - Danger action
- `.btn-ghost` - Ghost button
- `.btn-sm` - Small button
- `.btn:disabled` - Disabled state

### Utilities
- `.mono` - Monospace font
- `.muted` - Muted text color
- `.dim` - Dimmed text color
- `.empty-state` - Empty state container
- `.spinner` - Loading spinner
- `.divider` - Horizontal divider (NEW)

## Common Patterns

### Form with Validation
```typescript
const [form, setForm] = useState({ /* ... */ });
const [error, setError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!form.field) {
    setError('Field required');
    return;
  }
  try {
    const response = await api.post('/endpoint', form);
    // Handle success
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Error');
  }
};
```

### Real-Time Calculations
```typescript
const handleChange = useCallback((newParams: TradeParams) => {
  setParams(newParams);
  // Validate
  if (!isValid(newParams)) return;
  // Calculate
  const result = calculate(newParams);
  setCalculations(result);
}, []);
```

### Confirmed Actions
```typescript
const [confirmId, setConfirmId] = useState<string | null>(null);

{confirmId === id ? (
  <div>
    <button onClick={() => handleAction(id)}>Confirm</button>
    <button onClick={() => setConfirmId(null)}>Cancel</button>
  </div>
) : (
  <button onClick={() => setConfirmId(id)}>Delete</button>
)}
```

### Data Refresh
```typescript
const data = useData();

const handleRefresh = useCallback(async () => {
  await data.mutate();
}, [data]);
```

## Development Tips

1. **Adding a new component**
   - Create in `components/` directory
   - Export function component with TypeScript interface for props
   - Use existing CSS classes from `globals.css`
   - Add JSDoc comments

2. **Calling an API**
   - Use `api.get()`, `api.post()`, `api.patch()`, `api.delete()`
   - Always provide type parameter: `api.post<ResponseType>(...)`
   - Handle errors with try-catch

3. **Fetching data**
   - Create hook in `lib/hooks.ts` using `useApi()`
   - Set appropriate `refreshInterval`
   - Return object with `.data`, `.error`, `.isLoading`, `.mutate()`

4. **Testing UI changes**
   - Use `npm run dev:web` to start dev server
   - Check both desktop and mobile sizes
   - Verify loading and error states
   - Test with accessibility inspector

5. **Debugging**
   - Use React DevTools browser extension
   - Check Network tab for API calls
   - Use `console.log()` in components
   - Check ESLint output: `npm run lint`

## CSS Color Variables

```css
--bg: #080b10                    /* Background */
--panel: #111823                 /* Card background */
--border: #1e2937                /* Border color */
--text: #e6edf5                  /* Text color */
--text-muted: #8b9aab            /* Muted text */
--text-dim: #637184              /* Dim text */
--accent: #2dd4bf                /* Primary accent */
--positive: #34d399              /* Success/positive */
--negative: #f87171              /* Error/negative */
--warning: #fbbf24               /* Warning */
--info: #60a5fa                  /* Info */
```

## Performance Considerations

1. **API Refresh Intervals**
   - Account/Positions: 10s (frequent updates)
   - Analytics: 30s (periodic analysis)
   - Risk Limits: 5m (rarely changes)
   - Instruments: 5m (static data)

2. **Component Updates**
   - Use `useCallback` for event handlers
   - Memoize expensive calculations
   - Avoid unnecessary state updates

3. **Table Performance**
   - Limit initial rows: 20 per page
   - Implement pagination
   - Use virtual scrolling for large lists (future)

---

**Last Updated**: November 1, 2026
**Phase**: 7
**Status**: Complete
