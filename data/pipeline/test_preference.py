import numpy as np
import pandas as pd

from pipeline.preference import grid_spearman, seat_measures, spearman, weight_grid


def bookings(rows):
    """rows: (showtime, seat_id, order_in_screening)"""
    df = pd.DataFrame(rows, columns=["showtime", "seat_id", "order_in_screening"])
    df["showtime"] = pd.to_datetime(df["showtime"])
    df["hall"] = "hall1"
    df["row"] = df["seat_id"].str[0]
    return df


def test_seat_measures():
    # Two screenings with five bookings each. A1 always goes first, E5 always last.
    rows = []
    for show in ["2019-01-01 19:00", "2019-01-02 19:00"]:
        for i, seat in enumerate(["A1", "B2", "C3", "D4", "E5"]):
            rows.append((show, seat, i))
    rows.append(("2019-01-02 19:00", "W1", 5))  # wheelchair spaces are ignored
    m = seat_measures(bookings(rows)).set_index("seat_id")
    assert "W1" not in m.index
    assert m.loc["A1", "booking_rate"] == 1.0
    assert m.loc["A1", "early_rate"] == 1.0  # first 20% of 5 bookings = 1 booking
    assert m.loc["B2", "early_rate"] == 0.0
    assert m.loc["A1", "order_pct"] == 0.0
    assert m.loc["E5", "order_pct"] == 1.0


def test_spearman_ignores_missing():
    assert spearman([1, 2, 3, np.nan], [10, 20, 30, 0]) == 1.0
    assert spearman([1, 2, 3], [3, 2, 1]) == -1.0


def test_weight_grid_covers_slider_space():
    g = weight_grid()
    assert g.shape == (6**6 - 1, 6)
    assert g.min() == 0 and g.max() == 5


def test_grid_spearman_matches_direct_computation():
    rng = np.random.default_rng(1)
    f = rng.random((40, 6))
    target = f[:, 0] * 3 + f[:, 3] + rng.random(40) * 0.1
    grid = weight_grid(range(3))
    fast = grid_spearman(f, target, grid)
    for i in [0, 5, 100, len(grid) - 1]:
        w = grid[i]
        assert np.isclose(fast[i], spearman(f @ w / w.sum(), target))
    best = grid[np.nanargmax(fast)]
    assert best[0] == best.max()  # immersion-like factor gets the top weight
