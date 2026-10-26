import { describe, expect, it } from "vitest";
import { LAYOUTS } from "../data/layouts";
import { TINY } from "./fixtures";
import { EYE_HEIGHT_M, floorHeight, measure, parseLayout } from "./geometry";

const seat = (model: ReturnType<typeof parseLayout>, id: string) => {
  const s = model.seats.find((x) => x.id === id);
  if (!s) throw new Error(`no seat ${id}`);
  return s;
};

describe("parseLayout", () => {
  it("counts seats and numbers them left to right, skipping aisles", () => {
    const m = parseLayout(TINY);
    expect(m.seats).toHaveLength(12);
    expect(m.seats.filter((s) => s.rowLabel === "A").map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("marks seats beside an aisle or row end as aisle seats", () => {
    const m = parseLayout(TINY);
    expect(m.seats.filter((s) => s.row === 0 && s.aisle).map((s) => s.id)).toEqual(["A1", "A3", "A4", "A6"]);
  });

  it("puts seats on either side of an aisle in different blocks", () => {
    const m = parseLayout(TINY);
    expect(seat(m, "A3").block).not.toBe(seat(m, "A4").block);
    expect(seat(m, "A1").block).toBe(seat(m, "A3").block);
  });

  it("parses wheelchair spaces", () => {
    const m = parseLayout({ ...TINY, rows: [{ label: "A", seats: "xw|wx" }] });
    expect(m.seats.map((s) => s.kind)).toEqual(["standard", "wheelchair", "wheelchair", "standard"]);
  });

  it("centers every row on the screen", () => {
    const m = parseLayout(TINY);
    expect(seat(m, "A1").xM).toBeCloseTo(-seat(m, "A6").xM);
  });
});

describe("positional numbering", () => {
  const layout = {
    ...TINY,
    numbering: "positional" as const,
    rows: [
      { label: "A", seats: ".x|ww..xx|x." },
      { label: "B", seats: "xx|xxxxxx|.w", gapBeforeM: 1, stepM: 0.3 },
    ],
  };
  const m = parseLayout(layout);

  it("counts gaps and wheelchair columns toward printed seat numbers", () => {
    expect(m.seats.filter((s) => s.row === 0).map((s) => s.id)).toEqual(["A2", "W1", "W2", "A7", "A8", "A9"]);
  });

  it("numbers wheelchair spaces W1, W2… across the whole hall", () => {
    expect(m.seats.filter((s) => s.kind === "wheelchair").map((s) => s.id)).toEqual(["W1", "W2", "W3"]);
  });

  it("adds a row's cross-aisle gap and extra step to it and every row behind", () => {
    expect(m.rows[1].dM).toBeCloseTo(TINY.firstRowM + TINY.rowSpacingM + 1);
    expect(m.rows[1].floorM - floorHeight(TINY.rake!, 1)).toBeCloseTo(0.3);
  });
});

describe("floorHeight", () => {
  it("uses the front slope, then adds one riser per row", () => {
    const rake = { frontRows: 2, frontSlopeM: 0.05, riserM: 0.4 };
    expect(floorHeight(rake, 0)).toBeCloseTo(0);
    expect(floorHeight(rake, 1)).toBeCloseTo(0.05);
    expect(floorHeight(rake, 2)).toBeCloseTo(0.5);
    expect(floorHeight(rake, 3)).toBeCloseTo(0.9);
  });
});

describe("measure", () => {
  it("computes field of view as 2·atan(W / 2d)", () => {
    const m = parseLayout(TINY);
    // Screen half-width 4 m at 4 m distance: 2 × 45° = 90°.
    expect(measure(seat(m, "A1"), m).fov).toBeCloseTo(90);
  });

  it("computes the upward angle to screen center from seated eye height", () => {
    const m = parseLayout(TINY);
    const centerM = TINY.screen.bottomM + TINY.screen.heightM / 2;
    const want = (Math.atan((centerM - EYE_HEIGHT_M) / 4) * 180) / Math.PI;
    expect(measure(seat(m, "A1"), m).lookUp).toBeCloseTo(want);
  });

  it("has no C-value in the front row and a clear view behind a riser", () => {
    const m = parseLayout(TINY);
    expect(measure(seat(m, "A2"), m).cValue).toBeNull();
    expect(measure(seat(m, "B2"), m).cValue).toBeGreaterThan(0.12);
  });

  it("gives the arthouse room's flat floor poor clearance", () => {
    const art = LAYOUTS.find((l) => l.id === "arthouse")!;
    const m = parseLayout(art);
    const c = measure(seat(m, "F3"), m).cValue!;
    expect(c).toBeLessThan(0.12);
  });
});

describe("sample layouts", () => {
  it.each(LAYOUTS.map((l) => [l.id, l] as const))("%s has rows of equal width and only known characters", (_id, layout) => {
    const widths = new Set(layout.rows.map((r) => r.seats.length));
    expect(widths.size).toBe(1);
    for (const r of layout.rows) expect(r.seats).toMatch(/^[xw|.]+$/);
  });
});
