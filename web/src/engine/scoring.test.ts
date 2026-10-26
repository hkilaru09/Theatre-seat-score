import { describe, expect, it } from "vitest";
import { LAYOUTS } from "../data/layouts";
import { TINY } from "./fixtures";
import { parseLayout } from "./geometry";
import { FACTORS, PRESETS, bell, explain, ramp, scoreSeats } from "./scoring";
import type { Prefs } from "./types";

describe("ramp and bell", () => {
  it("ramp is 1 below good, 0 above bad, linear between", () => {
    expect(ramp(0, 10, 20)).toBe(1);
    expect(ramp(15, 10, 20)).toBeCloseTo(0.5);
    expect(ramp(25, 10, 20)).toBe(0);
  });

  it("bell peaks at the target and uses separate widths on each side", () => {
    expect(bell(40, 40, 10, 5)).toBe(1);
    expect(bell(30, 40, 10, 5)).toBeCloseTo(bell(45, 40, 10, 5));
  });
});

describe("scoreSeats", () => {
  it.each(LAYOUTS.map((l) => [l.id, l] as const))("keeps %s scores between 0 and 100", (_id, layout) => {
    const scores = scoreSeats(parseLayout(layout), PRESETS.balanced);
    for (const s of scores.values()) {
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
    }
  });

  it("uses the layout's recommended field of view unless the viewer sets one", () => {
    const imax = parseLayout(LAYOUTS.find((l) => l.id === "imax")!);
    const auto = scoreSeats(imax, PRESETS.balanced);
    expect(auto.values().next().value!.targetFov).toBe(60);
    const custom = scoreSeats(imax, { ...PRESETS.balanced, targetFov: 45 });
    expect(custom.values().next().value!.targetFov).toBe(45);
  });

  it("with only the aisle weight set, scores aisle seats 100 and others 0", () => {
    const zero = Object.fromEntries(FACTORS.map((f) => [f.key, 0])) as Prefs["weights"];
    const prefs: Prefs = { targetFov: null, weights: { ...zero, aisle: 1 } };
    const m = parseLayout(TINY);
    const scores = scoreSeats(m, prefs);
    for (const s of m.seats) expect(scores.get(s.id)!.total).toBe(s.aisle ? 100 : 0);
  });

  it("ranks multiplex seats two thirds back above the front row", () => {
    const m = parseLayout(LAYOUTS.find((l) => l.id === "multiplex")!);
    const scores = scoreSeats(m, PRESETS.balanced);
    expect(scores.get("K12")!.total).toBeGreaterThan(scores.get("A11")!.total + 30);
  });
});

describe("presets", () => {
  it("only use weights the sliders allow (whole numbers from 0 to 5)", () => {
    for (const p of Object.values(PRESETS)) {
      for (const w of Object.values(p.weights)) {
        expect(Number.isInteger(w) && w >= 0 && w <= 5).toBe(true);
      }
    }
  });

  it("KOFA crowd keeps the weights fitted in data/notebooks/03_preference", () => {
    expect(PRESETS.kofa.label).toBe("KOFA crowd");
    expect(PRESETS.kofa.targetFov).toBe(48);
    expect(PRESETS.kofa.weights).toEqual({ immersion: 1, neck: 2, centering: 3, sound: 0, sightline: 3, aisle: 1 });
    expect(PRESETS.kofa.note).toMatch(/^Fitted on KOFA data/);
  });

  it("KOFA crowd scores with its 48° target on every layout", () => {
    for (const layout of LAYOUTS) {
      const scores = scoreSeats(parseLayout(layout), PRESETS.kofa);
      expect(scores.values().next().value!.targetFov).toBe(48);
    }
  });

  it("KOFA crowd ignores sound: moving the mix position changes nothing", () => {
    const m = parseLayout(TINY);
    const a = scoreSeats(m, PRESETS.kofa);
    const shifted = parseLayout({ ...TINY, rows: [...TINY.rows, { label: "C", seats: "...|..." }] }); // deeper room, new mix position
    const b = scoreSeats(shifted, PRESETS.kofa);
    for (const s of m.seats) expect(b.get(s.id)!.factors.sound).not.toBe(a.get(s.id)!.factors.sound);
    for (const s of m.seats) expect(b.get(s.id)!.total).toBe(a.get(s.id)!.total);
  });
});

describe("explain", () => {
  it("writes one sentence per factor with real units", () => {
    const m = parseLayout(TINY);
    const seat = m.seats.find((s) => s.id === "B2")!;
    const score = scoreSeats(m, PRESETS.balanced).get("B2")!;
    for (const f of FACTORS) expect(explain(f.key, score.metrics, seat, score.targetFov)).toMatch(/\.$/);
    expect(explain("sightline", score.metrics, seat, score.targetFov)).toMatch(/mm/);
  });
});
