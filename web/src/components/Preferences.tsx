import { FACTORS, PRESETS, type FactorKey, type PresetKey, type Prefs } from "../engine";

interface Props {
  presetKey: PresetKey | "custom";
  prefs: Prefs;
  /** The field of view actually in use, including the screen's default. */
  targetFov: number;
  onPreset: (key: PresetKey) => void;
  onWeight: (key: FactorKey, value: number) => void;
  onFov: (value: number | null) => void;
}

export function Preferences({ presetKey, prefs, targetFov, onPreset, onWeight, onFov }: Props) {
  const active = presetKey === "custom" ? null : PRESETS[presetKey];
  const note = active && "note" in active ? active.note : null;
  return (
    <section className="panel" aria-labelledby="prefs-title">
      <div className="panel-head">
        <h2 id="prefs-title">What matters to you</h2>
        <span className="eyebrow">Weights from 0 to 5</span>
      </div>
      <div className="chips">
        {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
          <button key={key} className="chip" type="button" aria-pressed={presetKey === key} onClick={() => onPreset(key)}>
            {PRESETS[key].label}
          </button>
        ))}
      </div>
      {note && <p className="preset-note">{note}</p>}
      <div className="sliders">
        {FACTORS.map((f) => {
          const id = "w-" + f.key;
          return (
            <div className="slider" key={f.key}>
              <label htmlFor={id} title={f.hint}>
                {f.label}
              </label>
              <input
                type="range"
                id={id}
                min={0}
                max={5}
                step={1}
                title={f.hint}
                value={prefs.weights[f.key]}
                onChange={(e) => onWeight(f.key, Number(e.target.value))}
              />
              <output htmlFor={id}>{prefs.weights[f.key]}</output>
            </div>
          );
        })}
      </div>
      <div className="fov-row">
        <div className="line">
          <label htmlFor="fov">Screen size in your view</label>
          <span>
            <output className="mono">
              {targetFov}°{prefs.targetFov ? "" : " (screen default)"}
            </output>{" "}
            {prefs.targetFov !== null && (
              <button type="button" className="btn link" onClick={() => onFov(null)}>
                Use screen default
              </button>
            )}
          </span>
        </div>
        <input type="range" id="fov" min={26} max={70} step={1} value={targetFov} onChange={(e) => onFov(Number(e.target.value))} />
      </div>
    </section>
  );
}
