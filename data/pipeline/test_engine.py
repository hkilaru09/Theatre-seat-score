import shutil

import pytest

from pipeline.engine import frames, score_frame
from pipeline.layouts import HALL1, HALL2

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node.js to run the TypeScript engine")


def test_engine_scores_every_seat():
    df = score_frame(HALL1)
    assert len(df) == 321
    assert df["total"].between(0, 100).all()
    assert {"f_immersion", "f_aisle", "fov", "cValue"} <= set(df.columns)


def test_engine_agrees_with_the_layout_and_target_fov():
    a, b = frames([{"layout": HALL2, "target_fov": 40}, {"layout": HALL2, "target_fov": 60}])
    assert list(a["seat_id"]) == list(b["seat_id"])
    # A wider target favors seats closer to the screen.
    front = a["row"] == "A"
    assert b.loc[front, "f_immersion"].mean() > a.loc[front, "f_immersion"].mean()
