"""Call SeatScore's engine from Python.

The notebooks score seats with the exact code the web app uses
(web/src/engine), run through web/scripts/score.ts on Node 22.18+ (which runs
TypeScript directly). Nothing here re-implements the scoring.

Set SEATSCORE_ENGINE=cpp (or run `pytest --engine cpp`) to use the C++ port in
cpp/ instead. Its seatscore_cli reads and writes the same JSON and is checked
against the TypeScript engine by cpp/tests/test_parity.cpp.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "web" / "scripts" / "score.ts"
CPP_CLI = ROOT / "cpp" / "build" / "release" / "seatscore_cli"

FACTORS = ["immersion", "neck", "centering", "sound", "sightline", "aisle"]
BALANCED = {"immersion": 3, "neck": 3, "centering": 2, "sound": 2, "sightline": 3, "aisle": 0}


def engine() -> str:
    """"node" (the default) or "cpp", from SEATSCORE_ENGINE."""
    name = os.environ.get("SEATSCORE_ENGINE", "node")
    if name not in ("node", "cpp"):
        raise ValueError(f"SEATSCORE_ENGINE must be node or cpp, not {name!r}")
    return name


def engine_command() -> list[str] | None:
    """The command that runs the chosen engine, or None if it isn't available."""
    if engine() == "cpp":
        cli = Path(os.environ.get("SEATSCORE_CPP_CLI", CPP_CLI))
        return [str(cli)] if cli.is_file() else None
    node = shutil.which("node")
    return [node, str(SCRIPT)] if node else None


def score_jobs(jobs: list[dict]) -> list[dict]:
    """Run a batch of {key, layout, prefs} jobs through the engine in one call."""
    cmd = engine_command()
    if cmd is None:
        if engine() == "cpp":
            raise RuntimeError("Build the C++ engine first: cd cpp && cmake --preset release && cmake --build --preset release")
        raise RuntimeError("Node.js is needed to run the SeatScore engine (brew install node).")
    out = subprocess.run(cmd, input=json.dumps({"jobs": jobs}), capture_output=True, text=True, check=True)
    return json.loads(out.stdout)["results"]


def score_frame(layout: dict, weights: dict | None = None, target_fov: float | None = None) -> pd.DataFrame:
    """One row per seat: total score, the six factor scores and the raw metrics."""
    return frames([{"key": 0, "layout": layout, "weights": weights, "target_fov": target_fov}])[0]


def frames(specs: list[dict]) -> list[pd.DataFrame]:
    """Score several (layout, weights, target_fov) specs in one engine call."""
    jobs = [
        {"key": i, "layout": s["layout"], "prefs": {"targetFov": s.get("target_fov"), "weights": s.get("weights") or BALANCED}}
        for i, s in enumerate(specs)
    ]
    out = []
    for result in score_jobs(jobs):
        rows = []
        for seat in result["seats"]:
            rows.append({
                "seat_id": seat["id"], "row": seat["row"], "number": seat["number"], "aisle": seat["aisle"], "kind": seat["kind"],
                "total": seat["total"], **{f"f_{k}": v for k, v in seat["factors"].items()}, **seat["metrics"],
            })
        out.append(pd.DataFrame(rows))
    return out
