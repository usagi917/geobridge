"""Shared test helpers for city2graph tests."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ANALYZE_PY = str(Path(__file__).resolve().parent.parent / "analyze.py")

TOKYO_STATION = {"latitude": 35.6812, "longitude": 139.7671}
OCEAN_POINT = {"latitude": 30.0, "longitude": 150.0}


def run_analyze(input_str: str) -> dict:
    """Run analyze.py via subprocess and return parsed JSON output."""
    result = subprocess.run(
        [sys.executable, ANALYZE_PY],
        input=input_str,
        capture_output=True,
        text=True,
        timeout=180,
    )
    if not result.stdout.strip():
        return {"error": f"no output, stderr: {result.stderr[:500]}"}
    return json.loads(result.stdout)
