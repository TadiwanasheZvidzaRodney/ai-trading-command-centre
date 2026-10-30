import { canonicalUrl, type CalendarEvent, type NewsItem } from '@atc/shared';
import type { CalendarStore } from '@atc/economic-calendar';
import type { NewsStore } from '@atc/news';
import type { AnyBulkWriteOperation, Collection, Db } from 'mongodb';

interface NewsDocument extends NewsItem {
  canonicalUrl: string;
}

type CalendarDocument = CalendarEvent;

export class MongoNewsStore implements NewsStore {
  private readonly db: Db | null;

  constructor(db: Db | null) {
    this.db = db;
  }

  private get collection(): Collection<NewsDocument> {
    if (!this.db) throw new Error('MongoDB is not connected');
    return this.db.collection<NewsDocument>('news_items');
  }

  async save(items: NewsItem[]): Promise<void> {
    if (!this.db || items.length === 0) return;
    const operations: AnyBulkWriteOperation<NewsDocument>[] = items.map((item) => {
      const url = canonicalUrl(item.url);
      return {
        updateOne: {
          filter: { canonicalUrl: url },
          update: { $set: { ...item, url, canonicalUrl: url } },
          upsert: true,
        },
      };
    });
    await this.collection.bulkWrite(operations);
  }
}

export class MongoCalendarStore implements CalendarStore {
  private readonly db: Db | null;

  constructor(db: Db | null) {
    this.db = db;
  }

  private get collection(): Collection<CalendarDocument> {
    if (!this.db) throw new Error('MongoDB is not connected');
    return this.db.collection<CalendarDocument>('calendar_events');
  }

  async save(events: CalendarEvent[]): Promise<void> {
    if (!this.db || events.length === 0) return;
    const operations: AnyBulkWriteOperation<CalendarDocument>[] = events.map((event) => ({
      updateOne: {
        filter: { source: event.source, externalId: event.externalId },
        update: { $set: event },
        upsert: true,
      },
    }));
    await this.collection.bulkWrite(operations);
  }
}
