import { BANDS } from "../lib/bands";

export function Legend() {
  const ascending = [...BANDS].reverse();
  return (
    <div className="legend">
      {ascending.map((b, i) => {
        const next = ascending[i + 1];
        return (
          <span key={b.cls}>
            <i className={"swatch " + b.cls} />
            {b.label} {next ? `${b.min}–${next.min - 1}` : `${b.min}+`}
          </span>
        );
      })}
      <span>
        <i className="swatch taken" />
        Booked
      </span>
      <span>
        <i className="swatch sel" />
        Selected
      </span>
      <span>
        <i className="swatch mix" />
        Mix position (sound sweet spot)
      </span>
    </div>
  );
}
