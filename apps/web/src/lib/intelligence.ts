import type { CalendarFeed, NewsFeed } from '@atc/shared';
import { api } from './api';

export async function refreshNews(): Promise<NewsFeed> {
  return api.post<NewsFeed>('/api/v1/news/refresh', {});
}

export async function refreshCalendar(): Promise<CalendarFeed> {
  return api.post<CalendarFeed>('/api/v1/calendar/refresh', {});
}
