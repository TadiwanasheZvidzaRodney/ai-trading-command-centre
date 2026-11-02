import type { OrderSide, InstrumentSymbol, RiskConfig } from '@atc/shared';

export interface TradePlanInput {
  instrument: InstrumentSymbol;
  side: OrderSide;
  entry: number;
  stop: number;
  target: number;
  accountEquity: number;
  accountCurrency: 'USD';
}

export interface PositionSizeOutput {
  quantityLots: number;
  notionalUSD: number;
  riskAmount: number;
  riskPct: number;
  rewardAmount: number;
  rewardRisk: number;
  stopDistance: number;
  targetDistance: number;
  pipValuePerLot: number;
}

export interface RiskLimits {
  perTradeLimitUSD: number;
  dailyLossLimitUSD: number;
  openRiskLimitUSD: number;
  maxPositions: number;
  minRewardRisk: number;
}

export interface LimitCheckResult {
  perTradeOk: boolean;
  dailyLossOk: boolean;
  openRiskOk: boolean;
  maxPositionsOk: boolean;
  minRROk: boolean;
  allOk: boolean;
  violations: string[];
  warnings: string[];
}

export interface RiskValidationResult {
  approved: boolean;
  positionSize: PositionSizeOutput;
  limitCheck: LimitCheckResult;
  reasons: string[];
  warnings: string[];
  inputsUsed: Record<string, unknown>;
  computedAt: string;
}

export interface AccountState {
  equity: number;
  dailyPnL: number;
  openPositions: OpenPosition[];
  openOrders: OpenOrder[];
}

export interface OpenPosition {
  id: string;
  instrument: InstrumentSymbol;
  side: OrderSide;
  quantityLots: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  riskAmount: number;
}

export interface OpenOrder {
  id: string;
  instrument: InstrumentSymbol;
  side: OrderSide;
  quantityLots: number;
  requestedPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  createdAt: string;
}

export interface RiskEngineConfig {
  riskConfig: RiskConfig;
  instruments: Record<InstrumentSymbol, InstrumentData>;
}

export interface InstrumentData {
  symbol: InstrumentSymbol;
  pipSize: number;
  contractSize: number;
  currentBid: number;
  currentAsk: number;
}

export interface PositionSizeInput {
  accountEquity: number;
  riskPerTradePct: number;
  entry: number;
  stop: number;
  pipValuePerLot: number;
  instrument: InstrumentSymbol;
  side: OrderSide;
}
