import type { Layout, Metrics, Model, Rake, Row, Seat } from "./types.ts";

const DEG = 180 / Math.PI;

/** Seated eye height above the floor. */
export const EYE_HEIGHT_M = 1.12;

/** Floor height of row r. Front rows sit on a gentle slope, the rest on stadium risers. */
export function floorHeight(rake: Rake, r: number): number {
  const front = rake.frontRows ?? 0;
  const slope = rake.frontSlopeM ?? 0;
  if (r < front) return r * slope;
  return front * slope + (r - front + 1) * (rake.riserM ?? 0);
}

const isSeat = (ch: string | undefined) => ch === "x" || ch === "w";
const isEdge = (ch: string | undefined) => ch === undefined || ch === "|";

export function parseLayout(layout: Layout): Model {
  let extraD = 0;
  let extraRise = 0;
  const rows: Row[] = layout.rows.map((row, r) => {
    extraD += row.gapBeforeM ?? 0;
    extraRise += row.stepM ?? 0;
    const dM = layout.firstRowM + r * layout.rowSpacingM + extraD;
    const floorM = floorHeight(layout.rake ?? {}, r) + extraRise;
    return { index: r, label: row.label, cells: row.seats, dM, floorM, eyeM: floorM + EYE_HEIGHT_M };
  });

  const positional = layout.numbering === "positional";
  let wheelchairs = 0;
  const seats: Seat[] = [];
  for (const row of rows) {
    const cells = row.cells;
    const mid = (cells.length - 1) / 2;
    let number = 0;
    let block = 0;
    for (let c = 0; c < cells.length; c++) {
      const ch = cells[c];
      if (positional && ch !== "|") number++;
      if (!isSeat(ch)) {
        block++;
        continue;
      }
      if (!positional) number++;
      const wheelchair = ch === "w";
      if (wheelchair) wheelchairs++;
      // Positional numbering names wheelchair spaces W1, W2… across the hall.
      const id = positional && wheelchair ? `W${wheelchairs}` : row.label + number;
      seats.push({
        id,
        row: row.index,
        rowLabel: row.label,
        number: positional && wheelchair ? wheelchairs : number,
        col: c,
        offsetCol: c - mid,
        block: `${row.label}:${block}`,
        kind: wheelchair ? "wheelchair" : "standard",
        xM: (c - mid) * layout.seatWidthM,
        dM: row.dM,
        floorM: row.floorM,
        eyeM: row.eyeM,
        aisle: isEdge(cells[c - 1]) || isEdge(cells[c + 1]),
      });
    }
  }

  const maxCols = Math.max(...rows.map((r) => r.cells.length));
  return { layout, rows, seats, maxCols };
}

/** Raw geometry for one seat, in degrees and metres. */
export function measure(seat: Seat, model: Model): Metrics {
  const { layout, rows } = model;
  const sc = layout.screen;
  const d = seat.dM;
  const centerM = sc.bottomM + sc.heightM / 2;
  const topM = sc.bottomM + sc.heightM;

  const fov = 2 * Math.atan(sc.widthM / 2 / d) * DEG;
  const lookUp = Math.atan((centerM - seat.eyeM) / d) * DEG;
  const lookUpTop = Math.atan((topM - seat.eyeM) / d) * DEG;
  const offAxis = Math.atan(Math.abs(seat.xM) / d) * DEG;

  // Mix position: about two thirds of the way back, on the centerline.
  const depth = rows[rows.length - 1].dM + 1;
  const mixD = (2 / 3) * depth;
  const halfWidth = (model.maxCols / 2) * layout.seatWidthM;
  const mixDist = Math.hypot(d - mixD, seat.xM);
  const mixNorm = Math.hypot((d - mixD) / (depth / 2), seat.xM / halfWidth);

  // C-value: how far the sight line to the bottom of the screen passes
  // above the eyes of the person one row ahead.
  let cValue: number | null = null;
  const front = rows[seat.row - 1];
  if (front) {
    const t = (d - front.dM) / d;
    const lineAtFront = seat.eyeM + (sc.bottomM - seat.eyeM) * t;
    cValue = lineAtFront - front.eyeM;
  }

  return { fov, lookUp, lookUpTop, offAxis, mixD, mixDist, mixNorm, cValue };
}
