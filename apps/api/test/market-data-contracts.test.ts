import assert from "node:assert/strict";
import test from "node:test";
import { MarketCandleSchema, MarketQuoteSchema } from "../src/market-data/contracts.js";

const validCandle = {
  providerId: "provider.example",
  instrument: "XAU/USD",
  timeframe: "15m",
  openTime: "2026-10-21T12:00:00.000Z",
  closeTime: "2026-10-21T12:15:00.000Z",
  retrievedAt: "2026-10-21T12:15:02.000Z",
  complete: true,
  open: "4000.1",
  high: "4001.50",
  low: "3999.95",
  close: "4001.25",
};

test("accepts provenance-bearing candles without assuming volume exists", () => {
  const candle = MarketCandleSchema.parse(validCandle);

  assert.equal(candle.instrument, "XAU/USD");
  assert.equal(candle.volume, undefined);
});

test("compares decimal prices without converting them to floating point", () => {
  assert.equal(
    MarketCandleSchema.safeParse({
      ...validCandle,
      low: "4000.100000000000000001",
      open: "4000.1",
    }).success,
    false,
  );
});

test("rejects candles with inverted prices or invalid time ordering", () => {
  assert.equal(
    MarketCandleSchema.safeParse({ ...validCandle, high: "4000.99" }).success,
    false,
  );
  assert.equal(
    MarketCandleSchema.safeParse({ ...validCandle, closeTime: validCandle.openTime }).success,
    false,
  );
});

test("rejects timestamps that are not UTC or prices in exponent notation", () => {
  assert.equal(
    MarketCandleSchema.safeParse({
      ...validCandle,
      openTime: "2026-10-21T12:00:00+02:00",
    }).success,
    false,
  );
  assert.equal(
    MarketCandleSchema.safeParse({ ...validCandle, close: "4.00125e3" }).success,
    false,
  );
});

test("quote bid and ask are optional, but must appear together and remain ordered", () => {
  const quote = {
    providerId: "provider.example",
    instrument: "EUR/USD",
    observedAt: "2026-10-21T12:00:00.000Z",
    retrievedAt: "2026-10-21T12:00:01.000Z",
    price: "1.165",
    priceType: "mid" as const,
    delayStatus: "unknown" as const,
  };

  assert.equal(MarketQuoteSchema.safeParse(quote).success, true);
  assert.equal(MarketQuoteSchema.safeParse({ ...quote, bid: "1.164" }).success, false);
  assert.equal(
    MarketQuoteSchema.safeParse({ ...quote, bid: "1.166", ask: "1.165" }).success,
    false,
  );
  assert.equal(
    MarketQuoteSchema.safeParse({ ...quote, observedAt: "2026-10-21T12:00:02.000Z" }).success,
    false,
  );
});
