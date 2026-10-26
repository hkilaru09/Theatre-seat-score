import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Cinema } from "../lib/cinemas";

interface Props {
  cinemas: Cinema[];
  selected: Cinema | null;
  onSelect: (c: Cinema) => void;
}

// OpenStreetMap tiles; the attribution is required by the tile and data licenses.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function CinemaMap({ cinemas, selected, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fit = useRef(() => {});
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const m = L.map(el.current!, { worldCopyJump: true }).setView([20, 0], 2);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // Leaflet measures its box once; measure again and refit whenever the layout resizes it.
    const resize = new ResizeObserver(() => {
      m.invalidateSize();
      fit.current();
    });
    resize.observe(el.current!);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    m.invalidateSize();
    group.clearLayers();
    for (const c of cinemas) {
      const isSelected = c.id === selected?.id;
      L.circleMarker([c.lat, c.lon], {
        radius: isSelected ? 8 : 5,
        weight: 2,
        color: "#ffffff",
        fillColor: isSelected ? "#b4203b" : "#965000",
        fillOpacity: 0.9,
      })
        .bindTooltip(c.city ? `${c.name} · ${c.city}` : c.name)
        .on("click", () => select.current(c))
        .addTo(group);
    }
    fit.current = () => {
      if (selected) m.setView([selected.lat, selected.lon], Math.max(m.getZoom(), 14));
      else if (cinemas.length) m.fitBounds(L.latLngBounds(cinemas.map((c) => [c.lat, c.lon])), { padding: [24, 24], maxZoom: 13 });
    };
    fit.current();
  }, [cinemas, selected]);

  return <div ref={el} className="cinema-map" role="region" aria-label="Map of matching cinemas" />;
}
