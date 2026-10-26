interface Props {
  editing: boolean;
  onToggleEditing: () => void;
  onRandomize: () => void;
  onClear: () => void;
}

export function BookingControls({ editing, onToggleEditing, onRandomize, onClear }: Props) {
  return (
    <div className="map-actions">
      <button className="btn" type="button" aria-pressed={editing} onClick={onToggleEditing}>
        Mark seats as booked
      </button>
      <button className="btn" type="button" onClick={onRandomize}>
        New sample bookings
      </button>
      <button className="btn" type="button" onClick={onClear}>
        Clear bookings
      </button>
      <span className="map-meta">{editing ? "Click seats to book or free them." : ""}</span>
    </div>
  );
}
