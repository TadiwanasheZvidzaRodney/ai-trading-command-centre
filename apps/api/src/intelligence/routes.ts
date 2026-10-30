import type { CalendarService } from '@atc/economic-calendar';
import type { NewsService } from '@atc/news';
import { calendarQuerySchema, newsQuerySchema, nowIso } from '@atc/shared';
import type { FastifyInstance } from 'fastify';

export async function registerIntelligenceRoutes(
  app: FastifyInstance,
  options: { news: NewsService; calendar: CalendarService },
): Promise<void> {
  const { news, calendar } = options;

  app.get('/api/v1/news', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const query = newsQuerySchema.parse(request.query);
    const feed = await news.getNews(query);
    return { ...feed, timestamp: nowIso() };
  });

  app.post('/api/v1/news/refresh', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    const feed = await news.getNews({ force: true });
    return { ...feed, timestamp: nowIso() };
  });

  app.get('/api/v1/calendar', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const query = calendarQuerySchema.parse(request.query);
    const feed = await calendar.getCalendar(query);
    return { ...feed, timestamp: nowIso() };
  });

  app.post('/api/v1/calendar/refresh', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    const feed = await calendar.getCalendar({ force: true });
    return { ...feed, timestamp: nowIso() };
  });
}
