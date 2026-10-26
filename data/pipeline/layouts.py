"""SeatScore layouts for the two Cinematheque KOFA halls.

Seat plans come from KOFA's official seat maps and were checked seat by seat
against the booking data (notebooks/02_layouts). Screen sizes are official.
Distances and heights are estimates, marked as such in `sources`.

Rows use SeatScore's layout format with positional numbering:
    x = seat, w = wheelchair space, | = aisle, . = no seat for sale
Every non-aisle column uses up a printed seat number, and wheelchair spaces
are named W1, W2... in reading order, matching the booking system.
"""
from __future__ import annotations

import json
from pathlib import Path

WEB_LAYOUTS = Path(__file__).resolve().parents[2] / "web" / "src" / "data" / "kofa_layouts.json"

OFFICIAL_INFO = "https://www.koreafilm.or.kr/pages/PC_00000004"

# Hall 1: three blocks, seats 1-6 | 7-15 | 16-21. Row S sits between J and K.
H1_FULL = "xxxxxx|xxxxxxxxx|xxxxxx"
HALL1 = {
    "id": "kofa1",
    "name": "KOFA Hall 1",
    "kind": "Cinematheque KOFA, Seoul · 2.34:1 screen",
    "note": "Real seat plan from KOFA's map. Distances and heights are estimates.",
    "screen": {"widthM": 12.64, "heightM": 5.40, "bottomM": 1.5},
    "recommendedFovDeg": 40,
    "firstRowM": 5.0,
    "rowSpacingM": 1.0,
    "seatWidthM": 0.55,
    "rake": {"frontRows": 0, "frontSlopeM": 0, "riserM": 0.15},
    "numbering": "positional",
    "rows": [
        *({"label": r, "seats": H1_FULL} for r in "ABCDEFGHIJ"),
        {"label": "S", "seats": H1_FULL, "gapBeforeM": 1.0, "stepM": 0.35},
        *({"label": r, "seats": H1_FULL} for r in "KLM"),
        # Two wheelchair spaces take the width of seats 7-10.
        {"label": "N", "seats": "xxxxxx|ww..xxxxx|xxxxxx"},
        # Only O1-O6 are ever sold. O11-O17 are on the map but never appear in
        # nine years of bookings, so they are left out. Wheelchair spaces sit at the right.
        {"label": "O", "seats": "xxxxxx|.........|..ww.."},
    ],
    "sources": [
        f"Seat plan and screen size (12.64 × 5.40 m): KOFA visitor guide, {OFFICIAL_INFO}",
        "Seat set cross-checked against 440k booked seats, 2017-2026 (data.go.kr 15129428)",
        "Row S position (between J and K): KOFA seat map. Open space in front and a big step up: comments on a muko.kr viewer review; modelled as a 1.0 m cross aisle and +0.35 m step (estimate)",
        "Screen bottom 1.5 m: the same review says the screen sits high and front rows strain the neck (estimate)",
        "First row 5.0 m, row spacing 1.0 m, riser 0.15 m, seat width 0.55 m: typical values, not measured",
    ],
}

# Hall 2: three blocks, seats 1-2 | 3-10 | 11-12.
H2_FULL = "xx|xxxxxxxx|xx"
HALL2 = {
    "id": "kofa2",
    "name": "KOFA Hall 2",
    "kind": "Cinematheque KOFA, Seoul · 1.85:1 screen",
    "note": "Real seat plan from KOFA's map. Distances and heights are estimates.",
    "screen": {"widthM": 8.60, "heightM": 4.65, "bottomM": 1.2},
    "recommendedFovDeg": 40,
    "firstRowM": 4.0,
    "rowSpacingM": 0.95,
    "seatWidthM": 0.55,
    "rake": {"frontRows": 0, "frontSlopeM": 0, "riserM": 0.15},
    "numbering": "positional",
    "rows": [
        *({"label": r, "seats": H2_FULL} for r in "ABCDEFGHIJK"),
        {"label": "L", "seats": ".x|xxxxxxxx|x."},
        # Two wheelchair spaces take the width of seats 3-6.
        {"label": "M", "seats": ".x|ww..xxxx|x."},
    ],
    "sources": [
        f"Seat plan and screen size (8.60 × 4.65 m): KOFA visitor guide, {OFFICIAL_INFO}",
        "Seat set cross-checked against 440k booked seats, 2017-2026 (data.go.kr 15129428)",
        "First row 4.0 m, row spacing 0.95 m, riser 0.15 m, screen bottom 1.2 m, seat width 0.55 m: typical values, not measured",
    ],
}

KOFA_LAYOUTS = [HALL1, HALL2]
HALL_IDS = {"hall1": "kofa1", "hall2": "kofa2"}


def seat_ids(layout: dict) -> list[str]:
    """Seat ids in reading order, using the same positional rule as the web engine."""
    ids, wheelchairs = [], 0
    for row in layout["rows"]:
        number = 0
        for ch in row["seats"]:
            if ch == "|":
                continue
            number += 1
            if ch == "x":
                ids.append(f"{row['label']}{number}")
            elif ch == "w":
                wheelchairs += 1
                ids.append(f"W{wheelchairs}")
    return ids


def aisle_seat_ids(layout: dict) -> set[str]:
    """Seats next to an aisle or at a row end, using the same rule as the web engine."""
    out, wheelchairs = set(), 0
    for row in layout["rows"]:
        cells, number = row["seats"], 0
        for c, ch in enumerate(cells):
            if ch == "|":
                continue
            number += 1
            if ch not in "xw":
                continue
            if ch == "w":
                wheelchairs += 1
            edge = lambda n: n < 0 or n >= len(cells) or cells[n] == "|"
            if edge(c - 1) or edge(c + 1):
                out.add(f"W{wheelchairs}" if ch == "w" else f"{row['label']}{number}")
    return out


def write_web_layouts(path: Path = WEB_LAYOUTS) -> Path:
    path.write_text(json.dumps(KOFA_LAYOUTS, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path
