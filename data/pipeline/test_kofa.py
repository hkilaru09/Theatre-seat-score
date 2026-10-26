"""Run from data/: .venv/bin/pytest -q"""

import pandas as pd
import pytest

from pipeline.kofa import load_raw, parse_seats, seat_bookings


@pytest.mark.parametrize(
    "text, want",
    [
        ("O열 1번", [("O", 1)]),
        ("M열 21번", [("M", 21)]),
        ("(1층) H-16", [("H", 16)]),
        ("O열 2번 ,O열 5번", [("O", 2), ("O", 5)]),
        ("휠체어석열 2번", [("W", 2)]),
        ("휠체어석-1", [("W", 1)]),
        ("", []),
        (pd.NA, []),
    ],
)
def test_parse_seats(text, want):
    assert parse_seats(text) == want


CSV = """예매번호,상영관,영화제목,상영일,상영시간,좌석번호,예약매수,취소매수
3,1관,Film,2021-05-01,19:00,"A열 1번 ,A열 2번",2,0
1,1관,Film,2021-05-01,19:00,B열 5번,1,0
2,1관,Film,2021-05-01,19:00,C열 3번,1,1
4,1관,Film,2021-05-01,19:00,D열 4번,2,0
5,2관,Film,2023-02-01,14:00,,2,2
6,2관,Film,2023-02-01,14:00,(1층) E-7,2,1
7,3관,Event,2023-02-01,14:00,,1,0
8,1관,Film,2021-05-01,19:00,B열 5번,1,0
"""


@pytest.fixture
def raw(tmp_path):
    p = tmp_path / "sample.csv"
    p.write_bytes(CSV.encode("cp949"))
    return load_raw(p)


def test_load_raw_reads_cp949_and_classifies(raw):
    assert list(raw["booking_id"]) == [1, 2, 3, 4, 5, 6, 7, 8]
    status = dict(zip(raw["booking_id"], raw["status"]))
    assert status[2] == "full_cancel"
    assert status[5] == "full_cancel"
    assert status[6] == "partial_cancel"
    assert status[1] == "kept"
    complete = dict(zip(raw["booking_id"], raw["seats_complete"]))
    assert complete[3] and not complete[4]  # booking 4 is 2 tickets with 1 seat listed


def test_seat_bookings_drops_cancels_and_duplicates(raw):
    seats = seat_bookings(raw)
    assert sorted(seats["seat_id"]) == ["A1", "A2", "B5", "D4"]
    assert set(seats["hall"]) == {"hall1"}
    order = dict(zip(seats["seat_id"], seats["order_in_screening"]))
    assert order["B5"] == 0  # booking 1 came first; duplicate booking 8 is dropped
    assert order["A1"] == order["A2"] == 1
