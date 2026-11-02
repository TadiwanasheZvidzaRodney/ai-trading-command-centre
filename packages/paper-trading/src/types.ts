import type { OrderSide, OrderType, OrderStatus, InstrumentSymbol, RiskDecision } from '@atc/shared';

export interface PaperOrderInput {
  instrument: InstrumentSymbol;
  side: OrderSide;
  type: OrderType;
  quantityLots: number;
  requestedPrice?: number | null;
  stopLoss: number;
  takeProfit: number;
  idempotencyKey: string;
  riskDecision?: RiskDecision;
}

export interface PaperOrder {
  id: string;
  idempotencyKey: string;
  instrument: InstrumentSymbol;
  side: OrderSide;
  type: OrderType;
  quantityLots: number;
  requestedPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  status: OrderStatus;
  createdAt: string;
  filledAt: string | null;
  filledPrice: number | null;
  exitPrice: number | null;
  closedAt: string | null;
  spreadAtEntry: number | null;
  slippage: number;
  commission: number;
  pnl: number | null;
  rMultiple: number | null;
  closeReason: 'stop' | 'target' | 'manual' | null;
  notes: string;
  riskDecision: RiskDecision | null;
}

export interface PaperPosition {
  id: string;
  orderId: string;
  instrument: InstrumentSymbol;
  side: OrderSide;
  quantityLots: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  openedAt: string;
  riskDecision: RiskDecision | null;
}

export interface ClosedTrade {
  id: string;
  orderId: string;
  instrument: InstrumentSymbol;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  quantityLots: number;
  grossPnL: number;
  netPnL: number;
  pnLPct: number;
  rMultiple: number | null;
  openedAt: string;
  closedAt: string;
  durationMs: number;
  closeReason: 'stop' | 'target' | 'manual';
  notes: string;
  spreadAtEntry: number | null;
  slippage: number;
  commission: number;
  riskDecision: RiskDecision | null;
}

export interface PaperAccountSnapshot {
  timestamp: string;
  equity: number;
  balance: number;
  startingBalance: number;
  totalPnL: number;
  totalPnLPct: number;
  dailyPnL: number;
  dailyPnLPct: number;
  drawdown: number;
  drawdownPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  openPositions: number;
  openOrders: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number | null;
  expectancy: number | null;
  averageR: number | null;
  totalR: number | null;
}

export interface FillResult {
  fillPrice: number;
  spread: number;
  slippage: number;
  commission: number;
  totalCost: number;
}

export interface OrderExecutionRequest {
  orderId: string;
  currentBid: number;
  currentAsk: number;
  timestamp: string;
}

export interface OrderExecutionResult {
  success: boolean;
  reason?: string;
  fillPrice?: number;
  fillTime?: string;
}

export interface PositionUpdate {
  positionId: string;
  currentPrice: number;
  timestamp: string;
}

export interface ClosureRequest {
  positionId: string;
  closePrice: number;
  reason: 'stop' | 'target' | 'manual';
  timestamp: string;
  notes?: string;
}

export interface ClosureResult {
  success: boolean;
  closedTrade?: ClosedTrade;
  reason?: string;
}

export interface DailyStats {
  date: string;
  openingBalance: number;
  closingBalance: number;
  dailyPnL: number;
  dailyPnLPct: number;
  tradesOpened: number;
  tradesClosed: number;
  wins: number;
  losses: number;
  breakeven: number;
}

export interface PerformanceMetrics {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  expectancy: number | null;
  profitFactor: number | null;
  averageWin: number;
  averageLoss: number;
  averageR: number | null;
  totalR: number | null;
  maxDrawdown: number;
  maxDrawdownPct: number;
  startingEquity: number;
  endingEquity: number;
  bestTrade: number | null;
  worstTrade: number | null;
  avgWinLossRatio: number | null;
}
