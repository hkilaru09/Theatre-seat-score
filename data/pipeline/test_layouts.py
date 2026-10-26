from pipeline.layouts import HALL1, HALL2, aisle_seat_ids, seat_ids


def test_capacities_match_kofa():
    assert len(seat_ids(HALL1)) == 321
    assert len(seat_ids(HALL2)) == 150


def test_ids_are_unique():
    for layout in (HALL1, HALL2):
        ids = seat_ids(layout)
        assert len(ids) == len(set(ids))


def test_positional_numbers_follow_the_printed_plan():
    ids = seat_ids(HALL1)
    assert "N11" in ids and "N7" not in ids  # wheelchair spaces take seats 7-10
    assert [i for i in ids if i.startswith("O")] == [f"O{n}" for n in range(1, 7)]
    assert [i for i in ids if i.startswith("W")] == ["W1", "W2", "W3", "W4"]
    hall2 = seat_ids(HALL2)
    assert [i for i in hall2 if i.startswith("L")] == [f"L{n}" for n in range(2, 12)]
    assert [i for i in hall2 if i.startswith("M")] == ["M2", "M7", "M8", "M9", "M10", "M11"]


def test_rows_in_a_hall_have_equal_width():
    for layout in (HALL1, HALL2):
        assert len({len(r["seats"]) for r in layout["rows"]}) == 1


def test_aisle_seats():
    aisle = aisle_seat_ids(HALL1)
    assert {"A1", "A6", "A7", "A15", "A16", "A21"} <= aisle
    assert "A10" not in aisle
    assert {"A2", "A3", "A10", "A11"} <= aisle_seat_ids(HALL2)
