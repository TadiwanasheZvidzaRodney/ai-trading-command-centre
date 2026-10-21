import { z } from "zod";

const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const decimalSchema = z.string().max(42).regex(decimalPattern, "Must be a non-negative decimal string");

const instrumentSchema = z
  .string()
  .regex(/^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/, "Must use BASE/QUOTE format");

const timeframeSchema = z
  .string()
  .regex(/^[1-9]\d*(?:m|h|d|w)$/, "Must be a positive minute, hour, day, or week interval");

const utcTimestampSchema = z.iso.datetime({ offset: false });

function compareDecimals(left: string, right: string): number {
  const [leftWhole = "0", leftFraction = ""] = left.split(".");
  const [rightWhole = "0", rightFraction = ""] = right.split(".");
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftScaled = BigInt(leftWhole + leftFraction.padEnd(scale, "0"));
  const rightScaled = BigInt(rightWhole + rightFraction.padEnd(scale, "0"));

  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

const providerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9.-]*$/, "Must be a provider identifier");

export const MarketQuoteSchema = z
  .object({
    providerId: providerIdSchema,
    instrument: instrumentSchema,
    observedAt: utcTimestampSchema,
    retrievedAt: utcTimestampSchema,
    price: decimalSchema,
    priceType: z.enum(["mid", "last"]),
    delayStatus: z.enum(["realtime", "delayed", "unknown"]),
    delaySeconds: z.number().int().nonnegative().optional(),
    bid: decimalSchema.optional(),
    ask: decimalSchema.optional(),
  })
  .strict()
  .refine((quote) => Date.parse(quote.retrievedAt) >= Date.parse(quote.observedAt), {
    path: ["retrievedAt"],
    message: "Retrieval time must not precede observation time",
  })
  .refine(
    (quote) =>
      (quote.bid === undefined && quote.ask === undefined) ||
      (quote.bid !== undefined &&
        quote.ask !== undefined &&
        decimalPattern.test(quote.bid) &&
        decimalPattern.test(quote.ask) &&
        compareDecimals(quote.bid, quote.ask) <= 0),
    {
      path: ["bid"],
      message: "Bid and ask must be provided together, with bid no greater than ask",
    },
  );

export const MarketCandleSchema = z
  .object({
    providerId: providerIdSchema,
    instrument: instrumentSchema,
    timeframe: timeframeSchema,
    openTime: utcTimestampSchema,
    closeTime: utcTimestampSchema,
    retrievedAt: utcTimestampSchema,
    complete: z.boolean(),
    open: decimalSchema,
    high: decimalSchema,
    low: decimalSchema,
    close: decimalSchema,
    volume: decimalSchema.optional(),
  })
  .strict()
  .refine((candle) => Date.parse(candle.closeTime) > Date.parse(candle.openTime), {
    path: ["closeTime"],
    message: "Candle close time must be after open time",
  })
  .refine(
    (candle) =>
      [candle.open, candle.high, candle.low, candle.close].every((price) =>
        decimalPattern.test(price),
      ) &&
      compareDecimals(candle.low, candle.open) <= 0 &&
      compareDecimals(candle.low, candle.close) <= 0 &&
      compareDecimals(candle.open, candle.high) <= 0 &&
      compareDecimals(candle.close, candle.high) <= 0,
    {
      path: ["high"],
      message: "Candle prices must satisfy low <= open/close <= high",
    },
  );

export type MarketQuote = z.infer<typeof MarketQuoteSchema>;
export type MarketCandle = z.infer<typeof MarketCandleSchema>;

export interface MarketDataProvider {
  readonly providerId: string;
  getQuote(instrument: string, signal?: AbortSignal): Promise<MarketQuote>;
  getCandles(
    instrument: string,
    timeframe: string,
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<MarketCandle[]>;
}
