import { PRESETS, type FactorKey, type PresetKey, type Prefs } from "./engine";

export const MAX_GROUP = 10;
const STORE_KEY = "seatscore:prefs:v1"; // shared with v1 so saved preferences carry over
const DEFAULT_SEED = 7;

export interface State {
  index: number;
  presetKey: PresetKey | "custom";
  prefs: Prefs;
  groupSize: number;
  /** null means "follow the recommendation": the active group's middle seat or the best open seat. */
  selected: string | null;
  activeGroup: number;
  editing: boolean;
  /** Bookings the viewer edited, by layout id. Untouched layouts use sample bookings. */
  taken: Record<string, ReadonlySet<string>>;
  seeds: Record<string, number>;
}

/**
 * Actions that change scores carry `keep`, the seat currently shown, so the
 * detail panel stays on it instead of jumping to the new recommendation.
 */
export type Action =
  | { type: "layout"; index: number }
  | { type: "preset"; key: PresetKey; keep: string }
  | { type: "weight"; key: FactorKey; value: number; keep: string }
  | { type: "fov"; value: number | null; keep: string }
  | { type: "groupSize"; size: number }
  | { type: "pickGroup"; index: number; seat: string }
  | { type: "select"; seat: string }
  | { type: "toggleEditing" }
  | { type: "setTaken"; layoutId: string; taken: ReadonlySet<string>; seat: string }
  | { type: "randomize"; layoutId: string }
  | { type: "clear"; layoutId: string };

const clonePrefs = (p: Prefs): Prefs => ({ targetFov: p.targetFov, weights: { ...p.weights } });

export function seedFor(state: State, layoutId: string): number {
  return state.seeds[layoutId] ?? DEFAULT_SEED;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "layout":
      return { ...state, index: action.index, selected: null, activeGroup: 0 };
    case "preset":
      return { ...state, presetKey: action.key, prefs: clonePrefs(PRESETS[action.key]), selected: action.keep };
    case "weight":
      return {
        ...state,
        presetKey: "custom",
        prefs: { ...state.prefs, weights: { ...state.prefs.weights, [action.key]: action.value } },
        selected: action.keep,
      };
    case "fov":
      return {
        ...state,
        presetKey: action.value === null ? state.presetKey : "custom",
        prefs: { ...state.prefs, targetFov: action.value },
        selected: action.keep,
      };
    case "groupSize":
      return { ...state, groupSize: Math.min(MAX_GROUP, Math.max(1, action.size)), activeGroup: 0, selected: null };
    case "pickGroup":
      return { ...state, activeGroup: action.index, selected: action.seat };
    case "select":
      return { ...state, selected: action.seat };
    case "toggleEditing":
      return { ...state, editing: !state.editing };
    case "setTaken":
      return { ...state, taken: { ...state.taken, [action.layoutId]: action.taken }, selected: action.seat };
    case "randomize": {
      const { [action.layoutId]: _dropped, ...rest } = state.taken;
      return { ...state, taken: rest, seeds: { ...state.seeds, [action.layoutId]: seedFor(state, action.layoutId) + 1 }, selected: null };
    }
    case "clear":
      return { ...state, taken: { ...state.taken, [action.layoutId]: new Set() }, selected: null };
  }
}

export function initialState(): State {
  const base: State = {
    index: 0,
    presetKey: "balanced",
    prefs: clonePrefs(PRESETS.balanced),
    groupSize: 2,
    selected: null,
    activeGroup: 0,
    editing: false,
    taken: {},
    seeds: {},
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    if (saved?.weights) {
      base.prefs = { targetFov: saved.targetFov ?? null, weights: { ...base.prefs.weights, ...saved.weights } };
      base.presetKey = saved.presetKey in PRESETS ? saved.presetKey : "custom";
      base.groupSize = Number(saved.groupSize) || 2;
    }
  } catch {
    /* storage unavailable; defaults are fine */
  }
  return base;
}

export function savePrefs(prefs: Prefs, presetKey: State["presetKey"], groupSize: number): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...prefs, presetKey, groupSize }));
  } catch {
    /* ignore */
  }
}
