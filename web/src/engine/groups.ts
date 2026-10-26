import type { GroupBlock, Model, ScoreMap, Seat } from "./types.ts";

/**
 * Best blocks of `size` adjacent open seats.
 *
 * Seats are adjacent when they are next to each other in the same row with
 * no aisle or booked seat between them. For each run of open seats a sliding
 * window keeps the running sum, and a monotonic deque keeps the window
 * minimum, so the whole search is O(seats) plus a sort of the candidates.
 *
 * Blocks are ranked by 0.75 * average + 0.25 * lowest seat, so one bad seat
 * drags a block down more than a plain average would. Results never overlap.
 */
export function findGroups(model: Model, scores: ScoreMap, taken: ReadonlySet<string>, size: number, limit = 3): GroupBlock[] {
  const candidates: GroupBlock[] = [];
  const byRow = new Map<number, Seat[]>();
  for (const seat of model.seats) {
    const list = byRow.get(seat.row);
    if (list) list.push(seat);
    else byRow.set(seat.row, [seat]);
  }

  const slide = (run: Seat[]) => {
    const s = run.map((seat) => scores.get(seat.id)!.total);
    const deque: number[] = []; // indexes with increasing scores
    let sum = 0;
    for (let i = 0; i < s.length; i++) {
      sum += s[i];
      while (deque.length && s[deque[deque.length - 1]] >= s[i]) deque.pop();
      deque.push(i);
      const start = i - size + 1;
      if (start < 0) continue;
      if (deque[0] < start) deque.shift();
      const avg = sum / size;
      const min = s[deque[0]];
      candidates.push({
        seats: run.slice(start, i + 1).map((x) => x.id),
        rowLabel: run[start].rowLabel,
        from: run[start].number,
        to: run[i].number,
        avg,
        min,
        rank: 0.75 * avg + 0.25 * min,
      });
      sum -= s[start];
    }
  };

  for (const rowSeats of byRow.values()) {
    let run: Seat[] = [];
    const flush = () => {
      if (run.length >= size) slide(run);
      run = [];
    };
    for (const seat of rowSeats) {
      if (taken.has(seat.id)) {
        flush();
        continue;
      }
      const prev = run[run.length - 1];
      if (prev && !(prev.block === seat.block && seat.col === prev.col + 1)) flush();
      run.push(seat);
    }
    flush();
  }

  candidates.sort((a, b) => b.rank - a.rank);
  const picked: GroupBlock[] = [];
  const used = new Set<string>();
  for (const c of candidates) {
    if (c.seats.some((id) => used.has(id))) continue;
    picked.push(c);
    c.seats.forEach((id) => used.add(id));
    if (picked.length === limit) break;
  }
  return picked;
}
