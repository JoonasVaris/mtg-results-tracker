/** Thin, failure-tolerant wrappers over localStorage. */

const SUBS_KEY = 'mtgres:subscriptions:v1';
const CACHE_PREFIX = 'mtgres:cache:v1:';

/** Subscription key: `${source}:${formatId}`. */
export type SubscriptionKey = string;

export function subscriptionKey(source: string, formatId: string): SubscriptionKey {
  return `${source}:${formatId}`;
}

export function splitSubscription(key: SubscriptionKey): { source: string; formatId: string } {
  const i = key.indexOf(':');
  return { source: key.slice(0, i), formatId: key.slice(i + 1) };
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled: silently degrade */
  }
}

export function loadSubscriptions(): SubscriptionKey[] {
  const subs = read<SubscriptionKey[]>(SUBS_KEY);
  return Array.isArray(subs) ? subs.filter((s) => typeof s === 'string' && s.includes(':')) : [];
}

export function saveSubscriptions(subs: SubscriptionKey[]): void {
  write(SUBS_KEY, subs);
}

interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

export function cacheGet<T>(key: string, maxAgeMs: number): T | undefined {
  const entry = read<CacheEntry<T>>(CACHE_PREFIX + key);
  if (!entry || typeof entry.savedAt !== 'number') return undefined;
  return Date.now() - entry.savedAt <= maxAgeMs ? entry.value : undefined;
}

export function cacheSet<T>(key: string, value: T): void {
  write(CACHE_PREFIX + key, { savedAt: Date.now(), value } satisfies CacheEntry<T>);
}

export function cacheClear(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/* ---------- keyed sets with timestamps (seen events, collapsed events) ---------- */

const SEEN_KEY = 'mtgres:seen:v1';
const COLLAPSED_KEY = 'mtgres:collapsed:v1';
const PRUNE_AFTER_MS = 120 * 24 * 60 * 60 * 1000;

type KeyedSet = Record<string, number>;

export function eventKey(source: string, formatId: string, eventId: string): string {
  return `${source}:${formatId}:${eventId}`;
}

function readSet(storageKey: string): KeyedSet {
  const set = read<KeyedSet>(storageKey);
  return set && typeof set === 'object' ? set : {};
}

function writeSet(storageKey: string, set: KeyedSet): void {
  const cutoff = Date.now() - PRUNE_AFTER_MS;
  for (const k of Object.keys(set)) if (set[k] < cutoff) delete set[k];
  write(storageKey, set);
}

/** Ids of events this device has already scrolled past, keyed by eventKey(). */
export function loadSeen(): Set<string> {
  return new Set(Object.keys(readSet(SEEN_KEY)));
}

export function markSeen(keys: string[]): void {
  if (keys.length === 0) return;
  const set = readSet(SEEN_KEY);
  const now = Date.now();
  for (const k of keys) set[k] = now;
  writeSet(SEEN_KEY, set);
}

/** True when this device has never recorded any event for the format. */
export function hasSeenAny(source: string, formatId: string): boolean {
  const prefix = `${source}:${formatId}:`;
  return Object.keys(readSet(SEEN_KEY)).some((k) => k.startsWith(prefix));
}

export function isCollapsed(key: string): boolean {
  return key in readSet(COLLAPSED_KEY);
}

export function setCollapsed(key: string, collapsed: boolean): void {
  const set = readSet(COLLAPSED_KEY);
  if (collapsed) set[key] = Date.now();
  else delete set[key];
  writeSet(COLLAPSED_KEY, set);
}
