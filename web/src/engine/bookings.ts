import type { Model, ScoreMap } from "./types.ts";

/** Small seeded PRNG so sample bookings are repeatable. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample bookings: better seats are more likely to be gone already. */
export function sampleBookings(model: Model, scores: ScoreMap, seed: number): Set<string> {
  const rand = mulberry32(seed);
  const taken = new Set<string>();
  for (const seat of model.seats) {
    const q = scores.get(seat.id)!.total / 100;
    if (rand() < 0.1 + 0.55 * q * q) taken.add(seat.id);
  }
  return taken;
}
