"""Seat preference measured from KOFA bookings, and tools to compare it with SeatScore.

Three measures per seat, each over a set of screenings:
  booking_rate   share of screenings in which the seat was booked at all
  early_rate     share of screenings in which the seat was taken by one of the
                 first EARLY_SHARE of that screening's bookings, when nearly
                 every seat was still free. This is the main measure: it shows
                 what people pick when they have a choice, not what is left.
  order_pct      average booking position when booked (0 = first booking,
                 1 = last), over screenings with at least MIN_BOOKINGS bookings
"""
from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

from .kofa import DISTANCING, WHEELCHAIR_ROW

EARLY_SHARE = 0.2
MIN_BOOKINGS = 5

PERIODS = {
    "before distancing": (pd.Timestamp("2017-10-01"), DISTANCING[0]),
    "after distancing": (DISTANCING[1], pd.Timestamp("2026-12-31")),
}


def in_periods(seats: pd.DataFrame, names: list[str] | None = None) -> pd.DataFrame:
    """Keep bookings inside the named periods (default: both, i.e. everything outside the distancing window)."""
    mask = pd.Series(False, index=seats.index)
    for name in names or list(PERIODS):
        start, end = PERIODS[name]
        mask |= (seats["showtime"] >= start) & (seats["showtime"] < end)
    return seats[mask]


def seat_measures(seats: pd.DataFrame) -> pd.DataFrame:
    """Per-seat booking_rate, early_rate and order_pct, one row per (hall, seat_id). Wheelchair spaces are left out."""
    s = seats[seats["row"] != WHEELCHAIR_ROW].copy()
    key = ["hall", "showtime"]
    s["n_bookings"] = s.groupby(key)["order_in_screening"].transform("max") + 1
    s["order_pct"] = s["order_in_screening"] / (s["n_bookings"] - 1).clip(lower=1)
    early_cut = np.maximum(1, np.ceil(EARLY_SHARE * s["n_bookings"]))
    s["early"] = s["order_in_screening"] < early_cut

    n_screenings = s.groupby("hall")["showtime"].nunique().rename("n_screenings")
    g = s.groupby(["hall", "seat_id"])
    out = pd.DataFrame({
        "bookings": g.size(),
        "early": g["early"].sum(),
        "order_pct": s[s["n_bookings"] >= MIN_BOOKINGS].groupby(["hall", "seat_id"])["order_pct"].mean(),
    }).join(n_screenings, on="hall")
    out["booking_rate"] = out["bookings"] / out["n_screenings"]
    out["early_rate"] = out["early"] / out["n_screenings"]
    return out.reset_index()


def spearman(a, b) -> float:
    """Spearman rank correlation, ignoring pairs with a missing value."""
    a, b = pd.Series(np.asarray(a, dtype=float)), pd.Series(np.asarray(b, dtype=float))
    ok = a.notna() & b.notna()
    return float(a[ok].rank().corr(b[ok].rank()))


def split_half(seats: pd.DataFrame, measure: str = "early_rate", seed: int = 0) -> pd.Series:
    """How well a measure agrees with itself across two random halves of the screenings.

    This is the ceiling for any model: a score can't track the measure better
    than the measure tracks itself.
    """
    rng = np.random.default_rng(seed)
    out = {}
    for hall, h in seats.groupby("hall"):
        shows = h["showtime"].unique()
        half = set(rng.choice(shows, size=len(shows) // 2, replace=False))
        a = seat_measures(h[h["showtime"].isin(half)]).set_index("seat_id")[measure]
        b = seat_measures(h[~h["showtime"].isin(half)]).set_index("seat_id")[measure]
        out[hall] = spearman(a, b.reindex(a.index))
    return pd.Series(out, name=f"split-half {measure}")


def weight_grid(levels=range(6)) -> np.ndarray:
    """Every integer weight vector the app's sliders allow (0–5 per factor), except all zeros."""
    grid = np.array(list(itertools.product(levels, repeat=6)), dtype=float)
    return grid[grid.sum(axis=1) > 0]


def rank_columns(x: np.ndarray) -> np.ndarray:
    """Average ranks down each column (ties share a rank), so Pearson on ranks = Spearman."""
    return pd.DataFrame(x).rank(axis=0).to_numpy()


def grid_spearman(factors: np.ndarray, target: np.ndarray, grid: np.ndarray) -> np.ndarray:
    """Spearman between `target` and the weighted score for every weight vector in `grid`.

    factors: seats × 6 factor scores. Returns one correlation per grid row.
    Scores use the engine's formula, sum(w·f) / sum(w), without rounding.
    """
    scores = factors @ grid.T / grid.sum(axis=1)
    r = rank_columns(scores)
    t = pd.Series(target).rank().to_numpy()
    r = r - r.mean(axis=0)
    t = t - t.mean()
    denom = np.sqrt((r**2).sum(axis=0) * (t**2).sum())
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(denom > 0, (r * t[:, None]).sum(axis=0) / denom, np.nan)
