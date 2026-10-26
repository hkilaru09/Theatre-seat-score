import { vi } from "vitest";
import type { Cinema, CinemaIndex } from "../lib/cinemas";

// A tiny stand-in for public/cinemas/, served through a stubbed fetch.
export const INDEX: CinemaIndex = {
  source: "test",
  cinemas: 4,
  withSeats: 0,
  withScreens: 2,
  countries: [
    { code: "US", name: "United States of America", count: 2 },
    { code: "KR", name: "South Korea", count: 2 },
  ],
};

export const COUNTRIES: Record<string, Cinema[]> = {
  US: [
    { id: "n1", name: "AMC Lincoln Square 13", city: "New York", brand: "AMC", screens: 13, lat: 40.775, lon: -73.982 },
    { id: "n2", name: "Alamo Drafthouse Downtown Brooklyn", city: "Brooklyn", screens: 7, lat: 40.691, lon: -73.983 },
  ],
  KR: [
    { id: "n3046816856", name: "시네마테크 KOFA", lat: 37.58, lon: 126.89 },
    { id: "w9", name: "CGV Yongsan", lat: 37.53, lon: 126.96 },
  ],
};

export function stubCinemaData(locale = "en-US") {
  vi.stubGlobal("navigator", { ...navigator, language: locale });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const file = String(url).split("/").pop()!;
      const body = file === "index.json" ? INDEX : COUNTRIES[file.replace(".json", "")];
      return body ? new Response(JSON.stringify(body)) : new Response("missing", { status: 404 });
    })
  );
}
