import type { Layout } from "./types.ts";

/** Two rows of six seats split by a center aisle. Small enough to check by hand. */
export const TINY: Layout = {
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
