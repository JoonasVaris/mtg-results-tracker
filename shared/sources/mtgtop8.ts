import { parse, type HTMLElement } from 'node-html-parser';
import type { Deck, EventDetail, EventSummary, Format, Source } from '../types';

export const SOURCE_ID = 'mtgtop8';
const BASE = 'https://www.mtgtop8.com';

/** Format codes as used in mtgtop8's `format?f=` URLs. */
const FORMATS: ReadonlyArray<[id: string, name: string]> = [
  ['ST', 'Standard'],
  ['PI', 'Pioneer'],
  ['MO', 'Modern'],
  ['LE', 'Legacy'],
  ['VI', 'Vintage'],
  ['PAU', 'Pauper'],
  ['EDH', 'Duel Commander'],
  ['cEDH', 'cEDH'],
  ['EDHP', 'Commander Pauper'],
  ['PREM', 'Premodern'],
  ['CHL', 'Canadian Highlander'],
  ['HIGH', 'Highlander'],
  ['PEA', 'Peasant'],
  ['EXP', 'Explorer'],
  ['HI', 'Historic'],
  ['ALCH', 'Alchemy'],
  ['EX', 'Extended'],
  ['BL', 'Block'],
];

const FORMAT_IDS = new Set(FORMATS.map(([id]) => id));

export function isKnownFormat(id: string): boolean {
  return FORMAT_IDS.has(id);
}

export function eventUrl(formatId: string, eventId: string): string {
  return `${BASE}/event?e=${encodeURIComponent(eventId)}&f=${encodeURIComponent(formatId)}`;
}

export function deckUrl(formatId: string, eventId: string, deckId: string): string {
  return `${eventUrl(formatId, eventId)}&d=${encodeURIComponent(deckId)}`;
}

/** "19/10/26" -> "2026-10-19". Returns "" when the input does not match. */
export function parseDate(text: string): string {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(text);
  if (!m) return '';
  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function text(el: HTMLElement | null | undefined): string {
  return (el?.text ?? '').replace(/\s+/g, ' ').trim();
}

function queryParam(href: string, key: string): string | undefined {
  const m = new RegExp(`[?&]${key}=([^&#]+)`).exec(href);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Parses `format?f=<CODE>`: the "last major" and "last 20" event tables. */
export function parseFormatPage(html: string, formatId: string): EventSummary[] {
  const root = parse(html);
  const byId = new Map<string, EventSummary>();

  for (const row of root.querySelectorAll('tr.hover_tr')) {
    const link = row.querySelector('a[href*="event?e="]');
    if (!link) continue;
    const id = queryParam(link.getAttribute('href') ?? '', 'e');
    if (!id || byId.has(id)) continue;

    const cells = row.querySelectorAll('td');
    const nameCell = cells.find((td) => td.querySelector('a[href*="event?e="]')) ?? cells[1];
    const anchors = nameCell?.querySelectorAll('a') ?? [];
    const name = text(anchors[0]);
    const location = anchors.length > 1 ? text(anchors[anchors.length - 1]) : undefined;

    const dateCell = cells.find((td) => /\d{1,2}\/\d{1,2}\/\d{2}/.test(td.text));
    const stars = row.querySelectorAll('img[src*="star"]').length;
    const platform = row.querySelector('img[title]')?.getAttribute('title') ?? undefined;

    byId.set(id, {
      source: SOURCE_ID,
      id,
      formatId,
      name,
      location: location || undefined,
      date: parseDate(text(dateCell)),
      url: eventUrl(formatId, id),
      stars,
      platform,
    });
  }

  return [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Parses `event?e=<ID>&f=<CODE>`: header plus ranked decklists. */
export function parseEventPage(html: string, formatId: string, eventId: string): EventDetail {
  const root = parse(html);

  const title = text(root.querySelector('.event_title'));
  const at = title.indexOf(' @ ');
  const name = at >= 0 ? title.slice(0, at).trim() : title;
  const location = at >= 0 ? title.slice(at + 3).trim() : undefined;

  const meta = /(\d+)\s+players?\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(root.text);
  const dateOnly = meta ? undefined : /(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(text(root.querySelector('.meta_arch')?.parentNode as HTMLElement));
  const players = meta ? Number(meta[1]) : undefined;
  const date = parseDate(meta ? meta[2] : dateOnly?.[1] ?? '');

  const stars = root.querySelectorAll('.meta_arch img[src*="star"]').length;
  const platform = root.querySelector('.meta_arch img[title]')?.getAttribute('title') ?? undefined;

  const decks: Deck[] = [];
  const seen = new Set<string>();
  for (const row of root.querySelectorAll('div.chosen_tr, div.hover_tr')) {
    const link = row.querySelector('a[href*="d="]:not(.arrow)');
    if (!link) continue;
    const href = link.getAttribute('href') ?? '';
    const id = queryParam(href, 'd');
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const rank = text(row.querySelector('div[style*="width:42px"]')) || String(decks.length + 1);
    const deckName = text(row.querySelector('.S14 a')) || text(link);
    const player = text(row.querySelector('a.player')) || undefined;

    decks.push({ id, rank, name: deckName, player, url: deckUrl(formatId, eventId, id) });
  }

  return {
    source: SOURCE_ID,
    id: eventId,
    formatId,
    name,
    location,
    date,
    url: eventUrl(formatId, eventId),
    stars,
    platform,
    players,
    decks,
  };
}

async function fetchPage(path: string): Promise<string> {
  const res = await fetch(`${BASE}/${path}`, {
    headers: {
      'user-agent': 'mtg-results-fetcher/0.1 (personal decklist reader)',
      accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`mtgtop8 responded ${res.status} for ${path}`);
  // The site serves ISO-8859-1; decode explicitly so accents survive.
  return new TextDecoder('iso-8859-1').decode(await res.arrayBuffer());
}

export const mtgtop8: Source = {
  id: SOURCE_ID,
  name: 'MTGTop8',
  homepage: BASE,

  async formats(): Promise<Format[]> {
    return FORMATS.map(([id, name]) => ({ id, name, source: SOURCE_ID }));
  },

  async events(formatId: string): Promise<EventSummary[]> {
    if (!isKnownFormat(formatId)) throw new Error(`Unknown format "${formatId}"`);
    const html = await fetchPage(`format?f=${encodeURIComponent(formatId)}`);
    return parseFormatPage(html, formatId);
  },

  async event(formatId: string, eventId: string): Promise<EventDetail> {
    if (!isKnownFormat(formatId)) throw new Error(`Unknown format "${formatId}"`);
    if (!/^\d+$/.test(eventId)) throw new Error(`Invalid event id "${eventId}"`);
    const html = await fetchPage(`event?e=${eventId}&f=${encodeURIComponent(formatId)}`);
    return parseEventPage(html, formatId, eventId);
  },
};
