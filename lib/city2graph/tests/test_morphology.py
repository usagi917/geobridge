"""Tests for morphology analysis — maturity score + integration."""

import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analyze import (
    _extract_building_street_facing_ratio,
    _extract_street_connectivity,
    analyze_morphology,
    compute_maturity_score,
)

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


def test_extract_street_connectivity_from_grouped_city2graph_output():
    nodes = {
        "private": pd.DataFrame(index=["a", "b", "c"]),
        "public": pd.DataFrame(index=[1, 2, 3, 4]),
    }
    edges = {
        ("public", "connected_to", "public"): pd.DataFrame(
            index=pd.MultiIndex.from_tuples(
                [(1, 2), (2, 3), (3, 4)],
                names=["from_public_id", "to_public_id"],
            )
        ),
    }

    assert _extract_street_connectivity(nodes, edges) == 1.5


def test_extract_building_street_facing_ratio_from_grouped_city2graph_output():
    nodes = {
        "private": pd.DataFrame(index=["a", "b", "c"]),
        "public": pd.DataFrame(index=[1, 2]),
    }
    edges = {
        ("private", "faced_to", "public"): pd.DataFrame(
            index=pd.MultiIndex.from_tuples(
                [("a", 1), ("a", 2), ("c", 2)],
                names=["private_id", "public_id"],
            )
        ),
    }

    assert _extract_building_street_facing_ratio(nodes, edges) == pytest.approx(2 / 3)


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
def test_morphology_tokyo_network_metrics_are_nonzero():
    payload = {
        "type": "morphology",
        "latitude": TOKYO_STATION["latitude"],
        "longitude": TOKYO_STATION["longitude"],
        "radius_m": 500,
    }
    result = run_analyze(json.dumps(payload))
    assert result["metrics"]["street_connectivity"] > 0
    assert result["metrics"]["building_street_facing_ratio"] > 0


def test_morphology_ocean_graceful(monkeypatch):
    """No building data → maturity_score=0, no crash."""
    import city2graph

    monkeypatch.setattr(
        city2graph,
        "load_overture_data",
        lambda **_: {
            "building": pd.DataFrame(),
            "segment": pd.DataFrame(),
        },
    )

    result = analyze_morphology({
        "latitude": OCEAN_POINT["latitude"],
        "longitude": OCEAN_POINT["longitude"],
        "radius_m": 500,
    })
    assert "maturity_score" in result
    assert result["maturity_score"] == 0
