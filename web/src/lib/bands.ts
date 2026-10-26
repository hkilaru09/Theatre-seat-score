export interface Band {
  min: number;
  cls: "h1" | "h2" | "h3" | "h4" | "h5";
  label: string;
}

/** Score bands, best first. Each maps to a heatmap color token. */
export const BANDS: readonly Band[] = [
  { min: 90, cls: "h5", label: "Best" },
  { min: 80, cls: "h4", label: "Great" },
  { min: 65, cls: "h3", label: "Good" },
  { min: 50, cls: "h2", label: "Fair" },
  { min: 0, cls: "h1", label: "Avoid" },
];

export function band(score: number): Band {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}
