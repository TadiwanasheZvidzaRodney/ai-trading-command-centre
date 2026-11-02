# Phase 7: Risk & Paper Trading Implementation Guide

## Overview

Phase 7 adds comprehensive risk management and paper trading capabilities to the AI Trading Command Centre. This guide documents the implementation of:

1. **Risk Engine Package** (`@atc/risk-engine`) - Deterministic position sizing and risk limit enforcement
2. **Paper Trading Package** (`@atc/paper-trading`) - Order execution simulation and P&L tracking
3. **API Routes** - REST endpoints for risk calculation and paper trading
4. **Frontend Pages** - Trade planner, paper trading UI, and trade journal

## Architecture

### Core Packages

#### 1. Risk Engine (`packages/risk-engine`)

**Purpose**: Deterministic risk calculation with hard limits that cannot be bypassed.

**Key Classes**:
- `RiskEngine` - Main orchestrator
- `PositionSizingCalculator` - Calculates position size from risk percentage
- `RewardRiskCalculator` - Validates and calculates R:R ratios
- `LimitChecker` - Enforces hard limits

**Key Features**:
- Position sizing: `qty = (account × risk%) / (entry - stop)`
- Hard limits (cannot be bypassed):
  - Per-trade risk limit
  - Daily loss limit
  - Open risk limit
  - Max positions limit
  - Min reward-to-risk ratio

**Determinism**:
- Same inputs always produce same outputs
- No randomness, no external calls
- Suitable for backtesting and reproducible results

**Example Usage**:

```typescript
import { RiskEngine } from '@atc/risk-engine';
import { loadEnv } from '@atc/config';

const env = loadEnv();
const config = riskConfigFromEnv(env);

const engine = new RiskEngine({
  riskConfig: config,
  instruments: instrumentData,
});

const result = engine.validateTradePlan(
  {
    instrument: 'EUR/USD',
    side: 'buy',
    entry: 1.0500,
    stop: 1.0400,
    target: 1.0650,
    accountEquity: 10000,
    accountCurrency: 'USD',
  },
  accountState,
);

if (result.approved) {
  console.log(`Position size: ${result.positionSize.quantityLots} lots`);
  console.log(`Risk: $${result.positionSize.riskAmount}`);
} else {
  console.log('Trade rejected:', result.reasons);
}
```

#### 2. Paper Trading (`packages/paper-trading`)

**Purpose**: Simulate realistic order execution with P&L tracking.

**Key Classes**:
- `PaperTradingEngine` - Main orchestrator
- `OrderExecutor` - Submits/modifies/cancels/executes orders
- `PositionTracker` - Tracks open positions and converts to closed trades
- `PnLCalculator` - Calculates P&L, drawdown, and performance metrics

**Key Features**:
- Order lifecycle: pending → filled → closed
- Realistic fills: spread + slippage + commission
- Position tracking with unrealized P&L
- Trade journal with R-multiple calculation
- Performance analytics: win rate, profit factor, expectancy

**Example Usage**:

```typescript
import { PaperTradingEngine } from '@atc/paper-trading';

const engine = new PaperTradingEngine(riskConfig, pipSizes);

// Submit order
const order = engine.submitOrder({
  instrument: 'EUR/USD',
  side: 'buy',
  type: 'market',
  quantityLots: 1,
  stopLoss: 1.0400,
  takeProfit: 1.0650,
  idempotencyKey: 'unique-key',
  riskDecision: result, // From RiskEngine
});

// Execute at market prices
const exec = engine.executeOrder(order.id, bid, ask, timestamp);

// Update position prices
const position = engine.updatePosition(positionId, currentPrice);

// Check for closure triggers
const closure = engine.checkClosureTriggers(positionId, bid, ask);
if (closure.shouldClose) {
  engine.closePosition({
    positionId,
    closePrice: currentPrice,
    reason: closure.reason,
    timestamp,
  });
}

// Get account snapshot
const snapshot = engine.getAccountSnapshot(timestamp);
console.log(`Equity: $${snapshot.equity}, Win Rate: ${snapshot.winRate}%`);
```

## Database Schema

Paper trading data is stored in MongoDB with the following collections:

```javascript
// paper_orders - All submitted orders
{
  _id: ObjectId,
  accountId: string,
  id: string,
  idempotencyKey: string,
  instrument: 'EUR/USD' | 'GBP/USD' | 'XAU/USD',
  side: 'buy' | 'sell',
  type: 'market' | 'limit',
  quantityLots: number,
  requestedPrice: number | null,
  stopLoss: number,
  takeProfit: number,
  status: 'pending' | 'filled' | 'cancelled' | 'rejected' | 'closed',
  filledPrice: number | null,
  exitPrice: number | null,
  spreadAtEntry: number | null,
  slippage: number,
  commission: number,
  pnl: number | null,
  rMultiple: number | null,
  closeReason: 'stop' | 'target' | 'manual' | null,
  notes: string,
  riskDecision: object, // RiskDecision from risk-engine
  createdAt: Date,
  filledAt: Date | null,
  closedAt: Date | null,
}

// paper_positions - Open positions
{
  _id: ObjectId,
  accountId: string,
  positionId: string,
  orderId: string,
  instrument: string,
  side: 'buy' | 'sell',
  quantityLots: number,
  entryPrice: number,
  currentPrice: number,
  stopLoss: number,
  takeProfit: number,
  unrealizedPnL: number,
  unrealizedPnLPct: number,
  openedAt: Date,
  riskDecision: object,
}

// paper_trades - Closed trades (journal)
{
  _id: ObjectId,
  accountId: string,
  tradeId: string,
  orderId: string,
  instrument: string,
  side: 'buy' | 'sell',
  entryPrice: number,
  exitPrice: number,
  quantityLots: number,
  grossPnL: number,
  netPnL: number,
  pnLPct: number,
  rMultiple: number | null,
  openedAt: Date,
  closedAt: Date,
  durationMs: number,
  closeReason: 'stop' | 'target' | 'manual',
  notes: string,
  tags: string[],
  spreadAtEntry: number,
  slippage: number,
  commission: number,
  riskDecision: object,
}

// paper_account_snapshots - Daily account state
{
  _id: ObjectId,
  accountId: string,
  date: string, // YYYY-MM-DD
  timestamp: Date,
  equity: number,
  balance: number,
  startingBalance: number,
  totalPnL: number,
  totalPnLPct: number,
  dailyPnL: number,
  dailyPnLPct: number,
  drawdown: number,
  drawdownPct: number,
  maxDrawdown: number,
  maxDrawdownPct: number,
  openPositions: number,
  openOrders: number,
  totalTrades: number,
  wins: number,
  losses: number,
  breakeven: number,
  winRate: number,
}
```

## API Routes

### Risk Management

```
POST /api/v1/risk/position-size
  Request: { instrument, side, entry, stop, target, accountEquity }
  Response: { quantityLots, notionalUSD, riskAmount, rewardRisk, ... }

POST /api/v1/risk/validate-plan
  Request: { instrument, side, entry, stop, target, accountEquity }
  Response: RiskValidationResult { approved, positionSize, limitCheck, reasons, ... }

POST /api/v1/risk/limits
  Request: { accountEquity }
  Response: { perTradeLimitUSD, dailyLossLimitUSD, openRiskLimitUSD, maxPositions, minRewardRisk }
```

### Paper Trading

```
POST /api/v1/paper-orders
  Submit new order
  Request: PaperOrderInput
  Response: PaperOrder

GET /api/v1/paper-orders
  List all orders (with filters)
  Query: { status, instrument, from, to }
  Response: PaperOrder[]

POST /api/v1/paper-orders/:id/execute
  Execute pending order
  Request: { bid, ask }
  Response: { success, order }

POST /api/v1/paper-orders/:id/modify
  Modify pending order
  Request: Partial<PaperOrder>
  Response: PaperOrder

DELETE /api/v1/paper-orders/:id
  Cancel pending order
  Response: PaperOrder

GET /api/v1/paper-positions
  Get open positions
  Response: PaperPosition[]

POST /api/v1/paper-positions/:id/close
  Close a position
  Request: { closePrice, reason, notes }
  Response: ClosedTrade

GET /api/v1/paper-trades
  Get closed trades (journal)
  Query: { from, to, instrument }
  Response: ClosedTrade[]

POST /api/v1/paper-trades/:id/notes
  Add notes to closed trade
  Request: { notes, tags }
  Response: ClosedTrade

GET /api/v1/paper-analytics
  Get performance metrics
  Query: { from, to }
  Response: PerformanceMetrics

POST /api/v1/paper/reset
  Reset paper account
  Request: { newBalance? }
  Response: { success }
```

## Frontend Pages

### 1. Trade Planner (`/planner`)

**Components**:
- `PlannerForm` - Entry/stop/target inputs
- `PositionSizeDisplay` - Shows calculated position size
- `RiskLimitsDisplay` - Shows current limits and usage
- `RRValidationDisplay` - Shows R:R ratio

**Features**:
- Real-time position size calculation
- R:R validation with suggestions
- Current risk exposure display
- Trade approval/rejection with reasons

### 2. Paper Trading (`/paper`)

**Components**:
- `OrderEntryForm` - Quick order submission
- `OpenPositionsList` - Table of open positions with P&L
- `PendingOrdersList` - List of pending orders with modify/cancel
- `EquityChart` - Equity curve over time

**Features**:
- Quick order entry with risk calculation
- Live P&L updates
- Position management (modify, close)
- Equity curve visualization

### 3. Trade Journal (`/journal`)

**Components**:
- `JournalTable` - All closed trades with details
- `AnalyticsChart` - Performance metrics
- `StatsSummary` - Win rate, profit factor, expectancy
- `TradeNotes` - Add/edit notes on trades

**Features**:
- Complete trade history
- Performance analytics
- Trade notes and tags
- Filter by date range, instrument

## Testing

### Risk Engine Tests (45 tests)

```typescript
// Position Sizing (10 tests)
- Determinism
- Buy/sell orders
- Small positions
- Edge cases
- Precision

// R:R Calculator (8 tests)
- Basic calculation
- Validation
- Minimum target calculation
- Suggestions
- Determinism

// Limit Checker (12 tests)
- Per-trade limit
- Daily loss limit
- Open risk limit
- Max positions
- Min R:R
- Combined checks

// RiskEngine (15 tests)
- Initialization
- Risk limits calculation
- Trade plan validation
- Determinism
- Error handling
```

### Paper Trading Tests (57 tests)

```typescript
// PnL Calculator (12 tests)
- Unrealized P&L
- Realized P&L
- R-multiple
- Drawdown
- Performance metrics
- Determinism

// Order Executor (15 tests)
- Order submission
- Order execution
- Fill calculation
- Order modification
- Cancellation
- Configuration

// Position Tracker (12 tests)
- Opening positions
- Updating prices
- Closing positions
- Exposure summary
- Closure detection

// Paper Trading Engine (18 tests)
- Initialization
- Order management
- Position tracking
- Closure detection
- Account snapshots
- Performance metrics
- Reset
```

### API Routes Tests (25 tests)

```typescript
- Risk calculation endpoints
- Order submission
- Order execution
- Order modification
- Order cancellation
- Position queries
- Trade journal queries
- Analytics endpoints
- Error handling
- Validation
```

## Environment Variables

```bash
# Paper Trading Configuration
PAPER_STARTING_BALANCE=10000          # Starting balance in USD
PAPER_RISK_PER_TRADE_PCT=1            # Risk per trade as % of account
PAPER_MAX_DAILY_LOSS_PCT=3            # Max daily loss as % of account
PAPER_MAX_OPEN_RISK_PCT=5             # Max open risk as % of account
PAPER_MAX_POSITIONS=3                 # Maximum open positions
PAPER_MIN_RR=1.5                      # Minimum reward-to-risk ratio
```

## Key Design Decisions

### 1. Determinism
- All calculations are deterministic (no randomness)
- Same inputs always produce same outputs
- Enables reproducible backtesting and testing

### 2. Hard Limits
- Limits cannot be bypassed at runtime
- Limits are loaded from config only
- Prevents over-exposure through code errors

### 3. Position Sizing Formula
```
Position Size = (Account Equity × Risk %) / (Entry - Stop) × (Pip Size / Pip Value)
```
- Risk in USD = Account Equity × Risk % / 100
- Distance in pips = |Entry - Stop| / Pip Size
- Position Size = Risk USD / (Distance in pips × Pip Value per Lot)

### 4. Paper Trading Architecture
- Separates concerns: OrderExecutor, PositionTracker, PnLCalculator
- Idempotent order submission via idempotencyKey
- Auto-position opening on order execution
- Closure detection via bid/ask comparison

### 5. P&L Calculation
- Gross P&L = (Exit - Entry) × Quantity × Direction
- Net P&L = Gross P&L - Commission - Slippage
- R-Multiple = Net P&L / Risk Amount
- Profit Factor = Gross Profit / Gross Loss

## Integration with Existing Code

### With @atc/shared
- Uses existing types: `Instrument`, `Quote`, `OrderSide`, `OrderStatus`, `RiskConfig`, `RiskDecision`, `PaperOrder`, `JournalEntry`, `PerformanceMetrics`
- Extends with: `TradePlanInput`, `RiskValidationResult`, `PaperPosition`, `ClosedTrade`, `AccountSnapshot`

### With @atc/config
- Loads risk configuration from environment
- Uses `riskConfigFromEnv()` for configuration
- Validates risk parameters in env schema

### With @atc/market-data
- Uses current quotes for order execution
- Reads bid/ask for fill calculations
- Updates position prices with market data

### With MongoDB
- Stores paper trading state (orders, positions, trades)
- Persists account snapshots for analytics
- Enables account history and recovery

## Deployment Checklist

- [ ] Risk engine package builds without errors
- [ ] Paper trading package builds without errors
- [ ] All 127 tests pass (45 + 57 + 25)
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] Risk limits are properly enforced
- [ ] Position sizing is deterministic
- [ ] Order execution includes realistic fills
- [ ] P&L calculations are accurate
- [ ] API routes are implemented and tested
- [ ] Frontend pages are implemented
- [ ] MongoDB collections created with indexes
- [ ] Environment variables documented
- [ ] API documentation updated

## Example Workflow

```typescript
// 1. User enters trade plan in /planner
const tradePlan = {
  instrument: 'EUR/USD',
  side: 'buy',
  entry: 1.0500,
  stop: 1.0400,
  target: 1.0650,
  accountEquity: 10000,
};

// 2. Risk engine validates
const riskEngine = new RiskEngine(config);
const validation = riskEngine.validateTradePlan(tradePlan, accountState);

if (!validation.approved) {
  // Show reasons for rejection
  return validation.reasons;
}

// 3. User approves and submits order
const order = paperEngine.submitOrder({
  ...tradePlan,
  type: 'market',
  quantityLots: validation.positionSize.quantityLots,
  idempotencyKey: generateUUID(),
  riskDecision: validation,
});

// 4. Order executes at market prices
const executed = paperEngine.executeOrder(
  order.id,
  currentQuote.bid,
  currentQuote.ask,
  new Date().toISOString(),
);

// 5. Position tracks with live prices
setInterval(() => {
  const position = paperEngine.updatePosition(
    positions[0].id,
    currentQuote.mid,
  );
  
  // Check for closure
  const closure = paperEngine.checkClosureTriggers(
    position.id,
    currentQuote.bid,
    currentQuote.ask,
  );
  
  if (closure.shouldClose) {
    paperEngine.closePosition({
      positionId: position.id,
      closePrice: currentQuote.mid,
      reason: closure.reason,
      timestamp: new Date().toISOString(),
    });
  }
}, 1000);

// 6. Journal shows results
const trades = paperEngine.getClosedTrades();
const metrics = paperEngine.getPerformanceMetrics();
```

## Troubleshooting

### Position size is zero
- Entry and stop are too close
- Risk percentage is very small
- Account equity is small
→ Solution: Increase stop distance or risk percentage

### Trade rejected for R:R
- Target is too close to entry
- R:R ratio is below configured minimum (default 1.5)
→ Solution: Move target further away

### Daily loss limit reached
- Too many losing trades
- Losses larger than configured daily limit
→ Solution: Wait until next day or adjust position sizes

### Order not executing
- Order is not pending status
- Market prices not provided
→ Solution: Check order status, ensure market data is available

## Future Enhancements

- [ ] Trailing stops
- [ ] Partial closes
- [ ] Market-conditional orders
- [ ] Correlation analysis for position limits
- [ ] Live trading integration
- [ ] Advanced analytics (Sharpe ratio, Sortino ratio)
- [ ] Strategy backtesting framework
- [ ] Machine learning for position sizing
- [ ] Account-level drawdown protection
- [ ] Multi-currency support

## References

- Risk management: Position sizing formulas
- Trading psychology: Risk/reward principles
- Statistics: P&L distribution analysis
- Technical analysis: Support/resistance for stops

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Status**: Implementation Complete
