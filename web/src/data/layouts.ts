import type { Layout } from "../engine";
import kofa from "./kofa_layouts.json";
import samples from "./layouts.json";

/** Sample theaters, shared with v1 (v1/data/layouts.json). */
export const SAMPLE_LAYOUTS: Layout[] = samples;

/** Cinematheque KOFA halls, written by data/notebooks/02_layouts from data/pipeline/layouts.py. */
export const KOFA_LAYOUTS = kofa as Layout[];

export const LAYOUTS: Layout[] = [...SAMPLE_LAYOUTS, ...KOFA_LAYOUTS];
