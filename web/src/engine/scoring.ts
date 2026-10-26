import { measure } from "./geometry.ts";
import type { Factor, FactorKey, FactorScores, Metrics, Model, Prefs, Preset, ScoreMap, Seat } from "./types.ts";

/** The eye line clears the head in front by 120 mm. */
export const IDEAL_C_VALUE_M = 0.12;
const DEFAULT_FOV_DEG = 40;

export const FACTORS: readonly Factor[] = [
  { key: "immersion", label: "Immersion", hint: "How much of your view the screen fills" },
  { key: "neck", label: "Neck comfort", hint: "How far you look up to the picture" },
  { key: "centering", label: "Centering", hint: "How far you sit off the centerline" },
  { key: "sound", label: "Sound", hint: "Distance from the mix position" },
  { key: "sightline", label: "Clear view", hint: "Clearance over the head in front" },
  { key: "aisle", label: "Aisle access", hint: "A seat next to an aisle" },
];

export const PRESETS = {
  balanced: { label: "Balanced", targetFov: null, weights: { immersion: 3, neck: 3, centering: 2, sound: 2, sightline: 3, aisle: 0 } },
  picture: { label: "Picture first", targetFov: null, weights: { immersion: 5, neck: 3, centering: 4, sound: 1, sightline: 4, aisle: 0 } },
  sound: { label: "Sound first", targetFov: null, weights: { immersion: 2, neck: 2, centering: 2, sound: 5, sightline: 2, aisle: 0 } },
  close: { label: "Front-row fan", targetFov: 60, weights: { immersion: 5, neck: 1, centering: 2, sound: 1, sightline: 2, aisle: 0 } },
  exit: { label: "Easy exit", targetFov: null, weights: { immersion: 2, neck: 2, centering: 1, sound: 1, sightline: 2, aisle: 5 } },
  // Best fit to early seat picks at Cinematheque KOFA (data/notebooks/03_preference).
  kofa: {
    label: "KOFA crowd",
    targetFov: 48,
    weights: { immersion: 1, neck: 2, centering: 3, sound: 0, sightline: 3, aisle: 1 },
    note: "Fitted on KOFA data: the weights that best match which seats Cinematheque KOFA viewers in Seoul booked first, 2017–2026 (2020–22 distancing period left out).",
  },
} as const satisfies Record<string, Preset>;

export type PresetKey = keyof typeof PRESETS;

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** 1 at or below `good`, 0 at or above `bad`, linear in between. */
export function ramp(x: number, good: number, bad: number): number {
  return clamp((bad - x) / (bad - good), 0, 1);
}

/** Bell curve around `target`, with separate widths below and above it. */
export function bell(x: number, target: number, sigmaLow: number, sigmaHigh: number): number {
  const s = x < target ? sigmaLow : sigmaHigh;
  return Math.exp(-0.5 * ((x - target) / s) ** 2);
}

export function factorScores(m: Metrics, seat: Seat, targetFov: number): FactorScores {
  return {
    immersion: bell(m.fov, targetFov, 14, 12),
    neck: ramp(m.lookUp, 12, 32) * ramp(m.lookUpTop, 30, 48) * ramp(-m.lookUp, 10, 25),
    centering: ramp(m.offAxis, 4, 28),
    sound: Math.exp(-1.5 * m.mixNorm ** 2),
    sightline: m.cValue === null ? 1 : clamp((m.cValue + 0.02) / (IDEAL_C_VALUE_M + 0.02), 0, 1),
    aisle: seat.aisle ? 1 : 0,
  };
}

/** Score every seat on a 0–100 scale as the weighted average of its factor scores. */
export function scoreSeats(model: Model, prefs: Prefs): ScoreMap {
  const targetFov = prefs.targetFov ?? model.layout.recommendedFovDeg ?? DEFAULT_FOV_DEG;
  const weights = prefs.weights;
  const weightSum = FACTORS.reduce((s, f) => s + weights[f.key], 0) || 1;
  const out: ScoreMap = new Map();
  for (const seat of model.seats) {
    const metrics = measure(seat, model);
    const factors = factorScores(metrics, seat, targetFov);
    let total = 0;
    for (const f of FACTORS) total += weights[f.key] * factors[f.key];
    total = Math.round((100 * total) / weightSum);
    out.set(seat.id, { total, factors, metrics, targetFov });
  }
  return out;
}

/** One plain-language sentence explaining a factor score. */
export function explain(key: FactorKey, m: Metrics, seat: Seat, targetFov: number): string {
  const f = (n: number, digits = 0) => n.toFixed(digits);
  switch (key) {
    case "immersion":
      return `Screen fills ${f(m.fov)}° of your view (target ${f(targetFov)}°).`;
    case "neck":
      return m.lookUp >= 0
        ? `You look up ${f(m.lookUp)}° to the center and ${f(m.lookUpTop)}° to the top edge.`
        : `You look down ${f(-m.lookUp)}° to the center of the picture.`;
    case "centering":
      return m.offAxis < 1 ? "On the centerline." : `${f(m.offAxis)}° off the centerline.`;
    case "sound":
      return `${f(m.mixDist, 1)} m from the mix position (${f(m.mixD, 1)} m back, centered).`;
    case "sightline":
      if (m.cValue === null) return "Front row: nobody in front of you.";
      if (m.cValue >= IDEAL_C_VALUE_M) return `Eye line clears the head in front by ${f(m.cValue * 1000)} mm.`;
      if (m.cValue >= 0) return `Only ${f(m.cValue * 1000)} mm of clearance. Tall heads will cut into the bottom of the picture.`;
      return `Eye line is ${f(-m.cValue * 1000)} mm below the eyes in front. The bottom of the picture is blocked.`;
    case "aisle":
      return seat.aisle ? "Next to an aisle or row end." : "Inside the row.";
  }
}
