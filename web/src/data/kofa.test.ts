import { describe, expect, it } from "vitest";
import { PRESETS, findGroups, parseLayout, scoreSeats } from "../engine";
import { KOFA_LAYOUTS } from "./layouts";

const [hall1, hall2] = KOFA_LAYOUTS.map(parseLayout);
const ids = (m: typeof hall1) => m.seats.map((s) => s.id);

describe("KOFA layouts", () => {
  it("match the halls' capacities, wheelchair spaces included", () => {
    expect(hall1.seats).toHaveLength(321);
    expect(hall2.seats).toHaveLength(150);
    expect(hall1.seats.filter((s) => s.kind === "wheelchair").map((s) => s.id)).toEqual(["W1", "W2", "W3", "W4"]);
    expect(hall2.seats.filter((s) => s.kind === "wheelchair").map((s) => s.id)).toEqual(["W1", "W2"]);
  });

  it("use the printed seat numbers from the booking system", () => {
    expect(ids(hall1)).toContain("N11");
    expect(ids(hall1)).not.toContain("N7");
    expect(ids(hall1).filter((id) => id.startsWith("O"))).toEqual(["O1", "O2", "O3", "O4", "O5", "O6"]);
    expect(ids(hall2).filter((id) => id.startsWith("L"))[0]).toBe("L2");
    expect(ids(hall2).filter((id) => id.startsWith("M"))).toEqual(["M2", "M7", "M8", "M9", "M10", "M11"]);
  });

  it("put row S behind a cross aisle between J and K", () => {
    const row = (label: string) => hall1.rows.find((r) => r.label === label)!;
    expect(row("S").index).toBe(row("J").index + 1);
    expect(row("S").dM - row("J").dM).toBeCloseTo(2.0);
    expect(row("K").dM - row("S").dM).toBeCloseTo(1.0);
    expect(row("S").floorM - row("J").floorM).toBeGreaterThan(row("K").floorM - row("S").floorM);
  });

  it("put the aisles where KOFA's map shows them", () => {
    const aisle = (m: typeof hall1, row: string) => m.seats.filter((s) => s.rowLabel === row && s.aisle).map((s) => s.number);
    expect(aisle(hall1, "A")).toEqual([1, 6, 7, 15, 16, 21]);
    expect(aisle(hall2, "A")).toEqual([1, 2, 3, 10, 11, 12]);
  });

  it("never splits a group across an aisle", () => {
    for (const m of [hall1, hall2]) {
      const scores = scoreSeats(m, PRESETS.balanced);
      for (const g of findGroups(m, scores, new Set(), 4, 10)) {
        const blocks = new Set(g.seats.map((id) => m.seats.find((s) => s.id === id)!.block));
        expect(blocks.size).toBe(1);
      }
    }
  });
});
