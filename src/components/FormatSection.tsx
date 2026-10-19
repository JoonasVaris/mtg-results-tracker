import { useEffect, useState } from 'preact/hooks';
import type { EventSummary } from '../../shared/types';
import { fetchEvents } from '../lib/api';
import { eventKey, hasSeenAny, isCollapsed, loadSeen, markSeen, setCollapsed } from '../lib/storage';
import { EventCard } from './EventCard';

const PAGE = 10;

interface Props {
  source: string;
  formatId: string;
  name: string;
  /** Bump to force a refetch, bypassing the local cache. */
  refreshToken: number;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; events: EventSummary[]; newIds: Set<string> }
  | { status: 'error'; message: string };

/**
 * Decides which events get a "New" label: those whose id this device has
 * not scrolled past before. The very first load of a format records every
 * event as seen, so a fresh install does not show 20 "New" labels.
 */
function findNew(source: string, formatId: string, events: EventSummary[]): Set<string> {
  const keys = events.map((e) => eventKey(source, formatId, e.id));
  if (!hasSeenAny(source, formatId)) {
    markSeen(keys);
    return new Set();
  }
  const seen = loadSeen();
  return new Set(events.filter((_, i) => !seen.has(keys[i])).map((e) => e.id));
}

export function FormatSection({ source, formatId, name, refreshToken }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [visible, setVisible] = useState(PAGE);
  const collapseKey = `${source}:${formatId}`;
  const [open, setOpen] = useState(() => !isCollapsed(collapseKey));

  const toggle = () => {
    setCollapsed(collapseKey, open);
    setOpen(!open);
  };

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchEvents(source, formatId, refreshToken > 0)
      .then((events) => {
        if (cancelled) return;
        setState({ status: 'ready', events, newIds: findNew(source, formatId, events) });
      })
      .catch((err: Error) => !cancelled && setState({ status: 'error', message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [source, formatId, refreshToken]);

  const newCount = state.status === 'ready' ? state.newIds.size : 0;
  const bodyId = `format-body-${source}-${formatId}`;

  return (
    <section class={`format ${open ? 'open' : 'closed'}`} id={`format-${source}-${formatId}`}>
      <h2 class="format-title">
        <button class="format-toggle" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          <span class="format-name">
            {name}
            {newCount > 0 && <span class="badge-new">{newCount} new</span>}
          </span>
          <span class="chevron" aria-hidden="true" />
        </button>
      </h2>

      {open && (
        <div id={bodyId}>
      {state.status === 'loading' && (
        <>
          <div class="skeleton" aria-busy="true" />
          <div class="skeleton" aria-busy="true" />
        </>
      )}
      {state.status === 'error' && <p class="error">Couldn't load events: {state.message}</p>}
      {state.status === 'ready' && state.events.length === 0 && <p class="muted">No recent events.</p>}
      {state.status === 'ready' &&
        state.events
          .slice(0, visible)
          .map((ev) => <EventCard key={ev.id} summary={ev} isNew={state.newIds.has(ev.id)} />)}
      {state.status === 'ready' && state.events.length > visible && (
        <button class="secondary wide" onClick={() => setVisible(visible + PAGE)}>
          Show more ({state.events.length - visible} older)
        </button>
      )}
        </div>
      )}
    </section>
  );
}
