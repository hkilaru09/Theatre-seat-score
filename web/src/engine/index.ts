// SeatScore engine: pure functions that turn a theater layout into per-seat
// viewing scores and find the best block of adjacent seats for a group.
export * from "./types.ts";
export { EYE_HEIGHT_M, floorHeight, measure, parseLayout } from "./geometry.ts";
export { FACTORS, IDEAL_C_VALUE_M, PRESETS, bell, clamp, explain, factorScores, ramp, scoreSeats } from "./scoring.ts";
export type { PresetKey } from "./scoring.ts";
export { findGroups } from "./groups.ts";
export { mulberry32, sampleBookings } from "./bookings.ts";
