# Phase 7: Quick Reference & Code Examples

## Quick Start

### Installing Phase 7 Packages

The packages are already created in the monorepo:
- `packages/risk-engine`
- `packages/paper-trading`

Run:
```bash
npm install
npm run build
npm run test
```

## Usage Examples

### Risk Engine - Basic Usage

```typescript
import { RiskEngine } from '@atc/risk-engine';
import { riskConfigFromEnv, loadEnv } from '@atc/config';

// Setup
const env = loadEnv();
const riskConfig = riskConfigFromEnv(env);
const instruments = {
  'EUR/USD': {
    symbol: 'EUR/USD',
    pipSize: 0.0001,
    contractSize: 100_000,
    currentBid: 1.0500,
    currentAsk: 1.0501,
  },
  // ... other instruments
};

const engine = new RiskEngine({ riskConfig, instruments });

// Validate a trade plan
const result = engine.validateTradePlan(
  {
    instrument: 'EUR/USD',
    side: 'buy',
    entry: 1.0500,
    stop: 1.0400,
    target: 1.0650,
    accountEquity: 10_000,
    accountCurrency: 'USD',
  },
  {
    equity: 10_000,
    dailyPnL: 0,
    openPositions: [],
    openOrders: [],
  },
);

if (result.approved) {
  console.log(`✓ Trade approved`);
  console.log(`  Position: ${result.positionSize.quantityLots} lots`);
  console.log(`  Risk: $${result.positionSize.riskAmount}`);
  console.log(`  R:R: ${result.positionSize.rewardRisk}:1`);
} else {
  console.log(`✗ Trade rejected`);
  result.reasons.forEach(r => console.log(`  - ${r}`));
}
```

### Risk Engine - Get Current Limits

```typescript
const limits = engine.getRiskLimits(10_000);
console.log(`Per-trade limit: $${limits.perTradeLimitUSD}`);
console.log(`Daily loss limit: $${limits.dailyLossLimitUSD}`);
console.log(`Open risk limit: $${limits.openRiskLimitUSD}`);
console.log(`Max positions: ${limits.maxPositions}`);
console.log(`Min R:R: ${limits.minRewardRisk}:1`);
```

### Risk Engine - Check Exposure

```typescript
const summary = engine.getExposureSummary(accountState, 10_000);
console.log(`Open risk: $${summary.openRisk} / $${summary.openRiskLimit}`);
console.log(`Risk %: ${summary.riskPct}%`);
console.log(`Positions: ${summary.openPositions} / ${summary.maxPositions}`);
console.log(`Remaining risk: $${summary.riskRemaining}`);
```

### Paper Trading - Submit Order

```typescript
import { PaperTradingEngine } from '@atc/paper-trading';

const engine = new PaperTradingEngine(riskConfig, pipSizes);

const order = engine.submitOrder({
  instrument: 'EUR/USD',
  side: 'buy',
  type: 'market',
  quantityLots: 1,
  stopLoss: 1.0400,
  takeProfit: 1.0650,
  idempotencyKey: `order-${Date.now()}`,
  riskDecision: validation, // From RiskEngine
});

console.log(`Order submitted: ${order.id}`);
console.log(`Status: ${order.status}`);
```

### Paper Trading - Execute Order

```typescript
const executed = engine.executeOrder(
  order.id,
  currentQuote.bid,      // 1.0500
  currentQuote.ask,      // 1.0501
  new Date().toISOString(),
);

if (executed.success) {
  console.log(`Order filled at ${executed.order.filledPrice}`);
  console.log(`Positions: ${engine.getOpenPositions().length}`);
} else {
  console.log(`Execution failed: ${executed.reason}`);
}
```

### Paper Trading - Update Position

```typescript
const positions = engine.getOpenPositions();
const position = positions[0];

// Update with current price
const updated = engine.updatePosition(position.id, 1.0550);

console.log(`Entry: ${updated.entryPrice}`);
console.log(`Current: ${updated.currentPrice}`);
console.log(`P&L: $${updated.unrealizedPnL}`);
console.log(`P&L %: ${updated.unrealizedPnLPct}%`);
```

### Paper Trading - Check Closure

```typescript
const closure = engine.checkClosureTriggers(
  position.id,
  currentQuote.bid,
  currentQuote.ask,
);

if (closure.shouldClose) {
  console.log(`Position should close: ${closure.reason}`);
  
  const result = engine.closePosition({
    positionId: position.id,
    closePrice: currentQuote.mid,
    reason: closure.reason,
    timestamp: new Date().toISOString(),
  });
  
  if (result.success) {
    const trade = result.closedTrade!;
    console.log(`Trade closed`);
    console.log(`  Entry: ${trade.entryPrice}`);
    console.log(`  Exit: ${trade.exitPrice}`);
    console.log(`  P&L: $${trade.netPnL}`);
    console.log(`  R-Multiple: ${trade.rMultiple}R`);
  }
}
```

### Paper Trading - Get Account Snapshot

```typescript
const snapshot = engine.getAccountSnapshot(new Date().toISOString());

console.log(`Equity: $${snapshot.equity}`);
console.log(`Total P&L: $${snapshot.totalPnL} (${snapshot.totalPnLPct}%)`);
console.log(`Daily P&L: $${snapshot.dailyPnL} (${snapshot.dailyPnLPct}%)`);
console.log(`Drawdown: ${snapshot.drawdownPct}%`);
console.log(`Positions: ${snapshot.openPositions}`);
console.log(`Orders: ${snapshot.openOrders}`);
console.log(`Trades: ${snapshot.totalTrades}`);
console.log(`Win rate: ${snapshot.winRate}%`);
console.log(`Expectancy: $${snapshot.expectancy}`);
```

### Paper Trading - Get Performance Metrics

```typescript
const metrics = engine.getPerformanceMetrics();

console.log(`Total trades: ${metrics.trades}`);
console.log(`Wins: ${metrics.wins}`);
console.log(`Losses: ${metrics.losses}`);
console.log(`Win rate: ${metrics.winRate}%`);
console.log(`Net P&L: $${metrics.netPnl}`);
console.log(`Gross profit: $${metrics.grossProfit}`);
console.log(`Gross loss: $${metrics.grossLoss}`);
console.log(`Profit factor: ${metrics.profitFactor}`);
console.log(`Expectancy: $${metrics.expectancy}`);
console.log(`Avg win: $${metrics.averageWin}`);
console.log(`Avg loss: $${metrics.averageLoss}`);
console.log(`Avg R: ${metrics.averageR}R`);
console.log(`Max drawdown: $${metrics.maxDrawdown} (${metrics.maxDrawdownPct}%)`);
```

## API Endpoints

### POST /api/v1/risk/position-size

Calculate position size from risk percentage.

**Request**:
```json
{
  "instrument": "EUR/USD",
  "side": "buy",
  "entry": 1.0500,
  "stop": 1.0400,
  "target": 1.0650,
  "accountEquity": 10000
}
```

**Response** (200):
```json
{
  "quantityLots": 1,
  "notionalUSD": 105000,
  "riskAmount": 100,
  "riskPct": 1,
  "rewardAmount": 200,
  "rewardRisk": 2.0,
  "stopDistance": 10,
  "targetDistance": 20,
  "pipValuePerLot": 10
}
```

### POST /api/v1/risk/validate-plan

Validate complete trade plan with position sizing and limit checks.

**Request**:
```json
{
  "instrument": "EUR/USD",
  "side": "buy",
  "entry": 1.0500,
  "stop": 1.0400,
  "target": 1.0650,
  "accountEquity": 10000
}
```

**Response** (200):
```json
{
  "approved": true,
  "positionSize": { ... },
  "limitCheck": {
    "perTradeOk": true,
    "dailyLossOk": true,
    "openRiskOk": true,
    "maxPositionsOk": true,
    "minRROk": true,
    "allOk": true,
    "violations": [],
    "warnings": []
  },
  "reasons": [
    "Position size calculated: 1 lots",
    "Risk amount: $100.00",
    "Reward-to-risk: 2.00",
    "✓ Trade plan approved - all checks passed"
  ],
  "warnings": [],
  "computedAt": "2024-01-01T12:00:00.000Z"
}
```

### POST /api/v1/paper-orders

Submit a new paper trading order.

**Request**:
```json
{
  "instrument": "EUR/USD",
  "side": "buy",
  "type": "market",
  "quantityLots": 1,
  "stopLoss": 1.0400,
  "takeProfit": 1.0650,
  "idempotencyKey": "unique-key-123"
}
```

**Response** (201):
```json
{
  "id": "order-uuid",
  "idempotencyKey": "unique-key-123",
  "instrument": "EUR/USD",
  "side": "buy",
  "type": "market",
  "quantityLots": 1,
  "requestedPrice": null,
  "stopLoss": 1.0400,
  "takeProfit": 1.0650,
  "status": "pending",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "filledAt": null,
  "filledPrice": null,
  "exitPrice": null,
  "closedAt": null,
  "spreadAtEntry": null,
  "slippage": 0,
  "commission": 0,
  "pnl": null,
  "rMultiple": null,
  "closeReason": null,
  "notes": "",
  "riskDecision": null
}
```

### GET /api/v1/paper-orders

List orders with optional filters.

**Query Parameters**:
```
status=filled|pending|cancelled
instrument=EUR/USD|GBP/USD|XAU/USD
from=2024-01-01T00:00:00Z
to=2024-01-31T23:59:59Z
```

**Response** (200):
```json
[
  { ... order 1 ... },
  { ... order 2 ... }
]
```

### POST /api/v1/paper-orders/{id}/execute

Execute a pending order at current market prices.

**Request**:
```json
{
  "bid": 1.0500,
  "ask": 1.0501
}
```

**Response** (200):
```json
{
  "success": true,
  "order": { ... filled order ... }
}
```

### POST /api/v1/paper-orders/{id}/modify

Modify a pending order.

**Request**:
```json
{
  "stopLoss": 1.0350,
  "takeProfit": 1.0700
}
```

**Response** (200):
```json
{ ... modified order ... }
```

### DELETE /api/v1/paper-orders/{id}

Cancel a pending order.

**Response** (200):
```json
{ ... cancelled order ... }
```

### GET /api/v1/paper-positions

Get all open positions.

**Response** (200):
```json
[
  {
    "id": "position-uuid",
    "orderId": "order-uuid",
    "instrument": "EUR/USD",
    "side": "buy",
    "quantityLots": 1,
    "entryPrice": 1.0501,
    "currentPrice": 1.0550,
    "stopLoss": 1.0400,
    "takeProfit": 1.0650,
    "unrealizedPnL": 49,
    "unrealizedPnLPct": 0.47,
    "openedAt": "2024-01-01T12:00:00.000Z",
    "riskDecision": null
  }
]
```

### POST /api/v1/paper-positions/{id}/close

Close an open position.

**Request**:
```json
{
  "closePrice": 1.0600,
  "reason": "target",
  "notes": "Hit take profit target"
}
```

**Response** (200):
```json
{
  "success": true,
  "closedTrade": {
    "id": "trade-uuid",
    "orderId": "order-uuid",
    "instrument": "EUR/USD",
    "side": "buy",
    "entryPrice": 1.0501,
    "exitPrice": 1.0600,
    "quantityLots": 1,
    "grossPnL": 99,
    "netPnL": 90,
    "pnLPct": 0.94,
    "rMultiple": 0.9,
    "openedAt": "2024-01-01T12:00:00.000Z",
    "closedAt": "2024-01-01T12:30:00.000Z",
    "durationMs": 1800000,
    "closeReason": "target",
    "notes": "Hit take profit target"
  }
}
```

### GET /api/v1/paper-trades

Get closed trades (journal).

**Query Parameters**:
```
from=2024-01-01T00:00:00Z
to=2024-01-31T23:59:59Z
instrument=EUR/USD|GBP/USD|XAU/USD
```

**Response** (200):
```json
[ ... closed trades ... ]
```

### GET /api/v1/paper-analytics

Get performance metrics.

**Query Parameters**:
```
from=2024-01-01T00:00:00Z
to=2024-01-31T23:59:59Z
```

**Response** (200):
```json
{
  "trades": 10,
  "wins": 7,
  "losses": 3,
  "breakeven": 0,
  "winRate": 70,
  "netPnl": 850,
  "grossProfit": 1200,
  "grossLoss": 350,
  "expectancy": 85,
  "profitFactor": 3.43,
  "averageWin": 171.43,
  "averageLoss": 116.67,
  "averageR": 0.75,
  "totalR": 7.5,
  "maxDrawdown": 300,
  "maxDrawdownPct": 3,
  "startingEquity": 10000,
  "endingEquity": 10850
}
```

### POST /api/v1/paper/reset

Reset paper account to starting balance.

**Request**:
```json
{
  "newBalance": 10000
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Account reset to $10,000"
}
```

## Common Patterns

### Pattern 1: Complete Trade Flow

```typescript
// 1. Validate plan
const validation = riskEngine.validateTradePlan(plan, accountState);
if (!validation.approved) throw new Error('Plan rejected');

// 2. Submit order
const order = paperEngine.submitOrder({
  ...plan,
  quantityLots: validation.positionSize.quantityLots,
  idempotencyKey: generateId(),
  riskDecision: validation,
});

// 3. Execute immediately
const exec = paperEngine.executeOrder(
  order.id,
  quote.bid,
  quote.ask,
  now(),
);

// 4. Update position loop
setInterval(async () => {
  const position = paperEngine.updatePosition(positions[0].id, quote.mid);
  const closure = paperEngine.checkClosureTriggers(position.id, quote.bid, quote.ask);
  
  if (closure.shouldClose) {
    paperEngine.closePosition({
      positionId: position.id,
      closePrice: quote.mid,
      reason: closure.reason,
      timestamp: now(),
    });
  }
}, 1000);

// 5. Get results
const metrics = paperEngine.getPerformanceMetrics();
```

### Pattern 2: Pending Order Management

```typescript
// Submit as pending (don't execute immediately)
const order = paperEngine.submitOrder({ ... });

// Modify while pending
paperEngine.modifyOrder(order.id, {
  takeProfit: 1.0700,
  stopLoss: 1.0350,
});

// Execute when ready
paperEngine.executeOrder(order.id, bid, ask, now());

// Or cancel
paperEngine.cancelOrder(order.id);
```

### Pattern 3: Risk Calculation Before Trading

```typescript
// Always validate before taking a trade
for (const signal of signals) {
  const validation = riskEngine.validateTradePlan(signal, accountState);
  
  if (!validation.approved) {
    console.log(`Skip: ${validation.reasons.join(', ')}`);
    continue;
  }
  
  // Safe to trade
  console.log(`Trade approved: ${validation.positionSize.quantityLots} lots`);
}
```

## Debugging

### Position sizing not changing

```typescript
// Check if inputs are changing
console.log('Entry:', entry);
console.log('Stop:', stop);
console.log('Account:', accountEquity);
console.log('Risk %:', riskPerTradePct);

// Should change position size if any change
const pos = engine.validateTradePlan(plan, state);
console.log('Position:', pos.positionSize.quantityLots);
```

### Limits not enforced

```typescript
// Check current limits
const limits = engine.getRiskLimits(10000);
console.log('Limits:', limits);

// Check account state
console.log('Daily P&L:', accountState.dailyPnL);
console.log('Open positions:', accountState.openPositions.length);
console.log('Open orders:', accountState.openOrders.length);

// Should reject if violating
const validation = engine.validateTradePlan(plan, accountState);
console.log('Violations:', validation.limitCheck.violations);
```

### P&L not calculating

```typescript
// Check order fill price
console.log('Filled at:', order.filledPrice);

// Check position update
console.log('Current price:', position.currentPrice);

// Should calculate P&L
console.log('Unrealized P&L:', position.unrealizedPnL);

// Close and check
const closed = paperEngine.closePosition({ ... });
console.log('Net P&L:', closed.closedTrade?.netPnL);
```

## Performance Tips

1. **Batch updates**: Update multiple positions in one loop
2. **Debounce**: Don't update prices every millisecond
3. **Cache**: Store engine instances, don't recreate
4. **Limit queries**: Use date ranges when fetching trades
5. **Index positions**: By accountId + status for fast lookups

## Testing Examples

```typescript
import { describe, it, expect } from 'vitest';

describe('My trading strategy', () => {
  it('should validate trade plans correctly', () => {
    const validation = engine.validateTradePlan(plan, accountState);
    expect(validation.approved).toBe(true);
  });

  it('should calculate position size deterministically', () => {
    const size1 = engine.validateTradePlan(plan, state).positionSize.quantityLots;
    const size2 = engine.validateTradePlan(plan, state).positionSize.quantityLots;
    expect(size1).toBe(size2);
  });

  it('should close positions on target', () => {
    // Submit and execute
    paperEngine.submitOrder({ ... });
    paperEngine.executeOrder(orderId, bid, ask, now);
    
    // Check trigger
    const closure = paperEngine.checkClosureTriggers(posId, bid, 1.0650);
    expect(closure.shouldClose).toBe(true);
    expect(closure.reason).toBe('target');
  });
});
```

---

**Last Updated**: 2024  
**Version**: 1.0.0
