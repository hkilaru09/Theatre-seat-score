// The TypeScript engine must give exactly the same results as the v1 JavaScript engine
// on v1's layouts. (Newer layout options, such as positional numbering, are v2 only.)
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import * as v2 from "./index";

const require = createRequire(import.meta.url);
const v1 = require("../../../v1/engine.js");
const LAYOUTS: v2.Layout[] = require("../../../v1/data/layouts.json");

describe("parity with v1", () => {
  it.each(LAYOUTS.flatMap((l) => Object.keys(v2.PRESETS).map((p) => [l.id, p, l] as const)))(
    "%s with the %s preset",
    (_id, presetKey, layout) => {
      const preset = v2.PRESETS[presetKey as v2.PresetKey];
      const a = v1.scoreSeats(v1.parseLayout(layout), preset);
      const m = v2.parseLayout(layout);
      const b = v2.scoreSeats(m, preset);
      expect([...b.keys()]).toEqual([...a.keys()]);
      for (const [id, s] of b) {
        expect(s.total).toBe(a.get(id).total);
        expect(s.metrics).toEqual(a.get(id).metrics);
      }

      const taken = v2.sampleBookings(m, b, 11);
      expect([...taken]).toEqual([...v1.sampleBookings(v1.parseLayout(layout), a, 11)]);
      expect(v2.findGroups(m, b, taken, 4)).toEqual(v1.findGroups(v1.parseLayout(layout), a, taken, 4));
    }
  );
});
