import { memo, type KeyboardEvent } from "react";
import type { GroupBlock, Model, ScoreMap } from "../engine";
import { band } from "../lib/bands";
import { seatName } from "../lib/summary";

const CELL = 22;
const SEAT = 18;
const ROW_H = 26;
const LABEL_W = 30;
const TOP = 64;

interface Props {
  model: Model;
  scores: ScoreMap;
  taken: ReadonlySet<string>;
  groups: GroupBlock[];
  activeGroup: number;
  selected: string;
  onSeat: (id: string) => void;
}

/** Heatmap of every seat, drawn with the screen to scale against the seat columns. */
export const SeatMap = memo(function SeatMap({ model, scores, taken, groups, activeGroup, selected, onSeat }: Props) {
  const { layout, rows } = model;
  const seatCols = model.maxCols;
  const screenCols = layout.screen.widthM / layout.seatWidthM;
  const cols = Math.max(seatCols, screenCols);
  const width = LABEL_W * 2 + cols * CELL;
  const height = TOP + rows.length * ROW_H + 18;
  const cx = width / 2;

  const sw = screenCols * CELL;
  const x0 = cx - sw / 2;
  const x1 = cx + sw / 2;

  const rowY = (r: number) => TOP + r * ROW_H;
  const colX = (r: number, c: number) => cx + (c - (rows[r].cells.length - 1) / 2) * CELL - SEAT / 2;

  // Mix position marker, interpolated between rows.
  const mixD = scores.get(model.seats[0].id)!.metrics.mixD;
  let mixY = rowY(rows.length - 1) + SEAT / 2;
  for (let r = 0; r < rows.length - 1; r++) {
    if (mixD >= rows[r].dM && mixD <= rows[r + 1].dM) {
      const t = (mixD - rows[r].dM) / (rows[r + 1].dM - rows[r].dM);
      mixY = rowY(r) + SEAT / 2 + t * ROW_H;
    }
  }

  const labelInset = (cols - seatCols) * CELL * 0.5;
  const seatById = new Map(model.seats.map((s) => [s.id, s]));

  const onKeyDown = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSeat(id);
    }
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Seat map for ${layout.name}`}>
      <path className="screen-glow" d={`M ${x0} 16 Q ${cx} 6 ${x1} 16 L ${x1 - sw * 0.06} 54 L ${x0 + sw * 0.06} 54 Z`} />
      <path className="screen-line" d={`M ${x0} 16 Q ${cx} 6 ${x1} 16`} />
      <text className="screen-label" x={cx} y={34} textAnchor="middle">
        SCREEN · {layout.screen.widthM.toFixed(1)} M
      </text>

      {rows.map((row) =>
        [LABEL_W / 2 + labelInset, width - LABEL_W / 2 - labelInset].map((x, side) => (
          <text key={`${row.label}-${side}`} className="row-label" x={x} y={rowY(row.index) + SEAT / 2 + 4} textAnchor="middle">
            {row.label}
          </text>
        ))
      )}

      {model.seats.map((seat) => {
        const s = scores.get(seat.id)!;
        const b = band(s.total);
        const isTaken = taken.has(seat.id);
        const x = colX(seat.row, seat.col);
        const y = rowY(seat.row);
        const cls = ["seat", b.cls, isTaken && "taken", selected === seat.id && "selected"].filter(Boolean).join(" ");
        return (
          <g
            key={seat.id}
            className={cls}
            tabIndex={0}
            role="button"
            data-id={seat.id}
            aria-label={`${seatName(seat, false)}, score ${s.total}, ${isTaken ? "booked" : "open"}`}
            onClick={() => onSeat(seat.id)}
            onKeyDown={(e) => onKeyDown(e, seat.id)}
          >
            <title>{`${seat.id} · ${s.total} (${b.label})${isTaken ? " · booked" : ""}`}</title>
            <rect className="body" x={x} y={y} width={SEAT} height={SEAT} rx={seat.kind === "wheelchair" ? 9 : 4} />
            {seat.kind === "wheelchair" && <circle className="wc" cx={x + SEAT / 2} cy={y + SEAT / 2} r={3} />}
            {isTaken && (
              <path
                className="cross"
                d={`M ${x + 5} ${y + 5} L ${x + SEAT - 5} ${y + SEAT - 5} M ${x + SEAT - 5} ${y + 5} L ${x + 5} ${y + SEAT - 5}`}
              />
            )}
          </g>
        );
      })}

      {groups.map((grp, gi) => {
        const first = seatById.get(grp.seats[0])!;
        const last = seatById.get(grp.seats[grp.seats.length - 1])!;
        const x = colX(first.row, first.col) - 3;
        const w = colX(last.row, last.col) + SEAT + 3 - x;
        return (
          <rect
            key={grp.seats.join()}
            className={"group-box" + (gi === activeGroup ? " active" : "")}
            x={x}
            y={rowY(first.row) - 3}
            width={w}
            height={SEAT + 6}
            rx={6}
          />
        );
      })}

      {/* Mix position crosshair sits on top of the seats but ignores clicks. */}
      <circle className="mix-mark" cx={cx} cy={mixY} r={13} />
      <path className="mix-mark" d={`M ${cx - 20} ${mixY} H ${cx + 20} M ${cx} ${mixY - 20} V ${mixY + 20}`} />
    </svg>
  );
});
