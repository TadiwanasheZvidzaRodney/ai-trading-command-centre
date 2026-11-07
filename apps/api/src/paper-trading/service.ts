import type { Env } from '@atc/config';
import type { CalendarService } from '@atc/economic-calendar';
import type { MarketDataService } from '@atc/market-data';
import {
  INSTRUMENTS,
  type InstrumentSymbol,
  type OrderSide,
  type RiskConfig,
} from '@atc/shared';
import { riskConfigFromEnv } from '@atc/config';
import type { Db } from 'mongodb';
import { randomUUID } from 'node:crypto';
import {
  calculateClosedPnl,
  calculateFillCosts,
  calculateSpreadPips,
  calculateUnrealizedPnl,
  entryFillPrice,
  exitFillPrice,
  round,
  unitsFromLots,
} from './pricing.js';
import {
  evaluateRisk,
  type KillSwitchState,
  type RiskGateResult,
  type RiskOpenOrder,
  type RiskOpenPosition,
} from './risk-gate.js';

type Doc = Record<string, unknown>;

export interface PaperTradingLogger {
  info?(context: Record<string, unknown>, message: string): void;
  warn?(context: Record<string, unknown>, message: string): void;
  error?(context: Record<string, unknown>, message: string): void;
}

export interface PaperTradingServiceOptions {
  db: Db;
  env: Env;
  marketData?: MarketDataService;
  calendar?: CalendarService;
  logger?: PaperTradingLogger;
  now?: () => Date;
}

export interface QuoteContext {
  instrument: InstrumentSymbol;
  bid: number | null;
  ask: number | null;
  spreadPips: number | null;
  quotedAt: string | null;
}

export interface PaperAccountState {
  equity: number;
  startingBalance: number;
  realizedPnL: number;
  unrealizedPnL: number;
  dailyPnL: number;
  openPositions: RiskOpenPosition[];
  openOrders: RiskOpenOrder[];
}

export interface CreateOrderInput {
  idempotencyKey: string;
  instrument: InstrumentSymbol;
  side: OrderSide;
  type: 'market' | 'limit';
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  quantity?: number;
  riskPct?: number;
  limitPrice?: number;
  notes?: string;
}

export interface CreateOrderResult {
  order: Doc;
  position: Doc | null;
  risk: RiskGateResult;
  duplicate: boolean;
}

export class PaperRiskRejectedError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PaperRiskRejectedError';
  }
}

const DAY_MS = 86_400_000;

/**
 * Database-backed paper trading service.
 *
 * All monetary values are USD. `quantity` is expressed in base-asset units
 * (for example 10,000 EUR), while lot counts are derived from the instrument
 * contract specification. This keeps P&L arithmetic honest.
 */
export class PaperTradingService {
  private readonly db: Db;
  private readonly env: Env;
  private readonly marketData: MarketDataService | undefined;
  private readonly calendar: CalendarService | undefined;
  private readonly logger: PaperTradingLogger | undefined;
  private readonly now: () => Date;
  readonly riskConfig: RiskConfig;

  constructor(options: PaperTradingServiceOptions) {
    this.db = options.db;
    this.env = options.env;
    this.marketData = options.marketData;
    this.calendar = options.calendar;
    this.logger = options.logger;
    this.now = options.now ?? (() => new Date());
    this.riskConfig = riskConfigFromEnv(options.env);
  }

  private get orders() {
    return this.db.collection('paper_orders');
  }
  private get positions() {
    return this.db.collection('paper_positions');
  }
  private get trades() {
    return this.db.collection('paper_trades');
  }
  private get settings() {
    return this.db.collection('settings');
  }

  async getKillSwitch(): Promise<KillSwitchState> {
    const doc = await this.settings.findOne({ key: 'kill-switch' });
    if (!doc) return { enabled: false };
    return {
      enabled: Boolean(doc.enabled),
      reason: typeof doc.reason === 'string' ? doc.reason : undefined,
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : undefined,
    };
  }

  async setKillSwitch(enabled: boolean, reason = ''): Promise<KillSwitchState> {
    const updatedAt = this.now().toISOString();
    await this.settings.updateOne(
      { key: 'kill-switch' },
      { $set: { key: 'kill-switch', enabled, reason, updatedAt } },
      { upsert: true },
    );
    return { enabled, reason, updatedAt };
  }

  async getQuote(instrument: InstrumentSymbol): Promise<QuoteContext> {
    if (!this.marketData) {
      return { instrument, bid: null, ask: null, spreadPips: null, quotedAt: null };
    }
    try {
      const batch = await this.marketData.getQuotes([instrument]);
      const quote = batch.quotes.find((item) => item.instrument === instrument);
      if (!quote) {
        return { instrument, bid: null, ask: null, spreadPips: null, quotedAt: null };
      }
      return {
        instrument,
        bid: quote.bid,
        ask: quote.ask,
        spreadPips: calculateSpreadPips(instrument, quote.bid, quote.ask),
        quotedAt: quote.observedAt,
      };
    } catch (error) {
      this.logger?.warn?.(
        { err: error, instrument },
        'Paper trading quote unavailable; failing closed for new orders',
      );
      return { instrument, bid: null, ask: null, spreadPips: null, quotedAt: null };
    }
  }

  async getQuotes(
    instruments: readonly InstrumentSymbol[],
  ): Promise<Map<InstrumentSymbol, QuoteContext>> {
    const map = new Map<InstrumentSymbol, QuoteContext>();
    if (!this.marketData || instruments.length === 0) return map;
    try {
      const batch = await this.marketData.getQuotes(instruments);
      for (const instrument of instruments) {
        const quote = batch.quotes.find((item) => item.instrument === instrument);
        map.set(instrument, {
          instrument,
          bid: quote?.bid ?? null,
          ask: quote?.ask ?? null,
          spreadPips: quote
            ? calculateSpreadPips(instrument, quote.bid, quote.ask)
            : null,
          quotedAt: quote?.observedAt ?? null,
        });
      }
    } catch (error) {
      this.logger?.warn?.({ err: error }, 'Batch quote fetch failed for paper trading');
    }
    return map;
  }

  async nextHighImpactMinutes(instrument: InstrumentSymbol): Promise<number | null> {
    if (!this.calendar) return null;
    try {
      const now = this.now();
      const feed = await this.calendar.getCalendar({
        impact: 'high',
        from: now.toISOString(),
        to: new Date(now.getTime() + DAY_MS).toISOString(),
        limit: 50,
      });
      const upcoming = feed.events
        .filter(
          (event) =>
            event.instruments.includes(instrument) ||
            event.instruments.includes('XAU/USD'),
        )
        .map((event) => Date.parse(event.scheduledAt))
        .filter((scheduled) => scheduled >= now.getTime())
        .sort((a, b) => a - b)[0];
      if (upcoming === undefined) return null;
      return Math.max(0, Math.round((upcoming - now.getTime()) / 60_000));
    } catch (error) {
      this.logger?.warn?.({ err: error }, 'Calendar unavailable for event blackout check');
      return null;
    }
  }

  async getAccountState(): Promise<PaperAccountState> {
    const [allTrades, openPositions, openOrders] = await Promise.all([
      this.trades.find({}).toArray(),
      this.positions.find({ status: 'open' }).toArray(),
      this.orders.find({ status: 'pending' }).toArray(),
    ]);

    const startingBalance = this.env.PAPER_STARTING_BALANCE;
    const realizedPnL = round(
      allTrades.reduce((sum, trade) => sum + numberOrZero(trade.realizedPnL), 0),
    );
    const unrealizedPnL = round(
      openPositions.reduce((sum, position) => sum + numberOrZero(position.unrealizedPnL), 0),
    );

    const startOfDay = new Date(this.now().toISOString().slice(0, 10)).getTime();
    const dailyPnL = round(
      allTrades
        .filter((trade) => Date.parse(String(trade.closedAt)) >= startOfDay)
        .reduce((sum, trade) => sum + numberOrZero(trade.realizedPnL), 0),
    );

    return {
      equity: round(startingBalance + realizedPnL + unrealizedPnL),
      startingBalance,
      realizedPnL,
      unrealizedPnL,
      dailyPnL,
      openPositions: openPositions.map((position) => this.toRiskPosition(position)),
      openOrders: openOrders.map((order) => this.toRiskOrder(order)),
    };
  }

  private toRiskPosition(position: Doc): RiskOpenPosition {
    const instrument = position.instrument as InstrumentSymbol;
    const entryPrice = numberOrZero(position.entryPrice);
    const stopPrice = numberOrZero(position.stopPrice);
    const quantity = numberOrZero(position.quantity);
    const spec = INSTRUMENTS[instrument];
    return {
      instrument,
      side: position.side as OrderSide,
      quantityLots: quantity / spec.contractSize,
      entryPrice,
      stopLoss: stopPrice,
      riskAmount:
        typeof position.riskAmount === 'number'
          ? position.riskAmount
          : Math.abs(entryPrice - stopPrice) * quantity,
    };
  }

  private toRiskOrder(order: Doc): RiskOpenOrder {
    const instrument = order.instrument as InstrumentSymbol;
    const spec = INSTRUMENTS[instrument];
    return {
      instrument,
      side: order.side as OrderSide,
      quantityLots: numberOrZero(order.quantity) / spec.contractSize,
      entryPrice: numberOrZero(order.entryPrice),
      stopLoss: numberOrZero(order.stopPrice),
      targetPrice: numberOrZero(order.targetPrice),
      createdAt: String(order.createdAt ?? this.now().toISOString()),
    };
  }

  private deriveQuantity(input: CreateOrderInput, equity: number): number {
    if (input.quantity !== undefined && input.quantity > 0) return input.quantity;
    const spec = INSTRUMENTS[input.instrument];
    const riskPct = input.riskPct ?? this.riskConfig.riskPerTradePct;
    const riskAmount = (equity * riskPct) / 100;
    const stopDistance = Math.abs(input.entryPrice - input.stopPrice);
    if (stopDistance <= 0) return 0;
    const lots = Math.max(spec.minLot, riskAmount / (stopDistance * spec.contractSize));
    const roundedLots = Number(lots.toFixed(2));
    return unitsFromLots(input.instrument, roundedLots);
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const existing = await this.orders.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) {
      return {
        order: existing,
        position: null,
        risk: (existing.riskDecision as RiskGateResult | undefined) ?? emptyRisk(),
        duplicate: true,
      };
    }

    const spec = INSTRUMENTS[input.instrument];
    const quantity = round(this.deriveQuantity(input, (await this.getAccountState()).equity), 2);
    const [quote, killSwitch, account, nextHighImpactMinutes] = await Promise.all([
      this.getQuote(input.instrument),
      this.getKillSwitch(),
      this.getAccountState(),
      this.nextHighImpactMinutes(input.instrument),
    ]);

    const risk = evaluateRisk({
      instrument: input.instrument,
      side: input.side,
      entry: input.entryPrice,
      stop: input.stopPrice,
      target: input.targetPrice,
      quantityLots: quantity / spec.contractSize,
      equity: account.equity,
      dailyPnL: account.dailyPnL,
      openPositions: account.openPositions,
      openOrders: account.openOrders,
      spreadPips: quote.spreadPips,
      nextHighImpactMinutes,
      killSwitch,
      riskConfig: this.riskConfig,
      correlationThreshold: 0.7,
    });

    if (!risk.approved) {
      throw new PaperRiskRejectedError(
        risk.code ?? 'RISK_REJECTED',
        risk.reasons[0] ?? 'Trade rejected by risk limits',
        {
          checks: risk.checks,
          riskAmount: risk.riskAmount,
          riskPct: risk.riskPct,
          rewardRisk: risk.rewardRisk,
          leverage: risk.leverage,
        },
      );
    }

    const createdAt = this.now().toISOString();
    const orderId = `order_${randomUUID()}`;
    const order: Doc = {
      id: orderId,
      orderId,
      idempotencyKey: input.idempotencyKey,
      status: input.type === 'market' ? 'filled' : 'pending',
      type: input.type,
      instrument: input.instrument,
      side: input.side,
      entryPrice: input.entryPrice,
      stopPrice: input.stopPrice,
      targetPrice: input.targetPrice,
      quantity,
      requestedLimitPrice: input.limitPrice ?? null,
      createdAt,
      filledAt: null,
      filledPrice: null,
      closedAt: null,
      closePrice: null,
      notes: input.notes ?? '',
      commission: 0,
      slippage: 0,
      spreadAtEntry: quote.spreadPips,
      riskDecision: { ...risk, computedAt: createdAt },
    };

    let position: Doc | null = null;
    if (input.type === 'market') {
      if (quote.bid === null || quote.ask === null) {
        throw new PaperRiskRejectedError(
          'QUOTE_UNAVAILABLE',
          'A live quote is required to fill a market order',
        );
      }
      const filled = this.buildFill(order, quote.bid, quote.ask);
      Object.assign(order, filled.order);
      position = filled.position;
      await this.positions.insertOne(position);
    }

    try {
      await this.orders.insertOne(order);
    } catch (error) {
      // A concurrent duplicate submission may have won the unique index race.
      const raced = await this.orders.findOne({ idempotencyKey: input.idempotencyKey });
      if (raced) {
        return {
          order: raced,
          position: null,
          risk,
          duplicate: true,
        };
      }
      throw error;
    }

    this.logger?.info?.(
      { orderId: order.orderId, instrument: input.instrument, side: input.side },
      'Paper order created',
    );
    return { order, position, risk, duplicate: false };
  }

  private buildFill(
    order: Doc,
    bid: number,
    ask: number,
  ): { order: Doc; position: Doc } {
    const instrument = order.instrument as InstrumentSymbol;
    const side = order.side as OrderSide;
    const quantity = numberOrZero(order.quantity);
    const costs = calculateFillCosts(instrument, quantity, {
      commissionPerLot: this.env.PAPER_COMMISSION_PER_LOT,
      slippagePips: this.env.PAPER_SLIPPAGE_PIPS,
    });
    const fillPrice = round(
      entryFillPrice(
        side,
        bid,
        ask,
        this.env.PAPER_SLIPPAGE_PIPS,
        instrument,
      ),
      INSTRUMENTS[instrument].pricePrecision,
    );
    const filledAt = this.now().toISOString();
    const stopPrice = numberOrZero(order.stopPrice);
    const riskAmount = round(Math.abs(numberOrZero(order.entryPrice) - stopPrice) * quantity);

    const positionId = `pos_${randomUUID()}`;
    return {
      order: {
        ...order,
        status: 'filled',
        filledAt,
        filledPrice: fillPrice,
        commission: costs.commission,
        slippage: costs.slippage,
        spreadAtEntry:
          typeof order.spreadAtEntry === 'number'
            ? order.spreadAtEntry
            : calculateSpreadPips(instrument, bid, ask),
      },
      position: {
        id: positionId,
        positionId,
        orderId: order.orderId,
        instrument,
        side,
        quantity,
        lots: costs.lots,
        entryPrice: fillPrice,
        currentPrice: fillPrice,
        stopPrice,
        targetPrice: numberOrZero(order.targetPrice),
        riskAmount,
        entryCosts: costs.total,
        commission: costs.commission,
        slippage: costs.slippage,
        unrealizedPnL: 0,
        unrealizedPnLPct: 0,
        openedAt: filledAt,
        status: 'open',
        riskDecision: order.riskDecision ?? null,
      },
    };
  }

  async fillOrder(
    orderId: string,
    bid: number,
    ask: number,
  ): Promise<{ order: Doc; position: Doc; duplicate: boolean }> {
    const existing = await this.orders.findOne({ orderId });
    if (!existing) throw new Error('NOT_FOUND');
    if (existing.status !== 'pending') {
      return { order: existing, position: null as unknown as Doc, duplicate: true };
    }

    const filled = this.buildFill(existing, bid, ask);
    const updateResult = await this.orders.findOneAndUpdate(
      { orderId, status: 'pending' },
      { $set: filled.order },
      { returnDocument: 'after' },
    );
    const updated = unwrapFindOneAndUpdate<Doc>(updateResult);
    if (!updated) {
      const raced = await this.orders.findOne({ orderId });
      if (!raced) throw new Error('NOT_FOUND');
      return { order: raced, position: null as unknown as Doc, duplicate: true };
    }

    const position = { ...filled.position, orderId };
    await this.positions.insertOne(position);
    return { order: updated, position, duplicate: false };
  }

  async markToMarket(
    quotes?: Map<InstrumentSymbol, QuoteContext>,
  ): Promise<{ positions: Doc[]; unrealizedPnL: number }> {
    const open = await this.positions.find({ status: 'open' }).toArray();
    const instruments = [...new Set(open.map((position) => position.instrument as InstrumentSymbol))];
    const quoteMap = quotes ?? (await this.getQuotes(instruments));

    let total = 0;
    for (const position of open) {
      const instrument = position.instrument as InstrumentSymbol;
      const quote = quoteMap.get(instrument);
      const side = position.side as OrderSide;
      const price = quote
        ? side === 'buy'
          ? quote.bid
          : quote.ask
        : null;
      const currentPrice =
        price ??
        (typeof position.currentPrice === 'number'
          ? position.currentPrice
          : numberOrZero(position.entryPrice));
      const pnl = calculateUnrealizedPnl(
        side,
        numberOrZero(position.entryPrice),
        currentPrice,
        numberOrZero(position.quantity),
      );
      total += pnl.pnl;
      position.currentPrice = currentPrice;
      position.unrealizedPnL = pnl.pnl;
      position.unrealizedPnLPct = pnl.pct;
      await this.positions.updateOne(
        { positionId: position.positionId },
        {
          $set: {
            currentPrice,
            unrealizedPnL: pnl.pnl,
            unrealizedPnLPct: pnl.pct,
          },
        },
      );
    }

    return { positions: open, unrealizedPnL: round(total) };
  }

  async evaluateTriggers(
    quotes?: Map<InstrumentSymbol, QuoteContext>,
  ): Promise<{
    evaluated: number;
    closed: Array<{
      positionId: string;
      instrument: InstrumentSymbol;
      reason: 'stop' | 'target';
      exitPrice: number;
      realizedPnL: number;
    }>;
  }> {
    const open = await this.positions.find({ status: 'open' }).toArray();
    const instruments = [...new Set(open.map((position) => position.instrument as InstrumentSymbol))];
    const quoteMap = quotes ?? (await this.getQuotes(instruments));
    const closed: Array<{
      positionId: string;
      instrument: InstrumentSymbol;
      reason: 'stop' | 'target';
      exitPrice: number;
      realizedPnL: number;
    }> = [];

    for (const position of open) {
      const instrument = position.instrument as InstrumentSymbol;
      const quote = quoteMap.get(instrument);
      if (!quote || quote.bid === null || quote.ask === null) continue;
      const side = position.side as OrderSide;
      const stop = numberOrZero(position.stopPrice);
      const target = numberOrZero(position.targetPrice);
      let reason: 'stop' | 'target' | null = null;
      if (side === 'buy') {
        if (quote.bid <= stop) reason = 'stop';
        else if (quote.bid >= target) reason = 'target';
      } else if (quote.ask >= stop) {
        reason = 'stop';
      } else if (quote.ask <= target) {
        reason = 'target';
      }
      if (!reason) continue;

      const exitPrice = round(
        exitFillPrice(side, quote.bid, quote.ask, this.env.PAPER_SLIPPAGE_PIPS, instrument),
        INSTRUMENTS[instrument].pricePrecision,
      );
      const result = await this.closePosition(String(position.positionId), {
        closePrice: exitPrice,
        reason,
      });
      if (result) {
        closed.push({
          positionId: result.trade.positionId as string,
          instrument,
          reason,
          exitPrice,
          realizedPnL: result.trade.realizedPnL as number,
        });
      }
    }

    return { evaluated: open.length, closed };
  }

  async closePosition(
    positionId: string,
    options: { closePrice?: number; reason: 'manual' | 'stop' | 'target' },
  ): Promise<{ position: Doc; trade: Doc } | null> {
    const position = await this.positions.findOne({ positionId });
    if (!position) throw new Error('NOT_FOUND');
    if (position.status !== 'open') throw new Error('ALREADY_CLOSED');

    const instrument = position.instrument as InstrumentSymbol;
    const side = position.side as OrderSide;
    let closePrice = options.closePrice;
    if (closePrice === undefined) {
      const quote = await this.getQuote(instrument);
      if (quote.bid === null || quote.ask === null) {
        throw new Error('QUOTE_UNAVAILABLE');
      }
      closePrice = round(
        exitFillPrice(side, quote.bid, quote.ask, this.env.PAPER_SLIPPAGE_PIPS, instrument),
        INSTRUMENTS[instrument].pricePrecision,
      );
    }

    const quantity = numberOrZero(position.quantity);
    const exitCosts = calculateFillCosts(instrument, quantity, {
      commissionPerLot: this.env.PAPER_COMMISSION_PER_LOT,
      slippagePips: this.env.PAPER_SLIPPAGE_PIPS,
    });
    const pnl = calculateClosedPnl({
      instrument,
      side,
      entryPrice: numberOrZero(position.entryPrice),
      exitPrice: closePrice,
      stopPrice: numberOrZero(position.stopPrice),
      quantityUnits: quantity,
      entryCosts: numberOrZero(position.entryCosts),
      exitCosts: exitCosts.total,
    });

    const closedAt = this.now().toISOString();
    const updateResult = await this.positions.findOneAndUpdate(
      { positionId, status: 'open' },
      {
        $set: {
          status: 'closed',
          currentPrice: closePrice,
          closedAt,
          unrealizedPnL: 0,
          unrealizedPnLPct: 0,
          exitCosts: exitCosts.total,
        },
      },
      { returnDocument: 'after' },
    );
    const updatedPosition = unwrapFindOneAndUpdate<Doc>(updateResult);
    if (!updatedPosition) throw new Error('ALREADY_CLOSED');

    await this.orders.updateOne(
      { orderId: position.orderId },
      { $set: { status: 'closed', closePrice, closedAt } },
    );

    const order = await this.orders.findOne({ orderId: position.orderId });
    const tradeId = `trade_${randomUUID()}`;
    const trade: Doc = {
      id: tradeId,
      tradeId,
      orderId: position.orderId,
      positionId,
      instrument,
      side,
      entryPrice: numberOrZero(position.entryPrice),
      exitPrice: closePrice,
      quantity,
      lots: numberOrZero(position.lots),
      grossPnL: pnl.grossPnL,
      costs: pnl.costs,
      realizedPnL: pnl.netPnL,
      pnLPct: pnl.pnlPct,
      rMultiple: pnl.rMultiple,
      realizedPnLPct: pnl.pnlPct,
      openedAt: String(position.openedAt ?? order?.createdAt ?? closedAt),
      duration: formatDuration(
        Date.parse(closedAt) - Date.parse(String(position.openedAt ?? closedAt)),
      ),
      createdAt: order?.createdAt ?? position.openedAt ?? closedAt,
      closedAt,
      closeReason: options.reason,
      notes: '',
    };
    await this.trades.insertOne(trade);

    return { position: updatedPosition, trade };
  }

  async analytics(): Promise<{
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    winRate: number;
    profitFactor: number | null;
    expectancy: number;
    maxDD: number;
    totalRealizedPnL: number;
    accountBalance: number;
    averageR: number | null;
    totalR: number | null;
    averageWin: number;
    averageLoss: number;
  }> {
    const [trades, openPositions, account] = await Promise.all([
      this.trades.find({}).sort({ closedAt: 1 }).toArray(),
      this.positions.find({ status: 'open' }).toArray(),
      this.getAccountState(),
    ]);

    const results = trades.map((trade) => numberOrZero(trade.realizedPnL));
    const wins = results.filter((value) => value > 0);
    const losses = results.filter((value) => value < 0);
    const totalWins = round(wins.reduce((sum, value) => sum + value, 0));
    const totalLosses = round(Math.abs(losses.reduce((sum, value) => sum + value, 0)));
    const rs = trades
      .map((trade) => (typeof trade.rMultiple === 'number' ? trade.rMultiple : null))
      .filter((value): value is number => value !== null);

    let running = this.env.PAPER_STARTING_BALANCE;
    let peak = running;
    let maxDD = 0;
    for (const trade of trades) {
      running += numberOrZero(trade.realizedPnL);
      peak = Math.max(peak, running);
      maxDD = Math.max(maxDD, ((peak - running) / peak) * 100);
    }

    const totalRealizedPnL = round(results.reduce((sum, value) => sum + value, 0));

    return {
      totalTrades: trades.length,
      openTrades: openPositions.length,
      closedTrades: trades.length,
      winRate: trades.length > 0 ? round((wins.length / trades.length) * 100) : 0,
      profitFactor: totalLosses > 0 ? round(totalWins / totalLosses) : totalWins > 0 ? null : null,
      expectancy: trades.length > 0 ? round(totalRealizedPnL / trades.length) : 0,
      maxDD: round(maxDD),
      totalRealizedPnL,
      accountBalance: round(account.startingBalance + totalRealizedPnL + account.unrealizedPnL),
      averageR:
        rs.length > 0 ? round(rs.reduce((sum, value) => sum + value, 0) / rs.length) : null,
      totalR: rs.length > 0 ? round(rs.reduce((sum, value) => sum + value, 0)) : null,
      averageWin: wins.length > 0 ? round(totalWins / wins.length) : 0,
      averageLoss: losses.length > 0 ? round(totalLosses / losses.length) : 0,
    };
  }
}

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0m';
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function unwrapFindOneAndUpdate<T>(result: unknown): T | null {
  if (!result) return null;
  const maybe = result as { value?: T };
  if (maybe.value !== undefined) return maybe.value;
  return result as T;
}

function emptyRisk(): RiskGateResult {
  return {
    approved: true,
    code: null,
    reasons: [],
    warnings: [],
    checks: [],
    riskAmount: 0,
    riskPct: 0,
    rewardRisk: 0,
    notionalUSD: 0,
    leverage: 0,
    stopDistance: 0,
    targetDistance: 0,
    quantityLots: 0,
  };
}
