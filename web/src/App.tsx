import { useCallback, useEffect, useMemo, useReducer } from "react";
import { BookingControls } from "./components/BookingControls";
import { CinemaFinder } from "./components/CinemaFinder";
import { GroupFinder } from "./components/GroupFinder";
import { LayoutTabs } from "./components/LayoutTabs";
import { Legend } from "./components/Legend";
import { Method } from "./components/Method";
import { Preferences } from "./components/Preferences";
import { SeatDetail } from "./components/SeatDetail";
import { SeatMap } from "./components/SeatMap";
import { StatsStrip } from "./components/StatsStrip";
import { LAYOUTS } from "./data/layouts";
import { PRESETS, findGroups, parseLayout, sampleBookings, scoreSeats, type Layout } from "./engine";
import { bestSeat, middleSeat } from "./lib/summary";
import { initialState, reducer, savePrefs, seedFor } from "./state";

interface Props {
  layouts?: Layout[];
}

export default function App({ layouts = LAYOUTS }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const layout = layouts[state.index];

  const model = useMemo(() => parseLayout(layout), [layout]);
  // Sample bookings use the balanced preset so they don't move when preferences change.
  const baseScores = useMemo(() => scoreSeats(model, PRESETS.balanced), [model]);
  const seed = seedFor(state, layout.id);
  const sampled = useMemo(() => sampleBookings(model, baseScores, seed), [model, baseScores, seed]);
  const taken = state.taken[layout.id] ?? sampled;

  const scores = useMemo(() => scoreSeats(model, state.prefs), [model, state.prefs]);
  const groups = useMemo(() => findGroups(model, scores, taken, state.groupSize, 3), [model, scores, taken, state.groupSize]);
  const activeGroup = state.activeGroup < groups.length ? state.activeGroup : 0;

  const recommended = groups[activeGroup] ? middleSeat(groups[activeGroup]) : (bestSeat(model, scores, taken) ?? bestSeat(model, scores)!).seat.id;
  const selectedId = state.selected && scores.has(state.selected) ? state.selected : recommended;
  const selectedSeat = model.seats.find((s) => s.id === selectedId)!;
  const targetFov = scores.get(selectedId)!.targetFov;

  const { prefs, presetKey, groupSize } = state;
  useEffect(() => savePrefs(prefs, presetKey, groupSize), [prefs, presetKey, groupSize]);

  const onSeat = useCallback(
    (id: string) => {
      if (!state.editing) return dispatch({ type: "select", seat: id });
      const next = new Set(taken);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      dispatch({ type: "setTaken", layoutId: layout.id, taken: next, seat: id });
    },
    [state.editing, taken, layout.id]
  );

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="brand">
          <h1>
            Seat<span>Score</span>
          </h1>
          <p>Every seat scored for picture, sound and sightlines, so you can pick the best one before you book.</p>
        </div>
        <LayoutTabs layouts={layouts} index={state.index} onSelect={(index) => dispatch({ type: "layout", index })} />
      </header>

      <CinemaFinder
        layouts={layouts}
        onOpenLayout={(index) => {
          dispatch({ type: "layout", index });
          document.getElementById("map-title")?.scrollIntoView?.({ behavior: "smooth" });
        }}
      />

      <StatsStrip model={model} scores={scores} taken={taken} groups={groups} groupSize={state.groupSize} />

      <div className="main">
        <section className="panel" aria-labelledby="map-title">
          <div className="panel-head">
            <h2 id="map-title">Seat map</h2>
            <span className="eyebrow">{layout.kind}</span>
          </div>
          <p className="map-meta">
            Screen {layout.screen.widthM.toFixed(1)} × {layout.screen.heightM.toFixed(1)} m · {model.rows.length} rows · {model.seats.length} seats ·
            first row {layout.firstRowM} m from the screen · {layout.note}
          </p>
          {layout.sources && (
            <details className="sources">
              <summary>Where these numbers come from</summary>
              <ul>
                {layout.sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="map-scroll">
            <SeatMap model={model} scores={scores} taken={taken} groups={groups} activeGroup={activeGroup} selected={selectedId} onSeat={onSeat} />
          </div>
          <Legend />
          <BookingControls
            editing={state.editing}
            onToggleEditing={() => dispatch({ type: "toggleEditing" })}
            onRandomize={() => dispatch({ type: "randomize", layoutId: layout.id })}
            onClear={() => dispatch({ type: "clear", layoutId: layout.id })}
          />
        </section>

        <aside className="rail">
          <GroupFinder
            size={state.groupSize}
            groups={groups}
            active={activeGroup}
            onSize={(size) => dispatch({ type: "groupSize", size })}
            onPick={(index) => dispatch({ type: "pickGroup", index, seat: middleSeat(groups[index]) })}
          />
          <SeatDetail
            model={model}
            seat={selectedSeat}
            score={scores.get(selectedId)!}
            isTaken={taken.has(selectedId)}
            weights={state.prefs.weights}
          />
          <Preferences
            presetKey={state.presetKey}
            prefs={state.prefs}
            targetFov={targetFov}
            onPreset={(key) => dispatch({ type: "preset", key, keep: selectedId })}
            onWeight={(key, value) => dispatch({ type: "weight", key, value, keep: selectedId })}
            onFov={(value) => dispatch({ type: "fov", value, keep: selectedId })}
          />
        </aside>
      </div>

      <Method />

      <footer className="foot">SeatScore v2. Sample theaters are modeled on typical room dimensions, not specific venues. Cinema directory © OpenStreetMap contributors (ODbL).</footer>
    </div>
  );
}
