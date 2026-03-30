"""Tests for proximity analysis — convenience score + category extraction."""

import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analyze import compute_convenience_score, extract_category, PROXIMITY_CATEGORIES

from helpers import run_analyze, TOKYO_STATION, OCEAN_POINT


# ── compute_convenience_score tests ──


def test_score_all_nearby():
    """All 6 categories within 200m → high score."""
    cats = {k: {"facilities": [{"distance_m": 100}], "count": 1} for k in PROXIMITY_CATEGORIES}
    score = compute_convenience_score(cats)
    assert score >= 90


def test_score_no_facilities():
    """No facilities at all → score 0."""
    cats = {k: {"facilities": [], "count": 0} for k in PROXIMITY_CATEGORIES}
    assert compute_convenience_score(cats) == 0


def test_score_partial_3_categories():
    """Only 3 categories with varying distances."""
    cats = {
        "grocery": {"facilities": [{"distance_m": 300}], "count": 1},
        "hospital": {"facilities": [{"distance_m": 800}], "count": 1},
        "park": {"facilities": [{"distance_m": 1200}], "count": 1},
    }
    score = compute_convenience_score(cats)
    assert 10 <= score <= 50


def test_score_distant_facilities():
    """All categories beyond 1000m → low score."""
    cats = {k: {"facilities": [{"distance_m": 1500}], "count": 1} for k in PROXIMITY_CATEGORIES}
    score = compute_convenience_score(cats)
    assert score < 30


def test_score_clamped_at_100():
    """Even extreme inputs → max 100."""
    cats = {k: {"facilities": [{"distance_m": 10}] * 20, "count": 20} for k in PROXIMITY_CATEGORIES}
    assert compute_convenience_score(cats) <= 100


def test_score_single_category():
    """Only 1 category → lower coverage bonus."""
    cats = {"grocery": {"facilities": [{"distance_m": 100}], "count": 1}}
    score = compute_convenience_score(cats)
    assert 10 <= score <= 30


def test_score_distance_tiers():
    """Closer is better: 200m scores more than 800m."""
    cats_close = {"grocery": {"facilities": [{"distance_m": 150}], "count": 1}}
    cats_far = {"grocery": {"facilities": [{"distance_m": 850}], "count": 1}}
    assert compute_convenience_score(cats_close) > compute_convenience_score(cats_far)


# ── extract_category tests ──


def test_extract_dict_primary():
    """categories is a dict with 'primary' key."""
    row = pd.Series({"categories": {"primary": "Hospital"}, "basic_category": None})
    assert extract_category(row) == "hospital"


def test_extract_basic_category():
    """Fall back to basic_category column."""
    row = pd.Series({"categories": None, "basic_category": "grocery"})
    assert extract_category(row) == "grocery"


def test_extract_case_insensitive():
    row = pd.Series({"categories": {"primary": "PARK"}, "basic_category": None})
    assert extract_category(row) == "park"


def test_extract_whitespace_stripped():
    row = pd.Series({"categories": {"primary": " park "}, "basic_category": None})
    assert extract_category(row) == "park"


def test_extract_missing_returns_none():
    row = pd.Series({"categories": None, "basic_category": None})
    assert extract_category(row) is None


def test_extract_nan_returns_none():
    row = pd.Series({"categories": float("nan"), "basic_category": float("nan")})
    assert extract_category(row) is None


# ── analyze_proximity integration tests ──


@pytest.mark.integration
def test_proximity_tokyo_returns_valid_json():
    payload = {
        "type": "proximity",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "radius_m": 1000,
    }
    result = run_analyze(json.dumps(payload))
    assert "categories" in result
    assert "score" in result
    assert "total_pois" in result


@pytest.mark.integration
def test_proximity_score_range():
    payload = {
        "type": "proximity",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "radius_m": 1000,
    }
    result = run_analyze(json.dumps(payload))
    assert 0 <= result["score"] <= 100


@pytest.mark.integration
def test_proximity_facility_structure():
    payload = {
        "type": "proximity",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "radius_m": 1000,
    }
    result = run_analyze(json.dumps(payload))
    for cat_data in result["categories"].values():
        assert "facilities" in cat_data
        assert "count" in cat_data
        for fac in cat_data["facilities"]:
            assert "name" in fac
            assert "distance_m" in fac
            assert fac["distance_m"] >= 0


@pytest.mark.integration
def test_proximity_ocean_returns_empty():
    payload = {
        "type": "proximity",
        "latitude": OCEAN_POINT["latitude"],
        "longitude": OCEAN_POINT["longitude"],
        "radius_m": 1000,
    }
    result = run_analyze(json.dumps(payload))
    assert result["score"] == 0
    assert result["total_pois"] == 0
