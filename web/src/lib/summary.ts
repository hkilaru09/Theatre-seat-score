import type { GroupBlock, Model, ScoreMap, Seat } from "../engine";

export interface BestSeat {
  seat: Seat;
  total: number;
}

/** Highest-scoring seat, preferring the one nearest the centerline on ties. */
export function bestSeat(model: Model, scores: ScoreMap, taken?: ReadonlySet<string>): BestSeat | null {
  let best: BestSeat | null = null;
  for (const seat of model.seats) {
    if (taken?.has(seat.id)) continue;
    const total = scores.get(seat.id)!.total;
    if (!best || total > best.total || (total === best.total && Math.abs(seat.offsetCol) < Math.abs(best.seat.offsetCol))) {
      best = { seat, total };
    }
  }
  return best;
}

/** "Row F, seat 12", or "Row N, wheelchair space 1" for wheelchair spaces. */
export function seatName(seat: Seat, comma = true): string {
  const sep = comma ? ", " : " ";
  return seat.kind === "wheelchair" ? `Row ${seat.rowLabel}${sep}wheelchair space ${seat.number}` : `Row ${seat.rowLabel}${sep}seat ${seat.number}`;
}

/** The seat to show in the detail panel for a group: its middle seat. */
export function middleSeat(group: GroupBlock): string {
  return group.seats[Math.floor(group.seats.length / 2)];
}
