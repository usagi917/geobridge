"""Tests for morphology analysis — maturity score + integration."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analyze import compute_maturity_score

from helpers import run_analyze, TOKYO_STATION, OCEAN_POINT


# ── compute_maturity_score tests ──


def test_maturity_high_density_city():
    """Dense urban area → high score."""
    score = compute_maturity_score(density=1500, connectivity=4.0, facing=0.8)
    assert score >= 70


def test_maturity_rural():
    """Low density → low score."""
    score = compute_maturity_score(density=50, connectivity=1.0, facing=0.1)
    assert score <= 20


def test_maturity_zero_all():
    assert compute_maturity_score(0, 0, 0) == 0


def test_maturity_clamped_100():
    assert compute_maturity_score(5000, 10, 1.0) <= 100


def test_maturity_clamped_0():
    assert compute_maturity_score(-100, -5, -1) >= 0


def test_maturity_density_weight():
    """Changing density alone should change score proportionally (40% weight)."""
    low = compute_maturity_score(density=100, connectivity=3, facing=0.5)
    high = compute_maturity_score(density=1500, connectivity=3, facing=0.5)
    assert high > low
    diff = high - low
    assert 10 <= diff <= 40


def test_maturity_connectivity_weight():
    """Changing connectivity alone should affect score (30% weight)."""
    low = compute_maturity_score(density=500, connectivity=1.0, facing=0.5)
    high = compute_maturity_score(density=500, connectivity=5.0, facing=0.5)
    assert high > low


def test_maturity_facing_weight():
    """Changing facing ratio alone should affect score (30% weight)."""
    low = compute_maturity_score(density=500, connectivity=3.0, facing=0.1)
    high = compute_maturity_score(density=500, connectivity=3.0, facing=0.9)
    assert high > low


# ── analyze_morphology integration tests ──


@pytest.mark.integration
def test_morphology_tokyo_structure():
    payload = {
        "type": "morphology",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "radius_m": 500,
    }
    result = run_analyze(json.dumps(payload))
    assert "metrics" in result
    assert "maturity_score" in result


@pytest.mark.integration
def test_morphology_tokyo_has_buildings():
    payload = {
        "type": "morphology",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "radius_m": 500,
    }
    result = run_analyze(json.dumps(payload))
    assert result["metrics"]["building_count"] > 0


@pytest.mark.integration
def test_morphology_score_range():
    payload = {
        "type": "morphology",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "radius_m": 500,
    }
    result = run_analyze(json.dumps(payload))
    assert 0 <= result["maturity_score"] <= 100


@pytest.mark.integration
def test_morphology_ocean_graceful():
    """Ocean coordinates → maturity_score=0, no crash."""
    payload = {
        "type": "morphology",
        "latitude": OCEAN_POINT["latitude"],
        "longitude": OCEAN_POINT["longitude"],
        "radius_m": 500,
    }
    result = run_analyze(json.dumps(payload))
    assert "maturity_score" in result
    assert result["maturity_score"] == 0
