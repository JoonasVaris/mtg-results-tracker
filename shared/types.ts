/** A constructed/limited format as known by a particular source site. */
export interface Format {
  /** Source-specific id, e.g. "EDH" on mtgtop8. */
  id: string;
  /** Human readable name, e.g. "Duel Commander". */
  name: string;
  source: string;
}

export interface EventSummary {
  source: string;
  id: string;
  formatId: string;
  name: string;
  location?: string;
  /** ISO date, yyyy-mm-dd. */
  date: string;
  /** Link to the event on the source site. */
  url: string;
  /** Source-specific importance rating (mtgtop8: 0-3 stars). */
  stars?: number;
  /** Paper / MTGO / Arena / Online Other … */
  platform?: string;
}

export interface Deck {
  id: string;
  /** Finishing position as shown by the source: "1", "3-4", "5-8", … */
  rank: string;
  name: string;
  player?: string;
  url: string;
}

export interface EventDetail extends EventSummary {
  players?: number;
  decks: Deck[];
}

/** Everything the app needs from a results website. Add one per site. */
export interface Source {
  id: string;
  name: string;
  homepage: string;
  formats(): Promise<Format[]>;
  events(formatId: string): Promise<EventSummary[]>;
  event(formatId: string, eventId: string): Promise<EventDetail>;
}
