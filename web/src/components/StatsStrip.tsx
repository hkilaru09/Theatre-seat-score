import type { GroupBlock, Model, ScoreMap } from "../engine";
import { bestSeat } from "../lib/summary";

interface Props {
  model: Model;
  scores: ScoreMap;
  taken: ReadonlySet<string>;
  groups: GroupBlock[];
  groupSize: number;
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat">
      <span className="eyebrow">{label}</span>
      <span className="value">{value}</span>
      <span className="sub">{sub}</span>
    </div>
  );
}

export function StatsStrip({ model, scores, taken, groups, groupSize }: Props) {
  const total = model.seats.length;
  const booked = model.seats.filter((s) => taken.has(s.id)).length;
  const great = model.seats.filter((s) => scores.get(s.id)!.total >= 80).length;
  const best = bestSeat(model, scores)!;
  const bestOpen = bestSeat(model, scores, taken);
  const g = groups[0];

  let openNote = "No seats open";
  if (bestOpen) openNote = bestOpen.seat.id === best.seat.id ? "Still open" : `Best open: ${bestOpen.seat.id} · ${bestOpen.total}`;

  return (
    <section className="stats" aria-label="Summary">
      <Stat label="Best seat" value={`${best.seat.id} · ${best.total}`} sub={openNote} />
      <Stat label="Seats 80 or higher" value={`${Math.round((100 * great) / total)}%`} sub={`${great} of ${total} seats`} />
      <Stat
        label={`Best ${groupSize} together`}
        value={g ? `Row ${g.rowLabel} · ${g.from}–${g.to}` : "None open"}
        sub={g ? `Average ${Math.round(g.avg)}, lowest ${g.min}` : "Try a smaller group"}
      />
      <Stat label="Booked" value={`${booked} / ${total}`} sub="Sample bookings" />
    </section>
  );
}
