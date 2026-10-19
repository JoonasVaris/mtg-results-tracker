import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Format } from '../shared/types';
import { fetchFormats } from './lib/api';
import { cacheClear, loadSubscriptions, saveSubscriptions, splitSubscription, type SubscriptionKey } from './lib/storage';
import { FormatPicker } from './components/FormatPicker';
import { FormatSection } from './components/FormatSection';

/** Sources the UI knows about. Mirrors shared/sources but kept static so the
 *  frontend can render before any network call succeeds. */
const SOURCES = [{ id: 'mtgtop8', name: 'MTGTop8', homepage: 'https://www.mtgtop8.com' }];

type View = 'home' | 'settings';

export function App() {
  const [subs, setSubs] = useState<SubscriptionKey[]>(() => loadSubscriptions());
  const [view, setView] = useState<View>(() => (loadSubscriptions().length ? 'home' : 'settings'));
  const [refreshToken, setRefreshToken] = useState(0);
  const [formatNames, setFormatNames] = useState<Record<string, string>>({});

  useEffect(() => saveSubscriptions(subs), [subs]);

  // Resolve human readable names for section headers.
  useEffect(() => {
    SOURCES.forEach((s) =>
      fetchFormats(s.id)
        .then((list: Format[]) =>
          setFormatNames((n) => ({ ...n, ...Object.fromEntries(list.map((f) => [`${s.id}:${f.id}`, f.name])) })),
        )
        .catch(() => {}),
    );
  }, []);

  const sections = useMemo(
    () =>
      subs.map((key) => {
        const { source, formatId } = splitSubscription(key);
        return { key, source, formatId, name: formatNames[key] ?? formatId };
      }),
    [subs, formatNames],
  );

  const clearCache = () => {
    cacheClear();
    setRefreshToken((t) => t + 1);
  };

  return (
    <div class="container">
      <header class="topbar">
        <h1 class="brand">
          <button class="plain" onClick={() => setView('home')} disabled={subs.length === 0}>
            MTG Tournament Results
          </button>
        </h1>
        <div class="topbar-actions">
          {view === 'home' && (
            <button class="icon" title="Refresh" aria-label="Refresh" onClick={() => setRefreshToken((t) => t + 1)}>
              ↻
            </button>
          )}
          <button
            class="icon"
            title={view === 'home' ? 'Formats' : 'Back'}
            aria-label={view === 'home' ? 'Choose formats' : 'Back to results'}
            onClick={() => setView(view === 'home' ? 'settings' : 'home')}
            disabled={view === 'settings' && subs.length === 0}
          >
            {view === 'home' ? '⚙' : '←'}
          </button>
        </div>
      </header>

      <main class={view === 'home' ? 'formats' : ''} data-count={view === 'home' ? sections.length : undefined}>
        {view === 'settings' ? (
          <FormatPicker
            sources={SOURCES}
            selected={subs}
            onChange={setSubs}
            onDone={() => setView('home')}
            onClearCache={clearCache}
          />
        ) : (
          sections.map((s) => (
            <FormatSection key={s.key} source={s.source} formatId={s.formatId} name={s.name} refreshToken={refreshToken} />
          ))
        )}
      </main>

      <footer class="muted small">
        Data from{' '}
        {SOURCES.map((s, i) => (
          <span key={s.id}>
            {i > 0 && ', '}
            <a href={s.homepage} target="_blank" rel="noopener noreferrer">
              {s.name}
            </a>
          </span>
        ))}
        . Decklists open on the source site.
      </footer>
    </div>
  );
}
