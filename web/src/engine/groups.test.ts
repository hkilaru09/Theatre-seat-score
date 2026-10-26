import { describe, expect, it } from "vitest";
import { LAYOUTS } from "../data/layouts";
import { sampleBookings } from "./bookings";
import { TINY } from "./fixtures";
import { parseLayout } from "./geometry";
import { findGroups } from "./groups";
import { PRESETS, scoreSeats } from "./scoring";
import type { Model, ScoreMap, Seat } from "./types";

/** Try every window in every row. Slow but obviously correct. */
function bruteForceBest(model: Model, scores: ScoreMap, taken: Set<string>, size: number): number {
  let best = -Infinity;
  const rows = new Map<number, Seat[]>();
  for (const s of model.seats) rows.set(s.row, [...(rows.get(s.row) ?? []), s]);
  for (const seats of rows.values()) {
    for (let i = 0; i + size <= seats.length; i++) {
      const w = seats.slice(i, i + size);
      const ok = w.every((s, j) => !taken.has(s.id) && s.block === w[0].block && (j === 0 || s.col === w[j - 1].col + 1));
      if (!ok) continue;
      const t = w.map((s) => scores.get(s.id)!.total);
      best = Math.max(best, 0.75 * (t.reduce((a, b) => a + b, 0) / size) + 0.25 * Math.min(...t));
    }
  }
  return best;
}

describe("findGroups", () => {
  const tiny = parseLayout(TINY);
  const tinyScores = scoreSeats(tiny, PRESETS.balanced);

  it("never crosses an aisle or a booked seat", () => {
    const taken = new Set(["A2", "B5"]);
    const byId = new Map(tiny.seats.map((s) => [s.id, s]));
    for (const g of findGroups(tiny, tinyScores, taken, 2, 10)) {
      const seats = g.seats.map((id) => byId.get(id)!);
      expect(seats.some((s) => taken.has(s.id))).toBe(false);
      expect(new Set(seats.map((s) => s.block)).size).toBe(1);
    }
  });

  it("returns nothing when the group is wider than any block", () => {
    expect(findGroups(tiny, tinyScores, new Set(), 4)).toEqual([]);
  });

  it("returns blocks that don't overlap, best first", () => {
    const groups = findGroups(tiny, tinyScores, new Set(), 2, 10);
    const all = groups.flatMap((g) => g.seats);
    expect(new Set(all).size).toBe(all.length);
    for (let i = 1; i < groups.length; i++) expect(groups[i - 1].rank).toBeGreaterThanOrEqual(groups[i].rank);
  });

  it("reports the window minimum correctly", () => {
    for (const g of findGroups(tiny, tinyScores, new Set(), 3, 10)) {
      expect(g.min).toBe(Math.min(...g.seats.map((id) => tinyScores.get(id)!.total)));
    }
  });

  it.each(
    LAYOUTS.flatMap((l) => [1, 3, 6].map((size) => [l.id, size, l] as const))
  )("matches brute force on %s for groups of %i", (_id, size, layout) => {
    const m = parseLayout(layout);
    const scores = scoreSeats(m, PRESETS.balanced);
    for (const seed of [1, 2, 3]) {
      const taken = sampleBookings(m, scores, seed);
      const [best] = findGroups(m, scores, taken, size, 1);
      const want = bruteForceBest(m, scores, taken, size);
      if (want === -Infinity) expect(best).toBeUndefined();
      else expect(best.rank).toBeCloseTo(want, 9);
    }
  });
});
