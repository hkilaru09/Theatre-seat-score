"""Load and clean the Cinematheque KOFA reservation export.

Source: Korean Film Archive, "시네마테크KOFA 예매내역", data.go.kr dataset 15129428.
One row per booking. The file is CP949-encoded (not UTF-8) and has no BOM.

Seat text comes in two styles, sometimes several seats per booking:
    "O열 1번"           row O, seat 1             (all years)
    "(1층) H-16"        floor 1, row H, seat 16   (2022 onwards)
    "O열 2번 ,O열 5번"  two seats
    "휠체어석열 2번"    wheelchair space 2

Cancellation rules, checked against the data:
  * Before 2022, cancelled bookings keep their seat text, so `cancelled > 0`
    rows must be dropped, not counted.
  * From 2022, fully cancelled bookings have empty seat text, and partially
    cancelled ones list only the *cancelled* seats.
  * Before 2022, a booking for several tickets usually lists only its first
    seat. Those rows are kept with `seats_complete = False`.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1]
RAW_CSV = DATA_DIR / "raw" / "kofa_reservations.csv"
ENCODING = "cp949"

COLUMNS = {
    "예매번호": "booking_id",
    "상영관": "hall",
    "영화제목": "title",
    "상영일": "date",
    "상영시간": "time",
    "좌석번호": "seats_raw",
    "예약매수": "booked",
    "취소매수": "cancelled",
}
HALLS = {"1관": "hall1", "2관": "hall2", "3관": "hall3"}
WHEELCHAIR = "휠체어석"
WHEELCHAIR_ROW = "W"

# Seat distancing: booked neighbors almost vanish in this window (notebooks/01_explore, section 8).
DISTANCING = (pd.Timestamp("2020-04-01"), pd.Timestamp("2022-09-30 23:59"))

SEAT_RE = re.compile(
    r"(?:\((?P<floor>\d)층\)\s*)?"
    r"(?:(?P<row1>[A-Z]|휠체어석)열\s*(?P<num1>\d+)번|(?P<row2>[A-Z]|휠체어석)-(?P<num2>\d+))"
)


def parse_seats(text: object) -> list[tuple[str, int]]:
    """Seat text to a list of (row, number). Wheelchair spaces use row "W"."""
    if not isinstance(text, str):
        return []
    out = []
    for m in SEAT_RE.finditer(text):
        row = m.group("row1") or m.group("row2")
        num = int(m.group("num1") or m.group("num2"))
        out.append((WHEELCHAIR_ROW if row == WHEELCHAIR else row, num))
    return out


def load_raw(path: Path = RAW_CSV) -> pd.DataFrame:
    """Read the export with English column names, typed columns and one status per booking."""
    df = pd.read_csv(path, encoding=ENCODING, dtype={"좌석번호": "string", "영화제목": "string", "상영관": "string"})
    df = df.rename(columns=COLUMNS)
    df["hall"] = df["hall"].map(HALLS).astype("string")
    df["showtime"] = pd.to_datetime(df["date"] + " " + df["time"], format="%Y-%m-%d %H:%M")
    df = df.drop(columns=["date", "time"])
    df["seats"] = df["seats_raw"].map(parse_seats)
    df["n_seats_listed"] = df["seats"].map(len)
    df["status"] = "kept"
    df.loc[df["cancelled"] > 0, "status"] = "partial_cancel"
    df.loc[(df["cancelled"] > 0) & (df["cancelled"] >= df["booked"]), "status"] = "full_cancel"
    df["seats_complete"] = (df["status"] == "kept") & (df["n_seats_listed"] == df["booked"])
    return df.sort_values("booking_id", ignore_index=True)


def seat_bookings(df: pd.DataFrame, halls: tuple[str, ...] = ("hall1", "hall2")) -> pd.DataFrame:
    """One row per booked seat, from bookings that were not cancelled.

    `order_in_screening` ranks bookings by booking id within each screening
    (0 = first booking), which is the basis for "which seats go first".
    """
    kept = df[(df["status"] == "kept") & df["hall"].isin(halls) & (df["n_seats_listed"] > 0)]
    seats = kept[["booking_id", "hall", "title", "showtime", "booked", "seats_complete", "seats"]].explode("seats", ignore_index=True)
    seats["row"] = seats["seats"].str[0].astype("string")
    seats["number"] = seats["seats"].str[1].astype("int64")
    seats["seat_id"] = seats["row"] + seats["number"].astype("string")
    seats = seats.drop(columns="seats").rename(columns={"booked": "party_size"})
    # The same seat booked twice in one screening is a data error; keep the first booking.
    seats = seats.drop_duplicates(["hall", "showtime", "seat_id"], keep="first")
    first = seats.groupby(["hall", "showtime"])["booking_id"].rank(method="dense").astype("int64") - 1
    seats["order_in_screening"] = first
    return seats.reset_index(drop=True)


def inferred_rows(seats: pd.DataFrame, hall: str, min_count: int = 20) -> pd.DataFrame:
    """Seats seen per row, ignoring seat numbers seen fewer than `min_count` times.

    Wheelchair spaces are booked rarely, so they always count.
    """
    counts = seats[seats["hall"] == hall].groupby(["row", "number"]).size().rename("bookings").reset_index()
    keep = (counts["bookings"] >= min_count) | (counts["row"] == WHEELCHAIR_ROW)
    common = counts[keep]
    rare = counts[~keep].groupby("row")["number"].apply(list).rename("rare_numbers")
    summary = common.groupby("row").agg(seats=("number", "size"), first=("number", "min"), last=("number", "max"), bookings=("bookings", "sum"))
    return summary.join(rare).reset_index()
