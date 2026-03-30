"""Tests for isochrone analysis."""

import json

import pytest

from helpers import run_analyze, TOKYO_STATION, OCEAN_POINT


@pytest.mark.integration
def test_isochrone_tokyo_feature_count():
    """3 thresholds → 3 features."""
    payload = {
        "type": "isochrone",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "thresholds": [300, 600, 900],
    }
    result = run_analyze(json.dumps(payload))
    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 3


@pytest.mark.integration
def test_isochrone_feature_structure():
    payload = {
        "type": "isochrone",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "thresholds": [300, 600, 900],
    }
    result = run_analyze(json.dumps(payload))
    for feature in result["features"]:
        assert feature["type"] == "Feature"
        assert "threshold_seconds" in feature["properties"]
        assert "threshold_minutes" in feature["properties"]
        assert feature["geometry"]["type"] in ("Polygon", "MultiPolygon")


@pytest.mark.integration
def test_isochrone_sorted_descending():
    """Outer (900s) first → inner (300s) last."""
    payload = {
        "type": "isochrone",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "thresholds": [300, 600, 900],
    }
    result = run_analyze(json.dumps(payload))
    thresholds = [f["properties"]["threshold_seconds"] for f in result["features"]]
    assert thresholds == sorted(thresholds, reverse=True)


@pytest.mark.integration
def test_isochrone_coords_precision():
    """Coordinates should be rounded to 6 decimal places or fewer."""
    payload = {
        "type": "isochrone",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "thresholds": [300],
    }
    result = run_analyze(json.dumps(payload))
    if result["features"]:
        geom = result["features"][0]["geometry"]
        coords = geom["coordinates"]
        # Flatten nested coordinates to get individual numbers
        flat = _flatten_coords(coords)
        for c in flat:
            decimal_str = str(c).split(".")[-1] if "." in str(c) else ""
            assert len(decimal_str) <= 6


@pytest.mark.integration
def test_isochrone_single_threshold():
    payload = {
        "type": "isochrone",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "thresholds": [600],
    }
    result = run_analyze(json.dumps(payload))
    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 1
    assert result["features"][0]["properties"]["threshold_minutes"] == 10


@pytest.mark.integration
def test_isochrone_ocean_empty():
    """Ocean coordinates → empty features."""
    payload = {
        "type": "isochrone",
        "latitude": OCEAN_POINT["latitude"],
        "longitude": OCEAN_POINT["longitude"],
        "thresholds": [300],
    }
    result = run_analyze(json.dumps(payload))
    assert result["type"] == "FeatureCollection"
    assert result["features"] == []


def _flatten_coords(coords) -> list:
    """Recursively extract all numeric values from nested coordinate arrays."""
    if isinstance(coords, (int, float)):
        return [coords]
    result = []
    for item in coords:
        result.extend(_flatten_coords(item))
    return result
