import { useState } from 'preact/hooks';
import type { Deck } from '../../shared/types';

const INITIAL = 8;

export function DeckList({ decks }: { decks: Deck[] }) {
  const [expanded, setExpanded] = useState(false);
  if (decks.length === 0) return <p class="muted small">No decklists posted yet.</p>;

  const shown = expanded ? decks : decks.slice(0, INITIAL);
  return (
    <>
      <ol class="decks">
        {shown.map((d) => (
          <li key={d.id} class="deck">
            <span class="rank">{d.rank}</span>
            <a class="deck-name" href={d.url} target="_blank" rel="noopener noreferrer">
              {d.name}
            </a>
            {d.player && <span class="player">{d.player}</span>}
          </li>
        ))}
      </ol>
      {decks.length > INITIAL && (
        <button class="link-button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show top 8 only' : `Show all ${decks.length} decks`}
        </button>
      )}
    </>
  );
}
