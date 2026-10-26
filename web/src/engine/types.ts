// Units: metres and degrees. Distances are measured from the screen plane.

export interface Screen {
  widthM: number;
  heightM: number;
  /** Height of the bottom edge of the picture above the front floor. */
  bottomM: number;
}

export interface Rake {
  /** Rows at the front that sit on a gentle slope instead of risers. */
  frontRows?: number;
  frontSlopeM?: number;
  riserM?: number;
}

export interface RowSpec {
  label: string;
  /**
   * One character per seat-width column, centered on the screen:
   * x = seat, w = wheelchair space, | = aisle, . = no seat
   */
  seats: string;
  /** Extra distance in front of this row, such as a cross aisle. */
  gapBeforeM?: number;
  /** Extra rise at this row on top of the regular rake. */
  stepM?: number;
}

/**
 * How seats get their numbers.
 *   sequential: seats count 1, 2, 3… left to right, skipping aisles and gaps.
 *   positional: every non-aisle column counts, so a gap (".") or wheelchair
 *     space ("w") uses up numbers, the way printed seat plans often work.
 *     Wheelchair spaces get ids W1, W2… in reading order across the hall.
 */
export type Numbering = "sequential" | "positional";

export interface Layout {
  id: string;
  name: string;
  kind?: string;
  note?: string;
  screen: Screen;
  recommendedFovDeg?: number;
  firstRowM: number;
  rowSpacingM: number;
  seatWidthM: number;
  rake?: Rake;
  numbering?: Numbering;
  /** Where the dimensions come from, for layouts based on a real venue. */
  sources?: string[];
  rows: RowSpec[];
}

export interface Row {
  index: number;
  label: string;
  cells: string;
  dM: number;
  floorM: number;
  eyeM: number;
}

export interface Seat {
  id: string;
  row: number;
  rowLabel: string;
  /** Seat number within the row, counting left to right and skipping aisles. */
  number: number;
  col: number;
  offsetCol: number;
  /** Seats share a block when no aisle or gap separates them. */
  block: string;
  kind: "standard" | "wheelchair";
  xM: number;
  dM: number;
  floorM: number;
  eyeM: number;
  aisle: boolean;
}

export interface Model {
  layout: Layout;
  rows: Row[];
  seats: Seat[];
  maxCols: number;
}

export interface Metrics {
  /** Horizontal angle the screen fills. */
  fov: number;
  /** Upward angle to the center of the screen (negative = looking down). */
  lookUp: number;
  lookUpTop: number;
  offAxis: number;
  /** Distance of the mix position from the screen. */
  mixD: number;
  mixDist: number;
  mixNorm: number;
  /** Clearance over the eyes one row ahead, or null in the front row. */
  cValue: number | null;
}

export type FactorKey = "immersion" | "neck" | "centering" | "sound" | "sightline" | "aisle";

export type Weights = Record<FactorKey, number>;
export type FactorScores = Record<FactorKey, number>;

export interface Factor {
  key: FactorKey;
  label: string;
  hint: string;
}

export interface Prefs {
  /** Target horizontal field of view; null uses the layout's recommendation. */
  targetFov: number | null;
  weights: Weights;
}

export interface Preset extends Prefs {
  label: string;
  /** Where the weights come from, shown when the preset is active. */
  note?: string;
}

export interface SeatScore {
  total: number;
  factors: FactorScores;
  metrics: Metrics;
  targetFov: number;
}

export type ScoreMap = Map<string, SeatScore>;

export interface GroupBlock {
  seats: string[];
  rowLabel: string;
  from: number;
  to: number;
  avg: number;
  min: number;
  rank: number;
}
