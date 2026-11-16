// Same workload as bench/bench_engine.cpp, timed in Node, for the C++ vs
// TypeScript table in cpp/README.md.
// Run from the repo root: node cpp/bench/bench_engine.ts
import { PRESETS, findGroups, parseLayout, sampleBookings, scoreSeats, type Layout } from "../../web/src/engine/index.ts";

const SEATS_PER_BLOCK = 12;
const BLOCKS_PER_ROW = 5;
const SEATS_PER_ROW = SEATS_PER_BLOCK * BLOCKS_PER_ROW;

/** Rows of 60 seats in blocks of 12 split by aisles, like bench/synthetic.hpp. */
function synthetic(seats: number): Layout {
  const row = Array.from({ length: BLOCKS_PER_ROW }, () => "x".repeat(SEATS_PER_BLOCK)).join("|");
  return {
    id: `synthetic-${seats}`,
    name: `synthetic-${seats}`,
    screen: { widthM: 20, heightM: 8.5, bottomM: 1.2 },
    recommendedFovDeg: 45,
    firstRowM: 5,
    rowSpacingM: 1.1,
    seatWidthM: 0.55,
    rake: { frontRows: 2, frontSlopeM: 0.05, riserM: 0.4 },
    rows: Array.from({ length: Math.floor(seats / SEATS_PER_ROW) }, (_, r) => ({ label: `R${r + 1}`, seats: row })),
  };
}

/** Median time per call in microseconds: warm up, then time batches of at least 50 ms. */
function time(fn: () => unknown): number {
  for (let i = 0; i < 3; i++) fn();
  const samples: number[] = [];
  for (let s = 0; s < 7; s++) {
    let n = 0;
    const t0 = performance.now();
    let elapsed = 0;
    do {
      fn();
      n++;
      elapsed = performance.now() - t0;
    } while (elapsed < 50);
    samples.push((elapsed * 1000) / n);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

const rows: Record<string, number | string>[] = [];
for (const seats of [300, 3000, 30000, 300000]) {
  const model = parseLayout(synthetic(seats));
  const scores = scoreSeats(model, PRESETS.balanced);
  const taken = sampleBookings(model, scores, 11);
  rows.push({ bench: "scoreSeats", seats, us: time(() => scoreSeats(model, PRESETS.balanced)) });
  for (const size of [2, 4, 8]) rows.push({ bench: `findGroups/${size}`, seats, us: time(() => findGroups(model, scores, taken, size)) });
}
console.log(JSON.stringify({ node: process.version, rows }));
