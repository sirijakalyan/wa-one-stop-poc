import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { WA_PLACES } from '../data/wa-places.js';

// Suggestions for a typed city: names that start with the text first, then names with a word that starts with it.
export function matchPlaces(text, limit = 8) {
  const q = String(text || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = [];
  const words = [];
  for (const [name, county] of WA_PLACES) {
    const n = name.toLowerCase();
    if (n.startsWith(q)) starts.push({ name, county });
    else if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) words.push({ name, county });
  }
  return [...starts, ...words].slice(0, limit);
}

// Exact place name typed without picking from the list: fill the county only when exactly one county matches.
export function countyForTypedCity(text) {
  const q = String(text || '').trim().toLowerCase();
  const hits = WA_PLACES.filter(([n]) => n.toLowerCase() === q);
  return hits.length === 1 ? hits[0][1] : '';
}

// City box with suggestions. Choosing a suggestion also fills the county. Both boxes stay editable.
export default function CityCombobox({ id, value, onChange, onPick, placeholder }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef(null);
  const options = useMemo(() => matchPlaces(value), [value]);
  const show = open && options.length > 0;

  useEffect(() => {
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  function pick(o) {
    onPick(o);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && show && active >= 0) { e.preventDefault(); pick(options[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="combo" ref={wrap}>
      <input
        type="text" id={id} autoComplete="off" role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        value={value} placeholder={placeholder} maxLength={80}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
      />
      {show && (
        <ul className="combo-list" role="listbox" id={listId}>
          {options.map((o, i) => (
            <li
              key={`${o.name}-${o.county}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
            >
              <strong>{o.name}</strong><span>{o.county} County</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
