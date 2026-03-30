"""Tests for compute_bbox and round_coords utilities."""

import sys
from pathlib import Path

# Allow importing analyze.py directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analyze import compute_bbox, round_coords


# ── compute_bbox tests ──


def test_bbox_tokyo_1000m():
    """bbox should contain the center point."""
    west, south, east, north = compute_bbox(35.6812, 139.7671, 1000)
    assert west < 139.7671 < east
    assert south < 35.6812 < north


def test_bbox_dimensions_approximate():
    """1000m radius → bbox side ~0.009 degrees latitude."""
    west, south, east, north = compute_bbox(35.6812, 139.7671, 1000)
    lat_span = north - south
    assert 0.015 < lat_span < 0.020  # ~0.018 degrees for 2000m span


def test_bbox_radius_zero():
    west, south, east, north = compute_bbox(35.0, 139.0, 0)
    assert west == east
    assert south == north


def test_bbox_equator_symmetry():
    """At equator, lat_delta and lon_delta should be approximately equal."""
    west, south, east, north = compute_bbox(0, 0, 500)
    lon_span = east - west
    lat_span = north - south
    assert abs(lon_span - lat_span) < 0.001


def test_bbox_high_latitude():
    """At high latitudes, lon_delta > lat_delta (longitude shrinks)."""
    west, south, east, north = compute_bbox(60.0, 25.0, 1000)
    lon_span = east - west
    lat_span = north - south
    assert lon_span > lat_span


# ── round_coords tests ──


def test_round_polygon_coords():
    geom = {"type": "Polygon", "coordinates": [[[139.123456789, 35.123456789]]]}
    result = round_coords(geom, 6)
    assert result["coordinates"][0][0] == [139.123457, 35.123457]


def test_round_multipolygon_coords():
    geom = {
        "type": "MultiPolygon",
        "coordinates": [[[[139.9999999, 35.9999999]]]],
    }
    result = round_coords(geom, 4)
    assert result["coordinates"][0][0][0] == [140.0, 36.0]


def test_round_preserves_geometry_type():
    geom = {"type": "Polygon", "coordinates": [[[1.0, 2.0]]]}
    result = round_coords(geom, 6)
    assert result["type"] == "Polygon"

    geom2 = {"type": "MultiPolygon", "coordinates": [[[[1.0, 2.0]]]]}
    result2 = round_coords(geom2, 6)
    assert result2["type"] == "MultiPolygon"


def test_round_precision_4():
    geom = {"type": "Polygon", "coordinates": [[[139.12345678, 35.12345678]]]}
    result = round_coords(geom, 4)
    assert result["coordinates"][0][0] == [139.1235, 35.1235]
