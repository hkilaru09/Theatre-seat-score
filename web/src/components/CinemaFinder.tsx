// Leaflet's stylesheet ships with the page so the map never lays out before its CSS arrives.
import "leaflet/dist/leaflet.css";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { Layout } from "../engine";
import { REAL_LAYOUTS, defaultCountry, fetchCountry, fetchIndex, osmUrl, searchCinemas, type Cinema, type CinemaIndex } from "../lib/cinemas";

// Leaflet touches the DOM on import, so the map loads on its own.
const CinemaMap = lazy(() => import("./CinemaMap").then((m) => ({ default: m.CinemaMap })));

const LIST_LIMIT = 50;

interface Props {
  layouts: Layout[];
  onOpenLayout: (index: number) => void;
}

export function CinemaFinder({ layouts, onOpenLayout }: Props) {
  const [index, setIndex] = useState<CinemaIndex | null>(null);
  const [country, setCountry] = useState("");
  const [cinemas, setCinemas] = useState<Cinema[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Cinema | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIndex()
      .then((idx) => {
        setIndex(idx);
        setCountry(defaultCountry(idx.countries));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!country) return;
    let live = true;
    fetchCountry(country)
      .then((list) => live && setCinemas(list))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [country]);

  const changeCountry = (code: string) => {
    setCountry(code);
    setCinemas(null);
    setSelected(null);
  };

  const matches = useMemo(() => (cinemas ? searchCinemas(cinemas, query, Infinity).results : []), [cinemas, query]);
  const countries = useMemo(() => [...(index?.countries ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [index]);
  const real = selected ? (REAL_LAYOUTS[selected.id] ?? []).map((id) => layouts.findIndex((L) => L.id === id)).filter((i) => i >= 0) : [];

  return (
    <section className="panel finder" aria-labelledby="finder-title">
      <div className="panel-head">
        <h2 id="finder-title">Find your cinema</h2>
        {index && (
          <span className="eyebrow">
            {index.cinemas.toLocaleString("en-US")} cinemas in {index.countries.length} countries
          </span>
        )}
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="finder-controls">
        <label>
          Country
          <select value={country} onChange={(e) => changeCountry(e.target.value)} disabled={!index}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.count.toLocaleString("en-US")})
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input type="search" value={query} placeholder="Cinema, city or chain" onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="finder-body">
        <div className="finder-list">
          <p className="finder-count" aria-live="polite">
            {cinemas ? `${matches.length.toLocaleString("en-US")} ${matches.length === 1 ? "cinema" : "cinemas"}` : "Loading…"}
            {matches.length > LIST_LIMIT && ` · showing the first ${LIST_LIMIT}`}
          </p>
          <ul aria-label="Matching cinemas">
            {matches.slice(0, LIST_LIMIT).map((c) => (
              <li key={c.id}>
                <button type="button" className="cinema-row" aria-pressed={c.id === selected?.id} onClick={() => setSelected(c)}>
                  <strong>{c.name}</strong>
                  <span>{[c.city, c.brand !== c.name ? c.brand : null].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="finder-side">
          <Suspense fallback={<div className="cinema-map" />}>
            <CinemaMap cinemas={matches} selected={selected} onSelect={setSelected} />
          </Suspense>

          {selected && (
            <div className="cinema-card" aria-label="Selected cinema">
              <h3>{selected.name}</h3>
              <p className="muted">
                {[selected.city, selected.screens && `${selected.screens} ${selected.screens === 1 ? "screen" : "screens"}`, selected.seats && `${selected.seats.toLocaleString("en-US")} seats`]
                  .filter(Boolean)
                  .join(" · ") || "No screen or seat count on record"}
              </p>
              {real.length > 0 ? (
                <p>
                  Real seat plan available:{" "}
                  {real.map((i) => (
                    <button key={i} type="button" className="btn link" onClick={() => onOpenLayout(i)}>
                      {layouts[i].name}
                    </button>
                  ))}
                </p>
              ) : (
                <p className="muted">No seat plan for this cinema yet. The explorer below uses sample theaters.</p>
              )}
              <p className="cinema-links">
                {selected.website && (
                  <a href={selected.website} target="_blank" rel="noreferrer">
                    Website
                  </a>
                )}
                <a href={osmUrl(selected)} target="_blank" rel="noreferrer">
                  OpenStreetMap
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="finder-credit">
        Cinema data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL. Countries from Natural Earth.
      </p>
    </section>
  );
}
