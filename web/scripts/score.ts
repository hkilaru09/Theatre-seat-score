// Score layouts from the command line, for the data notebooks.
// Reads JSON on stdin: { "jobs": [{ "key": any, "layout": Layout, "prefs": Prefs }] }
// Writes JSON on stdout: { "results": [{ "key", "seats": [{ id, row, number, aisle, kind, total, factors, metrics }] }] }
// Run: node web/scripts/score.ts < jobs.json
import { readFileSync } from "node:fs";
import { parseLayout, scoreSeats, type Layout, type Prefs } from "../src/engine/index.ts";

interface Job {
  key: unknown;
  layout: Layout;
  prefs: Prefs;
}

const { jobs } = JSON.parse(readFileSync(0, "utf8")) as { jobs: Job[] };
const results = jobs.map(({ key, layout, prefs }) => {
  const model = parseLayout(layout);
  const scores = scoreSeats(model, prefs);
  return {
    key,
    seats: model.seats.map((s) => {
      const sc = scores.get(s.id)!;
      return { id: s.id, row: s.rowLabel, number: s.number, aisle: s.aisle, kind: s.kind, total: sc.total, factors: sc.factors, metrics: sc.metrics };
    }),
  };
});
process.stdout.write(JSON.stringify({ results }));
