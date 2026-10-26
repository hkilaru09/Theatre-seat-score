// The worldwide cinema directory built by data/pipeline/osm.py: public/cinemas/index.json
// lists the countries, and each country's cinemas live in public/cinemas/<code>.json.

export interface Cinema {
  id: string; // OpenStreetMap element: n = node, w = way, r = relation
  name: string;
  lat: number;
  lon: number;
  city?: string;
  website?: string;
  brand?: string;
  screens?: number;
  seats?: number;
  wikidata?: string;
}

export interface Country {
  code: string;
  name: string;
  count: number;
}

export interface CinemaIndex {
  source: string;
  cinemas: number;
  withSeats: number;
  withScreens: number;
  countries: Country[];
}

// Cinemas whose real seat plans are in the explorer, by OpenStreetMap id.
export const REAL_LAYOUTS: Record<string, string[]> = {
  n3046816856: ["kofa1", "kofa2"], // Cinematheque KOFA, Seoul
};

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}cinemas/${file}`;

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(dataUrl(file));
  if (!res.ok) throw new Error(`Couldn't load ${file} (${res.status})`);
  return res.json() as Promise<T>;
}

export const fetchIndex = () => getJson<CinemaIndex>("index.json");
export const fetchCountry = (code: string) => getJson<Cinema[]>(`${code}.json`);

export function osmUrl(c: Cinema): string {
  const type = { n: "node", w: "way", r: "relation" }[c.id[0]] ?? "node";
  return `https://www.openstreetmap.org/${type}/${c.id.slice(1)}`;
}

/** The region in a locale such as "en-US", if the index has that country. */
export function defaultCountry(countries: Country[], locale = globalThis.navigator?.language ?? ""): string {
  const region = locale.split("-").slice(1).find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();
  if (region && countries.some((c) => c.code === region)) return region;
  return countries.some((c) => c.code === "US") ? "US" : (countries[0]?.code ?? "");
}

const cityKey = (c: Cinema) => c.city ?? "\uffff";
const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/**
 * Cinemas matching every word of the query in their name, city or brand.
 * Names that start with the query rank first, then other name matches, then the rest;
 * ties sort by city (cinemas with no city last) and name.
 */
export function searchCinemas(cinemas: Cinema[], query: string, limit = 50): { total: number; results: Cinema[] } {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const scored: { c: Cinema; rank: number }[] = [];
  for (const c of cinemas) {
    const name = fold(c.name);
    const text = `${name} ${fold(c.city ?? "")} ${fold(c.brand ?? "")}`;
    if (!words.every((w) => text.includes(w))) continue;
    const q = words.join(" ");
    const rank = !q ? 2 : name.startsWith(q) ? 0 : words.every((w) => name.includes(w)) ? 1 : 2;
    scored.push({ c, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || cityKey(a.c).localeCompare(cityKey(b.c)) || a.c.name.localeCompare(b.c.name));
  return { total: scored.length, results: scored.slice(0, limit).map((s) => s.c) };
}
