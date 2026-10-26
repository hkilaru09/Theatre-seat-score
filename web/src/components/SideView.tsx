import type { Model, Seat } from "../engine";

interface Props {
  model: Model;
  seat: Seat;
}

/** Side elevation of the room for the selected seat's row, drawn to scale. */
export function SideView({ model, seat }: Props) {
  const { layout: L, rows } = model;
  const last = rows[rows.length - 1];
  const depth = last.dM + 1.2;
  const topM = L.screen.bottomM + L.screen.heightM;
  const tall = Math.max(topM, last.eyeM + 0.4) + 0.6;
  const W = 340;
  const scale = W / (depth + 0.8);
  const H = Math.round(tall * scale) + 18;
  const X = (d: number) => 8 + d * scale;
  const Y = (h: number) => H - 14 - h * scale;

  // Stepped floor.
  let floor = `M ${X(0)} ${Y(0)}`;
  rows.forEach((row, i) => {
    const start = i === 0 ? 0 : row.dM - L.rowSpacingM / 2;
    floor += ` L ${X(start)} ${Y(row.floorM)} L ${X(row.dM + L.rowSpacingM / 2)} ${Y(row.floorM)}`;
  });
  floor += ` L ${X(depth)} ${Y(last.floorM)} L ${X(depth)} ${Y(0)} Z`;

  const row = rows[seat.row];
  const front = rows[seat.row - 1];
  const ex = X(row.dM);
  const ey = Y(row.eyeM);

  return (
    <svg viewBox={`0 0 ${W + 16} ${H}`} role="img" aria-label="Side view of the sight lines">
      <path className="sv-floor" d={floor} />
      <line className="sv-screen" x1={X(0)} y1={Y(L.screen.bottomM)} x2={X(0)} y2={Y(topM)} />
      <line className="sv-ray" x1={ex} y1={ey} x2={X(0)} y2={Y(topM)} />
      <line className="sv-ray dash" x1={ex} y1={ey} x2={X(0)} y2={Y(L.screen.bottomM)} />
      {front && <circle className="sv-head" cx={X(front.dM)} cy={Y(front.eyeM + 0.05)} r={Math.max(3, 0.11 * scale)} />}
      <circle className="sv-eye" cx={ex} cy={ey} r={3.5} />
      <text className="sv-text" x={X(0) + 6} y={Y(topM) + 10}>
        screen {L.screen.heightM.toFixed(1)} m tall
      </text>
      <text className="sv-text" x={Math.min(ex, W - 60)} y={H - 2} textAnchor="middle">
        {row.dM.toFixed(1)} m
      </text>
    </svg>
  );
}
