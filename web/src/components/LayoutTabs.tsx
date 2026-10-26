import type { Layout } from "../engine";

interface Props {
  layouts: Layout[];
  index: number;
  onSelect: (index: number) => void;
}

export function LayoutTabs({ layouts, index, onSelect }: Props) {
  return (
    <nav className="tabs" role="tablist" aria-label="Theater">
      {layouts.map((L, i) => (
        <button key={L.id} className="tab" type="button" role="tab" aria-selected={i === index} onClick={() => onSelect(i)}>
          {L.name}
        </button>
      ))}
    </nav>
  );
}
