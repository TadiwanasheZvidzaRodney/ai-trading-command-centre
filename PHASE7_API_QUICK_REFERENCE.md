# Phase 7 API Routes - Quick Reference

## 17 Endpoints Implemented

### Risk Engine (5 endpoints)

```http
# Calculate position size
POST /api/v1/risk/position-size
Content-Type: application/json

{
  "instrument": "XAU/USD",
  "accountBalance": 10000,
  "riskPct": 2,
  "entryPrice": 2000,
  "stopPrice": 1950,
  "side": "buy"
}

Response: { quantity, contracts, cost, maxLoss, leverage }
```

```http
# Validate trade plan
POST /api/v1/risk/validate-plan
Content-Type: application/json

{
  "instrument": "XAU/USD",
  "side": "buy",
  "entryPrice": 2000,
  "stopPrice": 1950,
  "targetPrice": 2050,
  "quantity": 1,
  "currentPositions": [],
  "dailyLossUSD": 0
}

Response: { valid, reason, violations[], suggestions[] }
```

```http
# Get risk limits configuration
GET /api/v1/risk/limits

Response: { perTradeRiskPct, dailyLossPct, maxOpenRiskPct, maxPositions, minRR, correlationThreshold }
```

```http
# Calculate position correlation
POST /api/v1/risk/correlate
Content-Type: application/json

{
  "positions": [
    { "instrument": "XAU/USD", "side": "buy", "quantity": 1, "currentPrice": 2000 }
  ]
}

Response: { correlation, risk: "low|medium|high" }
```

```http
# Get current risk exposure
GET /api/v1/risk/exposure

Response: { totalOpenRisk, dailyLoss, openPositions, dailyTrades }
```

### Paper Trading - Orders (5 endpoints)

```http
# Create order
POST /api/v1/paper-orders
Content-Type: application/json

{
  "instrument": "XAU/USD",
  "side": "buy",
  "entryPrice": 2000,
  "stopPrice": 1950,
  "targetPrice": 2050,
  "quantity": 1,
  "notes": "Testing order creation"
}

Response: { orderId, status: "pending", createdAt, ... }
```

```http
# List orders with optional filters
GET /api/v1/paper-orders?status=pending&instrument=XAU%2FUSD

Response: { orders[], total }
```

```http
# Update pending order
PATCH /api/v1/paper-orders/{orderId}
Content-Type: application/json

{
  "stopPrice": 1945,
  "quantity": 2
}

Response: Updated order object
```

```http
# Cancel pending order
DELETE /api/v1/paper-orders/{orderId}

Response: { cancelled: true, orderId }
```

```http
# Fill pending order (internal endpoint)
POST /api/v1/paper-orders/{orderId}/fill
Content-Type: application/json

{
  "currentBid": 1999.5,
  "currentAsk": 2000.5
}

Response: { filled: true, fillPrice, cost, orderId }
```

### Paper Trading - Positions (2 endpoints)

```http
# Get open positions
GET /api/v1/paper-positions

Response: { positions[], total }
```

```http
# Close position
PATCH /api/v1/paper-positions/{positionId}/close
Content-Type: application/json

{
  "closePrice": 2050,
  "reason": "manual|stop|target"
}

Response: { closed: true, realizedPnL, rMultiple, positionId }
```

### Paper Trading - Trades (2 endpoints)

```http
# Get closed trades with pagination
GET /api/v1/paper-trades?limit=20&offset=0&instrument=XAU%2FUSD

Response: { trades[], total, limit, offset }
```

```http
# Update trade notes
PATCH /api/v1/paper-trades/{tradeId}/notes
Content-Type: application/json

{
  "notes": "Good trade, hit target"
}

Response: Updated trade object with notes
```

### Account Management (3 endpoints)

```http
# Get account snapshot
GET /api/v1/paper/account

Response: { startingBalance, currentBalance, realizedPnL, unrealizedPnL, totalPnL, accountPnLPct }
```

```http
# Get performance analytics
GET /api/v1/paper-analytics

Response: { totalTrades, openTrades, closedTrades, winRate, profitFactor, expectancy, maxDD, totalRealizedPnL, accountBalance }
```

```http
# Reset account
POST /api/v1/paper/reset
Content-Type: application/json

{
  "confirm": true
}

Response: { reset: true, newBalance }
```

## Key Calculations

### Position Size
```
quantity = (accountBalance × riskPct%) / (entryPrice - stopPrice)
maxLoss = stopPrice × quantity  
leverage = (entryPrice × quantity) / accountBalance
```

### P&L
```
// For BUY:
P&L = (exitPrice - entryPrice) × quantity

// For SELL:
P&L = (entryPrice - exitPrice) × quantity

rMultiple = P&L / (|entryPrice - stopPrice| × quantity)
```

### Performance Metrics
```
winRate = (winningTrades / totalTrades) × 100
profitFactor = totalWins / totalLosses
expectancy = totalPnL / numberOfTrades
maxDD = (peak - trough) / peak × 100
```

## Environment Variables

```env
PAPER_STARTING_BALANCE=10000
PAPER_RISK_PER_TRADE_PCT=1
PAPER_MAX_DAILY_LOSS_PCT=3
PAPER_MAX_OPEN_RISK_PCT=5
PAPER_MAX_POSITIONS=3
PAPER_MIN_RR=1.5
```

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| VALIDATION_ERROR | 400 | Invalid input data |
| NOT_FOUND | 404 | Resource not found |
| INTERNAL_ERROR | 500 | Server error |

## Order Status Flow

```
pending → (fill) → filled → (close) → closed
   ↓
   (cancel) → cancelled
```

## Position Status Flow

```
open (from filled order) → (close) → closed
```

## Response Format

### Success
```json
{
  "status": "ok",
  "data": { /* ... */ },
  "timestamp": "2026-11-01T12:34:56.789Z"
}
```

### Error
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [],
    "requestId": "uuid"
  }
}
```

## Testing Workflow

1. **Create Order**
   - POST /api/v1/paper-orders
   - Returns orderId with status=pending

2. **Fill Order**
   - POST /api/v1/paper-orders/{orderId}/fill
   - Order moves to status=filled
   - Position created automatically

3. **Check Position**
   - GET /api/v1/paper-positions
   - See open position with entry price

4. **Close Position**
   - PATCH /api/v1/paper-positions/{positionId}/close
   - Position closed, trade recorded

5. **View Trade**
   - GET /api/v1/paper-trades
   - See closed trade with P&L

6. **Check Account**
   - GET /api/v1/paper/account
   - See updated balance and metrics

## Features

✅ **Position Sizing** - Calculates optimal position size from risk %
✅ **Trade Validation** - Validates plan against risk limits
✅ **Order Management** - Create, modify, cancel, fill orders
✅ **Position Tracking** - Track open positions with mark-to-market
✅ **P&L Calculation** - Accurate P&L and R multiple calculations
✅ **Trade Journal** - Historical record of all closed trades
✅ **Performance Metrics** - Win rate, profit factor, expectancy, max DD
✅ **Account Management** - Starting balance, current balance, PnL tracking
✅ **Risk Management** - Per-trade, daily, open risk limits
✅ **Deterministic** - All calculations produce same result for same inputs
✅ **Type-Safe** - Full Zod schema validation
✅ **Error Handling** - Comprehensive structured error responses
✅ **MongoDB** - Data persisted in MongoDB collections
✅ **Pagination** - Trades endpoint supports limit/offset
✅ **Filtering** - Orders/trades can be filtered by instrument/status
✅ **Notes** - Trades can have review notes attached
✅ **Idempotency** - Orders use orderId for safe retries

## MongoDB Collections

- `paper_orders` - Order records
- `paper_positions` - Open position records  
- `paper_trades` - Closed trade records

All collections have appropriate indexes for query performance.

## Next Phase

Phase 8 will implement the frontend pages:
- `/planner` - Trade planning interface
- `/paper` - Position management dashboard
- `/journal` - Trade review and analysis

These will consume the 17 API endpoints implemented here.
