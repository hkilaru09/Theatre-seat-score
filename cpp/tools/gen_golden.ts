// Write the TypeScript engine's output for every layout and preset to
// cpp/tests/golden/, the reference the C++ parity tests compare against.
// Run from the repo root: node cpp/tools/gen_golden.ts
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FACTORS, PRESETS, explain, findGroups, measure, mulberry32, parseLayout, sampleBookings, scoreSeats, type Layout, type PresetKey } from "../../web/src/engine/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const data = join(here, "../../web/src/data");
const out = join(here, "../tests/golden");

const SEED = 11;
const GROUP_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const GROUP_LIMIT = 5;
// Explanations for every EXPLAIN_EVERY-th seat, all six factors.
const EXPLAIN_EVERY = 7;

const layouts: Layout[] = ["layouts.json", "kofa_layouts.json"].flatMap((f) => JSON.parse(readFileSync(join(data, f), "utf8")));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const rand = mulberry32(SEED);
writeFileSync(join(out, "mulberry32.json"), JSON.stringify({ seed: SEED, values: Array.from({ length: 10 }, () => rand()) }));

const summary = [];
for (const layout of layouts) {
  const model = parseLayout(layout);
  const presets: Record<string, unknown> = {};
  for (const key of Object.keys(PRESETS) as PresetKey[]) {
    const scores = scoreSeats(model, PRESETS[key]);
    const list = model.seats.map((s) => scores.get(s.id)!);
    const taken = sampleBookings(model, scores, SEED);
    presets[key] = {
      targetFov: list[0].targetFov,
      totals: list.map((s) => s.total),
      factors: list.map((s) => FACTORS.map((f) => s.factors[f.key])),
      bookings: [...taken],
      groups: Object.fromEntries(GROUP_SIZES.map((size) => [size, findGroups(model, scores, taken, size, GROUP_LIMIT)])),
      explain: model.seats
        .filter((_, i) => i % EXPLAIN_EVERY === 0)
        .flatMap((s) => FACTORS.map((f) => ({ seat: s.id, factor: f.key, text: explain(f.key, scores.get(s.id)!.metrics, s, list[0].targetFov) }))),
    };
  }
  const golden = {
    layout: layout.id,
    seats: model.seats.map((s) => ({ ...s, block: Number(s.block.split(":")[1]) })),
    metrics: model.seats.map((s) => measure(s, model)),
    presets,
  };
  writeFileSync(join(out, `${layout.id}.json`), JSON.stringify(golden));
  summary.push(`${layout.id}: ${model.seats.length} seats`);
}
console.log(`golden files for ${layouts.length} layouts × ${Object.keys(PRESETS).length} presets: ${summary.join(", ")}`);
