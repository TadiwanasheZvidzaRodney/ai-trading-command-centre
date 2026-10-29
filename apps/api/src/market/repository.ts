import type { CandleSeries, Quote } from '@atc/shared';
import type { MarketDataStore } from '@atc/market-data';
import type { AnyBulkWriteOperation, Db, Document } from 'mongodb';

export class MongoMarketDataStore implements MarketDataStore {
  constructor(private readonly db: Db | null) {}

  async saveQuotes(quotes: Quote[]): Promise<void> {
    if (!this.db || quotes.length === 0) return;
    const now = new Date();
    const operations: AnyBulkWriteOperation<Document>[] = quotes.map((quote) => ({
      updateOne: {
        filter: {
          providerId: quote.provider.id,
          instrument: quote.instrument,
        },
        update: {
          $set: {
            providerId: quote.provider.id,
            instrument: quote.instrument,
            bid: quote.bid,
            ask: quote.ask,
            mid: quote.mid,
            spread: quote.spread,
            provider: quote.provider,
            observedAt: new Date(quote.observedAt),
            fetchedAt: new Date(quote.fetchedAt),
            ageSeconds: quote.ageSeconds,
            stale: quote.stale,
            quality: quote.quality,
            proxy: quote.proxy,
            proxyFor: quote.proxyFor ?? null,
            note: quote.note ?? null,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    }));
    await this.db.collection('quotes').bulkWrite(operations, { ordered: false });
  }

  async saveCandleSeries(series: CandleSeries): Promise<void> {
    if (!this.db || series.candles.length === 0) return;
    const now = new Date();
    const fetchedAt = new Date(series.fetchedAt);
    const operations: AnyBulkWriteOperation<Document>[] = series.candles.map((candle) => ({
      updateOne: {
        filter: {
          providerId: series.provider.id,
          instrument: series.instrument,
          timeframe: series.timeframe,
          time: candle.time,
        },
        update: {
          $set: {
            providerId: series.provider.id,
            instrument: series.instrument,
            timeframe: series.timeframe,
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            provider: series.provider,
            quality: series.quality,
            proxy: series.proxy,
            proxyFor: series.proxyFor ?? null,
            fetchedAt,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    }));
    await this.db.collection('candles').bulkWrite(operations, { ordered: false });
  }
}
