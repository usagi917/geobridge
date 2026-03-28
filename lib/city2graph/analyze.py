"""city2graph analysis dispatcher — stdin JSON → stdout JSON."""

from __future__ import annotations

import json
import sys
import traceback

import math

import numpy as np


def compute_bbox(lat: float, lon: float, radius_m: float) -> tuple[float, float, float, float]:
    """Return (west, south, east, north) bounding box from center + radius."""
    lat_delta = radius_m / 111_320
    cos_lat = math.cos(math.radians(lat)) if lat != 90 and lat != -90 else 0
    lon_delta = radius_m / (111_320 * cos_lat) if cos_lat > 0 else 0
    return (lon - lon_delta, lat - lat_delta, lon + lon_delta, lat + lat_delta)


def _round_nested(coords: list, precision: int) -> list:
    """Recursively round coordinate arrays."""
    if isinstance(coords, (int, float)):
        return round(coords, precision)
    return [_round_nested(c, precision) for c in coords]


def round_coords(geom: dict, precision: int = 6) -> dict:
    """Round all coordinate values in a GeoJSON geometry to *precision* decimals."""
    return {
        **geom,
        "coordinates": _round_nested(geom["coordinates"], precision),
    }


# ── Proximity constants and helpers ──

PROXIMITY_CATEGORIES: dict[str, list[str]] = {
    "grocery": ["grocery", "supermarket", "food"],
    "hospital": ["hospital", "clinic", "doctor", "medical", "pharmacy"],
    "school": ["school", "education", "university", "college", "kindergarten"],
    "convenience": ["convenience", "convenience_store"],
    "park": ["park", "garden", "playground", "recreation"],
    "restaurant": ["restaurant", "cafe", "coffee", "fast_food", "food_court"],
}

DISTANCE_TIERS: list[tuple[float, int]] = [
    (200, 15),
    (500, 12),
    (800, 8),
    (1000, 5),
    (float("inf"), 2),
]

COVERAGE_BONUS: dict[int, int] = {6: 10, 5: 8, 4: 6, 3: 4, 2: 2, 1: 1, 0: 0}


def compute_convenience_score(categories: dict) -> int:
    """Compute a 0-100 convenience score from categorized facility data."""
    total = 0
    covered = 0

    for cat_data in categories.values():
        facilities = cat_data.get("facilities", [])
        if not facilities:
            continue
        covered += 1
        nearest_dist = facilities[0].get("distance_m", float("inf"))
        for max_dist, points in DISTANCE_TIERS:
            if nearest_dist <= max_dist:
                total += points
                break

    bonus = COVERAGE_BONUS.get(covered, 0)
    return min(100, total + bonus)


def extract_category(row) -> str | None:
    """Extract a lowercase category string from an Overture place row."""
    cats = row.get("categories")
    if isinstance(cats, dict):
        primary = cats.get("primary")
        if isinstance(primary, str) and primary.strip():
            return primary.strip().lower()

    basic = row.get("basic_category")
    if isinstance(basic, str) and basic.strip():
        return basic.strip().lower()

    return None


def _match_category(raw_category: str) -> str | None:
    """Match a raw category string to one of our PROXIMITY_CATEGORIES."""
    raw_lower = raw_category.lower()
    for cat_key, keywords in PROXIMITY_CATEGORIES.items():
        for kw in keywords:
            if kw in raw_lower:
                return cat_key
    return None


def analyze_proximity(data: dict) -> dict:
    """Analyse nearby facilities using Overture Maps Places."""
    from city2graph import load_overture_data

    lat = data["latitude"]
    lon = data["longitude"]
    radius_m = data.get("radius_m", 1000)

    bbox = compute_bbox(lat, lon, radius_m)
    result_dict = load_overture_data(
        area=bbox, types=["place"], save_to_file=False, return_data=True
    )

    places_gdf = result_dict.get("place")
    if places_gdf is None or places_gdf.empty:
        return {"categories": {}, "score": 0, "total_pois": 0}

    import geopandas as gpd
    from shapely.geometry import Point

    center = gpd.GeoDataFrame(
        [{"geometry": Point(lon, lat)}], crs="EPSG:4326"
    ).to_crs("EPSG:3857")
    places_proj = places_gdf.to_crs("EPSG:3857")

    places_gdf = places_gdf.copy()
    places_gdf["_raw_cat"] = places_gdf.apply(extract_category, axis=1)
    places_gdf["_matched_cat"] = places_gdf["_raw_cat"].apply(
        lambda c: _match_category(c) if isinstance(c, str) else None
    )
    places_gdf["_dist_m"] = places_proj.geometry.distance(center.geometry.iloc[0])

    categories_out: dict = {}
    for cat_key in PROXIMITY_CATEGORIES:
        mask = places_gdf["_matched_cat"] == cat_key
        subset = places_gdf[mask].sort_values("_dist_m").head(5)

        facilities = []
        for _, row in subset.iterrows():
            name_data = row.get("names")
            name = "unknown"
            if isinstance(name_data, dict):
                name = name_data.get("primary", "unknown") or "unknown"
            elif isinstance(name_data, str):
                name = name_data

            facilities.append({
                "name": name,
                "distance_m": round(float(row["_dist_m"]), 1),
                "lat": round(float(row.geometry.y), 6),
                "lon": round(float(row.geometry.x), 6),
                "category": cat_key,
            })

        categories_out[cat_key] = {
            "facilities": facilities,
            "count": int(mask.sum()),
        }

    score = compute_convenience_score(categories_out)

    return {
        "categories": categories_out,
        "score": score,
        "total_pois": len(places_gdf),
    }


# ── Morphology constants and helpers ──


def compute_maturity_score(density: float, connectivity: float, facing: float) -> int:
    """Compute a 0-100 urban maturity score from morphological metrics.

    Weights: density 40%, connectivity 30%, facing ratio 30%.
    """
    density_score = min(max(density, 0), 2000) / 2000 * 40
    connectivity_score = min(max(connectivity, 0), 6) / 6 * 30
    facing_score = min(max(facing, 0), 1.0) * 30
    return min(100, round(density_score + connectivity_score + facing_score))


def analyze_morphology(data: dict) -> dict:
    """Analyse urban block structure using Overture Maps Buildings + Segments."""
    from city2graph import load_overture_data, process_overture_segments, morphological_graph

    lat = data["latitude"]
    lon = data["longitude"]
    radius_m = data.get("radius_m", 500)

    bbox = compute_bbox(lat, lon, radius_m)
    result_dict = load_overture_data(
        area=bbox, types=["building", "segment"], save_to_file=False, return_data=True
    )

    buildings_gdf = result_dict.get("building")
    segments_gdf = result_dict.get("segment")

    empty_result = {
        "metrics": {
            "building_count": 0,
            "building_density_per_km2": 0,
            "street_connectivity": 0,
            "building_street_facing_ratio": 0,
        },
        "maturity_score": 0,
    }

    if buildings_gdf is None or buildings_gdf.empty:
        return empty_result

    if segments_gdf is None or segments_gdf.empty:
        # Can still report building count but no street metrics
        area_km2 = (radius_m * 2 / 1000) ** 2 * math.pi / 4
        building_count = len(buildings_gdf)
        density = building_count / area_km2 if area_km2 > 0 else 0
        return {
            "metrics": {
                "building_count": building_count,
                "building_density_per_km2": round(density, 1),
                "street_connectivity": 0,
                "building_street_facing_ratio": 0,
            },
            "maturity_score": compute_maturity_score(density, 0, 0),
        }

    # Project to a metric CRS for accurate calculations
    buildings_proj = buildings_gdf.to_crs("EPSG:3857")
    segments_proj = segments_gdf.to_crs("EPSG:3857")

    processed_segments = process_overture_segments(segments_proj, get_barriers=True)

    try:
        nodes_dict, edges_dict = morphological_graph(buildings_proj, processed_segments)
    except Exception:
        # Fallback: just report building metrics
        area_km2 = (radius_m * 2 / 1000) ** 2 * math.pi / 4
        building_count = len(buildings_gdf)
        density = building_count / area_km2 if area_km2 > 0 else 0
        return {
            "metrics": {
                "building_count": building_count,
                "building_density_per_km2": round(density, 1),
                "street_connectivity": 0,
                "building_street_facing_ratio": 0,
            },
            "maturity_score": compute_maturity_score(density, 0, 0),
        }

    # Calculate metrics
    area_km2 = (radius_m * 2 / 1000) ** 2 * math.pi / 4
    building_count = len(buildings_gdf)
    density = building_count / area_km2 if area_km2 > 0 else 0

    # Street connectivity: average degree of public nodes
    public_nodes = [n for n, d in nodes_dict.items() if d.get("type") == "public"]
    public_edges = [e for e in edges_dict.values() if e.get("type") != "barrier"]
    if public_nodes:
        connectivity = len(public_edges) * 2 / len(public_nodes)
    else:
        connectivity = 0

    # Building-street facing ratio
    faced_edges = [e for e in edges_dict.values() if e.get("type") == "faced_to"]
    facing_ratio = len(faced_edges) / building_count if building_count > 0 else 0
    facing_ratio = min(facing_ratio, 1.0)

    maturity = compute_maturity_score(density, connectivity, facing_ratio)

    return {
        "metrics": {
            "building_count": building_count,
            "building_density_per_km2": round(density, 1),
            "street_connectivity": round(connectivity, 2),
            "building_street_facing_ratio": round(facing_ratio, 3),
        },
        "maturity_score": maturity,
    }


def analyze_isochrone(data: dict) -> dict:
    """Generate walking isochrone polygons using osmnx + city2graph."""
    import osmnx as ox
    from city2graph import create_isochrone
    from shapely.geometry import Point, mapping

    lat = data["latitude"]
    lon = data["longitude"]
    thresholds = data.get("thresholds", [300, 600, 900])
    walk_speed_mps = 1.2  # 1.2 m/s walking speed

    # Calculate network download radius from max threshold
    max_dist = int(max(thresholds) * walk_speed_mps * 1.3)

    try:
        G = ox.graph_from_point((lat, lon), dist=max_dist, network_type="walk")
    except Exception:
        return {"type": "FeatureCollection", "features": []}

    # Add travel_time edge attribute
    for u, v, k, d in G.edges(keys=True, data=True):
        d["travel_time"] = d.get("length", 0) / walk_speed_mps

    # Convert to GeoDataFrames (create_isochrone works best with GDFs)
    nodes_gdf, edges_gdf = ox.graph_to_gdfs(G)

    center_point = Point(lon, lat)
    features = []

    # Sort thresholds descending (outer → inner) for proper rendering order
    for threshold in sorted(thresholds, reverse=True):
        try:
            iso_result = create_isochrone(
                nodes=nodes_gdf,
                edges=edges_gdf,
                center_point=center_point,
                threshold=[threshold],
                edge_attr="travel_time",
                method="concave_hull_knn",
            )
            if iso_result is not None and not iso_result.empty:
                geom = iso_result.geometry.iloc[0]
                if geom.is_empty:
                    continue
                # Convert back to EPSG:4326 if needed, then to GeoJSON
                geom_dict = mapping(geom)
                geom_dict = round_coords(geom_dict, 6)
                features.append({
                    "type": "Feature",
                    "properties": {
                        "threshold_seconds": threshold,
                        "threshold_minutes": round(threshold / 60),
                    },
                    "geometry": geom_dict,
                })
        except Exception:
            continue

    return {"type": "FeatureCollection", "features": features}


HANDLERS: dict[str, callable] = {
    "proximity": analyze_proximity,
    "morphology": analyze_morphology,
    "isochrone": analyze_isochrone,
}


def main() -> None:
    raw = sys.stdin.read().strip()

    if not raw:
        json.dump({"error": "empty input"}, sys.stdout)
        return

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        json.dump({"error": f"invalid JSON: {e}"}, sys.stdout)
        return

    request_type = data.get("type")
    if not request_type:
        json.dump({"error": "missing type field"}, sys.stdout)
        return

    handler = HANDLERS.get(request_type)
    if handler is None:
        json.dump({"error": f"unknown type: {request_type}"}, sys.stdout)
        return

    try:
        result = handler(data)
        json.dump(result, sys.stdout, default=_json_default)
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        msg = str(e) or type(e).__name__
        json.dump({"error": msg}, sys.stdout)


def _json_default(obj: object) -> object:
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


if __name__ == "__main__":
    main()
