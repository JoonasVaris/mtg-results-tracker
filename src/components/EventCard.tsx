import { useEffect, useRef, useState } from 'preact/hooks';
import type { EventDetail, EventSummary } from '../../shared/types';
import { fetchEvent } from '../lib/api';
import { formatDate } from '../lib/format';
import { eventKey, isCollapsed, markSeen, setCollapsed } from '../lib/storage';
import { DeckList } from './DeckList';

type State = { status: 'loading' } | { status: 'ready'; detail: EventDetail } | { status: 'error'; message: string };

/** How long the card must stay on screen before it counts as seen. */
const SEEN_AFTER_MS = 1500;

interface Props {
  summary: EventSummary;
  /** Not seen on this device when the list was loaded. */
  isNew: boolean;
}

export function EventCard({ summary, isNew }: Props) {
  const key = eventKey(summary.source, summary.formatId, summary.id);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(() => !isCollapsed(key));
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchEvent(summary, attempt > 0)
      .then((detail) => !cancelled && setState({ status: 'ready', detail }))
      .catch((err: Error) => !cancelled && setState({ status: 'error', message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [summary.source, summary.formatId, summary.id, attempt]);

  // Mark as seen once the card has been on screen for a moment.
  useEffect(() => {
    const el = ref.current;
    if (!isNew || !el || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            markSeen([key]);
            observer.disconnect();
          }, SEEN_AFTER_MS);
        } else if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [key, isNew]);

  const toggle = () => {
    setCollapsed(key, open);
    setOpen(!open);
  };

  const detail = state.status === 'ready' ? state.detail : undefined;
  const players = detail?.players;
  const bodyId = `event-body-${summary.source}-${summary.formatId}-${summary.id}`;

  return (
    <article class={`event ${open ? 'open' : 'closed'} ${isNew ? 'is-new' : ''}`} ref={ref}>
      <header class="event-header">
        <button class="event-toggle" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          <time class="event-date" dateTime={summary.date}>
            {formatDate(summary.date)}
          </time>
          <span class="event-name">
            {summary.name}
            {players != null && (
              <span class="players" title={`${players} players`}>
                ({players})
              </span>
            )}
            {isNew && <span class="badge-new">New</span>}
          </span>
          {summary.location && <span class="event-location">{summary.location}</span>}
          <span class="chevron" aria-hidden="true" />
        </button>
      </header>

      {open && (
        <div id={bodyId} class="event-body">
          {state.status === 'loading' && <div class="skeleton" aria-busy="true" />}
          {state.status === 'error' && (
            <p class="error small">
              Couldn't load decklists ({state.message}).{' '}
              <button class="link-button" onClick={() => setAttempt(attempt + 1)}>
                Retry
              </button>
            </p>
          )}
          {detail && <DeckList decks={detail.decks} />}
        </div>
      )}
    </article>
  );
}
