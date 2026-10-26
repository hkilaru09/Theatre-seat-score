import type { GroupBlock } from "../engine";
import { MAX_GROUP } from "../state";

interface Props {
  size: number;
  groups: GroupBlock[];
  active: number;
  onSize: (size: number) => void;
  onPick: (index: number) => void;
}

export function GroupFinder({ size, groups, active, onSize, onPick }: Props) {
  return (
    <section className="panel" aria-labelledby="group-title">
      <div className="panel-head">
        <h2 id="group-title">Seats together</h2>
        <span className="eyebrow">Open seats, side by side</span>
      </div>
      <div className="group-row">
        <div className="stepper" role="group" aria-label="Group size">
          <button type="button" aria-label="Fewer people" disabled={size <= 1} onClick={() => onSize(size - 1)}>
            &minus;
          </button>
          <output aria-live="polite">{size}</output>
          <button type="button" aria-label="More people" disabled={size >= MAX_GROUP} onClick={() => onSize(size + 1)}>
            +
          </button>
        </div>
        <span className="map-meta">{size === 1 ? "person" : "people"}</span>
      </div>
      <ol className="results">
        {groups.length === 0 ? (
          <li>
            <p className="empty">No {size} open seats sit side by side. Try a smaller group or clear some bookings.</p>
          </li>
        ) : (
          groups.map((g, i) => (
            <li key={g.seats.join()}>
              <button className="result" type="button" aria-pressed={i === active} onClick={() => onPick(i)}>
                <span className="rank">{i + 1}</span>
                <span>
                  <span className="where">
                    Row {g.rowLabel}, seats {g.from}
                    {g.to !== g.from ? `–${g.to}` : ""}
                  </span>
                  <br />
                  <span className="detail">Lowest seat {g.min}</span>
                </span>
                <span className="avg">{Math.round(g.avg)}</span>
              </button>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
