import { FACTORS, explain, type Model, type Seat, type SeatScore, type Weights } from "../engine";
import { band } from "../lib/bands";
import { seatName } from "../lib/summary";
import { SideView } from "./SideView";

interface Props {
  model: Model;
  seat: Seat;
  score: SeatScore;
  isTaken: boolean;
  weights: Weights;
}

export function SeatDetail({ model, seat, score, isTaken, weights }: Props) {
  const b = band(score.total);
  const kind = seat.kind === "wheelchair" ? "Wheelchair space" : seat.aisle ? "Aisle seat" : "Standard seat";

  return (
    <section className="panel" aria-live="polite" aria-labelledby="detail-title">
      <div className="seat-head">
        <div>
          <span className="eyebrow">Selected seat</span>
          <h3 id="detail-title">{seatName(seat)}</h3>
          <span className="kind">
            {kind} · {seat.dM.toFixed(1)} m from the screen
          </span>
        </div>
        <div className="score">
          <span className="big num">{score.total}</span>
          {isTaken ? <span className="pill taken">Booked</span> : <span className={"pill " + b.cls}>{b.label}</span>}
        </div>
      </div>

      <ul className="factors">
        {FACTORS.map((f) => {
          const w = weights[f.key];
          const pct = Math.round(score.factors[f.key] * 100);
          return (
            <li key={f.key} className={"factor" + (w === 0 ? " off" : "")}>
              <div className="top">
                <b>{f.label}</b>
                <span className="num">
                  {pct} · weight {w}
                </span>
              </div>
              <div className="bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="why">{explain(f.key, score.metrics, seat, score.targetFov)}</div>
            </li>
          );
        })}
      </ul>

      <div className="section-view">
        <SideView model={model} seat={seat} />
      </div>
      <p className="caption">
        Side view of row {seat.rowLabel}, drawn to scale. Red lines run from your eyes to the top and bottom of the screen; the grey dot is the
        head in front.
      </p>
    </section>
  );
}
