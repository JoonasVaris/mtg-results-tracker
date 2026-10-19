import { useEffect, useState } from 'preact/hooks';
import type { Format } from '../../shared/types';
import { fetchFormats } from '../lib/api';
import { subscriptionKey, type SubscriptionKey } from '../lib/storage';

interface Props {
  sources: Array<{ id: string; name: string }>;
  selected: SubscriptionKey[];
  onChange(next: SubscriptionKey[]): void;
  onDone(): void;
  onClearCache(): void;
}

export function FormatPicker({ sources, selected, onChange, onDone, onClearCache }: Props) {
  const [formats, setFormats] = useState<Record<string, Format[] | Error>>({});

  useEffect(() => {
    sources.forEach((s) =>
      fetchFormats(s.id)
        .then((list) => setFormats((f) => ({ ...f, [s.id]: list })))
        .catch((err: Error) => setFormats((f) => ({ ...f, [s.id]: err }))),
    );
  }, [sources.map((s) => s.id).join(',')]);

  const toggle = (key: SubscriptionKey) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <section class="picker">
      <p class="muted">
        Choose the formats you follow. Your choice is stored only on this device.
      </p>

      {sources.map((s) => {
        const list = formats[s.id];
        return (
          <fieldset key={s.id} class="source-group">
            <legend>{s.name}</legend>
            {!list && <div class="skeleton" aria-busy="true" />}
            {list instanceof Error && <p class="error">Couldn't load formats: {list.message}</p>}
            {Array.isArray(list) &&
              list.map((f) => {
                const key = subscriptionKey(s.id, f.id);
                const checked = selected.includes(key);
                return (
                  <label key={key} class={`choice ${checked ? 'checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(key)} />
                    <span>{f.name}</span>
                  </label>
                );
              })}
          </fieldset>
        );
      })}

      <div class="actions">
        <button class="primary wide" disabled={selected.length === 0} onClick={onDone}>
          {selected.length === 0 ? 'Pick at least one format' : `Show ${selected.length} format${selected.length > 1 ? 's' : ''}`}
        </button>
        <button class="link-button" onClick={onClearCache}>
          Clear cached results
        </button>
      </div>
    </section>
  );
}
