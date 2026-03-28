"""Tests for analyze.py stdin/stdout dispatcher."""

from helpers import run_analyze


def test_empty_input_returns_error():
    result = run_analyze("")
    assert result.get("error") == "empty input"


def test_invalid_json_returns_error():
    result = run_analyze("{bad json")
    assert "error" in result
    assert "invalid JSON" in result["error"]


def test_unknown_type_returns_error():
    result = run_analyze('{"type": "unknown"}')
    assert result["error"] == "unknown type: unknown"


def test_missing_type_returns_error():
    result = run_analyze('{"latitude": 35.0}')
    assert "error" in result
    assert "missing" in result["error"].lower() or "type" in result["error"].lower()


def test_proximity_dispatches_to_handler():
    """Proximity handler returns real data (no longer a stub)."""
    result = run_analyze('{"type":"proximity","latitude":35.68,"longitude":139.77,"radius_m":1000}')
    assert "error" not in result
    assert "categories" in result
    assert "score" in result


def test_morphology_dispatches_to_handler():
    result = run_analyze('{"type":"morphology","latitude":35.68,"longitude":139.77,"radius_m":500}')
    assert "error" not in result
    assert "metrics" in result
    assert "maturity_score" in result


def test_isochrone_dispatches_to_handler():
    result = run_analyze('{"type":"isochrone","latitude":35.68,"longitude":139.77,"thresholds":[300]}')
    assert "error" not in result
    assert result["type"] == "FeatureCollection"
