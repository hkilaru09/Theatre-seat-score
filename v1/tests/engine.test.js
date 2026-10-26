// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../engine.js");
const layouts = require("../data/layouts.json");

const tiny = {
  id: "tiny",
  name: "Tiny",
  screen: { widthM: 8, heightM: 3.4, bottomM: 1 },
  recommendedFovDeg: 40,
  firstRowM: 4,
  rowSpacingM: 1,
  seatWidthM: 0.5,
  rake: { frontRows: 1, frontSlopeM: 0, riserM: 0.4 },
  rows: [
    { label: "A", seats: "xxx|xxx" },
    { label: "B", seats: "xxx|xxx" },
  ],
};

test("parseLayout counts seats and skips aisles", () => {
  const m = S.parseLayout(tiny);
  assert.equal(m.seats.length, 12);
  assert.deepEqual(m.seats.filter((s) => s.rowLabel === "A").map((s) => s.number), [1, 2, 3, 4, 5, 6]);
  const a3 = m.seats.find((s) => s.id === "A3");
  const a4 = m.seats.find((s) => s.id === "A4");
  assert.ok(a3.aisle && a4.aisle, "seats beside the aisle are aisle seats");
  assert.notEqual(a3.block, a4.block, "the aisle splits the row into blocks");
});

test("field of view matches 2·atan(W/2d)", () => {
  const m = S.parseLayout(tiny);
  const seat = m.seats.find((s) => s.id === "A1");
  const got = S.measure(seat, m).fov;
  const want = (2 * Math.atan(4 / 4) * 180) / Math.PI; // 90°
  assert.ok(Math.abs(got - want) < 1e-9);
});

test("front row has no C-value; risers give the second row clearance", () => {
  const m = S.parseLayout(tiny);
  assert.equal(S.measure(m.seats.find((s) => s.id === "A2"), m).cValue, null);
  const c = S.measure(m.seats.find((s) => s.id === "B2"), m).cValue;
  assert.ok(c > 0.12, `expected clear view, got ${c}`);
});

test("scores are 0–100 for every sample layout", () => {
  for (const L of layouts) {
    const m = S.parseLayout(L);
    const scores = S.scoreSeats(m, S.PRESETS.balanced);
    for (const s of scores.values()) assert.ok(s.total >= 0 && s.total <= 100);
  }
});

test("group search never crosses an aisle or a booked seat", () => {
  const m = S.parseLayout(tiny);
  const scores = S.scoreSeats(m, S.PRESETS.balanced);
  const taken = new Set(["A2", "B5"]);
  const groups = S.findGroups(m, scores, taken, 2, 10);
  const seatById = new Map(m.seats.map((s) => [s.id, s]));
  for (const g of groups) {
    const seats = g.seats.map((id) => seatById.get(id));
    assert.ok(seats.every((s) => !taken.has(s.id)));
    assert.equal(new Set(seats.map((s) => s.block)).size, 1);
  }
  assert.equal(S.findGroups(m, scores, new Set(), 4).length, 0, "no block of 4 fits between aisles");
});

test("group search matches brute force on a sample layout", () => {
  const m = S.parseLayout(layouts[0]);
  const scores = S.scoreSeats(m, S.PRESETS.balanced);
  const taken = S.sampleBookings(m, scores, 3);
  const size = 3;
  const [best] = S.findGroups(m, scores, taken, size, 1);

  let brute = -Infinity;
  const rows = new Map();
  m.seats.forEach((s) => rows.set(s.row, [...(rows.get(s.row) || []), s]));
  for (const seats of rows.values()) {
    for (let i = 0; i + size <= seats.length; i++) {
      const w = seats.slice(i, i + size);
      const ok = w.every((s, j) => !taken.has(s.id) && s.block === w[0].block && (j === 0 || s.col === w[j - 1].col + 1));
      if (!ok) continue;
      const t = w.map((s) => scores.get(s.id).total);
      const rank = 0.75 * (t.reduce((a, b) => a + b, 0) / size) + 0.25 * Math.min(...t);
      brute = Math.max(brute, rank);
    }
  }
  assert.ok(Math.abs(best.rank - brute) < 1e-9);
});
