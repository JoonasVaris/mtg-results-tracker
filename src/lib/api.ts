import type { EventDetail, EventSummary, Format } from '../../shared/types';
import { cacheGet, cacheSet } from './storage';
import { createQueue } from './queue';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const eventQueue = createQueue(4);

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/${path}?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `HTTP ${res.status}`, res.status);
  return body as T;
}

export async function fetchFormats(source: string): Promise<Format[]> {
  const key = `formats:${source}`;
  const cached = cacheGet<Format[]>(key, DAY);
  if (cached) return cached;
  const formats = await getJson<Format[]>('formats', { source });
  cacheSet(key, formats);
  return formats;
}

export async function fetchEvents(source: string, formatId: string, force = false): Promise<EventSummary[]> {
  const key = `events:${source}:${formatId}`;
  if (!force) {
    const cached = cacheGet<EventSummary[]>(key, 15 * MINUTE);
    if (cached) return cached;
  }
  const events = await getJson<EventSummary[]>('events', { source, format: formatId });
  cacheSet(key, events);
  return events;
}

/** Recent events may still receive decklists, so cache them for less time. */
function detailTtl(summary: EventSummary): number {
  const ageMs = Date.now() - new Date(summary.date).getTime();
  return ageMs < 3 * DAY ? HOUR : 3 * DAY;
}

export async function fetchEvent(summary: EventSummary, force = false): Promise<EventDetail> {
  const key = `event:${summary.source}:${summary.formatId}:${summary.id}`;
  if (!force) {
    const cached = cacheGet<EventDetail>(key, detailTtl(summary));
    if (cached) return cached;
  }
  const detail = await eventQueue(() =>
    getJson<EventDetail>('event', { source: summary.source, format: summary.formatId, id: summary.id }),
  );
  cacheSet(key, detail);
  return detail;
}
