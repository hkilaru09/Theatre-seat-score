import { describe, expect, it } from "vitest";
import { defaultCountry, osmUrl, searchCinemas, type Cinema } from "./cinemas";

const c = (id: string, name: string, city?: string, brand?: string): Cinema => ({ id, name, city, brand, lat: 0, lon: 0 });
const LIST = [
  c("n1", "Ciné Lumière", "Lyon"),
  c("n2", "Pathé Bellecour", "Lyon", "Pathé"),
  c("w3", "Le Grand Rex", "Paris"),
  c("n4", "Pathé Wepler", "Paris", "Pathé"),
  c("r5", "Studio Lumière", "Angers"),
  c("n6", "Ciné Nomade"),
];
const names = (q: string) => searchCinemas(LIST, q).results.map((x) => x.name);

describe("searchCinemas", () => {
  it("lists everything by city then name for an empty query", () => {
    expect(names("")).toEqual(["Studio Lumière", "Ciné Lumière", "Pathé Bellecour", "Le Grand Rex", "Pathé Wepler", "Ciné Nomade"]);
  });

  it("ignores accents and case, and ranks names that start with the query first", () => {
    expect(names("LUMIERE")).toEqual(["Studio Lumière", "Ciné Lumière"]);
    expect(names("cine")).toEqual(["Ciné Lumière", "Ciné Nomade"]);
  });

  it("needs every word, matched across name, city and brand", () => {
    expect(names("pathe paris")).toEqual(["Pathé Wepler"]);
    expect(names("rex lyon")).toEqual([]);
  });

  it("counts every match but returns at most the limit", () => {
    const { total, results } = searchCinemas(LIST, "", 2);
    expect(total).toBe(6);
    expect(results).toHaveLength(2);
  });
});

describe("defaultCountry", () => {
  const countries = [
    { code: "FR", name: "France", count: 2 },
    { code: "US", name: "United States of America", count: 5 },
  ];

  it("uses the locale's region when the index has it", () => {
    expect(defaultCountry(countries, "fr-FR")).toBe("FR");
    expect(defaultCountry(countries, "zh-Hant-FR")).toBe("FR");
  });

  it("falls back to the US, then to the first country", () => {
    expect(defaultCountry(countries, "ko-KR")).toBe("US");
    expect(defaultCountry(countries, "en")).toBe("US");
    expect(defaultCountry([countries[0]], "ko-KR")).toBe("FR");
  });
});

it("links each element type to its OpenStreetMap page", () => {
  expect(LIST.map(osmUrl)[2]).toBe("https://www.openstreetmap.org/way/3");
  expect(osmUrl(LIST[4])).toBe("https://www.openstreetmap.org/relation/5");
});
