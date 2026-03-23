"""Generate urban graph visualizations using city2graph and OSM data.

Reads JSON from stdin, writes JSON to stdout.

Input format:
{
  "latitude": 35.6812,
  "longitude": 139.7671,
  "radius_m": 400,
  "graphs": ["morphology", "proximity", "road_centrality"]
}

Output format:
{
  "graphs": [
    {
      "id": "morphology",
      "title": "...",
      "description": "...",
      "imageDataUrl": "data:image/png;base64,..."
    }
  ]
}
"""

import base64
import io
import json
import sys
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import matplotlib.colors as mcolors
import numpy as np

# ---------------------------------------------------------------------------
# CJK font setup (shared with generate.py)
# ---------------------------------------------------------------------------
_CJK_FONTS = [
    "Hiragino Sans",
    "Hiragino Kaku Gothic Pro",
    "Noto Sans CJK JP",
    "Noto Sans JP",
    "IPAexGothic",
    "IPAPGothic",
    "Yu Gothic",
    "MS Gothic",
]


def _find_cjk_font() -> str | None:
    available = {f.name for f in fm.fontManager.ttflist}
    for name in _CJK_FONTS:
        if name in available:
            return name
    return None


_cjk_font = _find_cjk_font()
if _cjk_font:
    plt.rcParams["font.family"] = _cjk_font
    plt.rcParams["axes.unicode_minus"] = False


# ---------------------------------------------------------------------------
# Shared utilities
# ---------------------------------------------------------------------------

def fig_to_data_url(fig: plt.Figure) -> str:
    """Convert a matplotlib Figure to a base64 data URL."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def fetch_osm_data(lat: float, lon: float, radius_m: int) -> dict[str, Any]:
    """Fetch buildings and street network from OSM. Returns cached data dict."""
    import osmnx as ox

    ox.settings.use_cache = True
    ox.settings.cache_folder = "/tmp/terrascore-osm-cache"

    data: dict[str, Any] = {
        "buildings": None,
        "street_graph": None,
        "nodes_gdf": None,
        "edges_gdf": None,
        "pois": None,
    }

    # Buildings
    try:
        buildings = ox.features_from_point((lat, lon), dist=radius_m, tags={"building": True})
        if len(buildings) >= 3:
            data["buildings"] = buildings
        else:
            print(f"[graph] Only {len(buildings)} buildings found, skipping", file=sys.stderr)
    except Exception as e:
        print(f"[graph] Failed to fetch buildings: {e}", file=sys.stderr)

    # Street network
    try:
        G = ox.graph_from_point((lat, lon), dist=radius_m, network_type="all")
        data["street_graph"] = G
        nodes_gdf, edges_gdf = ox.graph_to_gdfs(G)
        data["nodes_gdf"] = nodes_gdf
        data["edges_gdf"] = edges_gdf
    except Exception as e:
        print(f"[graph] Failed to fetch street network: {e}", file=sys.stderr)

    # Amenity POIs
    try:
        tags = {
            "amenity": [
                "school", "hospital", "clinic", "kindergarten",
                "library", "pharmacy", "childcare", "nursery",
            ],
            "leisure": ["park", "playground"],
            "healthcare": True,
        }
        pois = ox.features_from_point((lat, lon), dist=radius_m, tags=tags)
        data["pois"] = pois
    except Exception as e:
        print(f"[graph] Failed to fetch amenity POIs: {e}", file=sys.stderr)

    # If POIs are too few, try wider radius
    if data["pois"] is not None and len(data["pois"]) < 3:
        try:
            tags = {
                "amenity": [
                    "school", "hospital", "clinic", "kindergarten",
                    "library", "pharmacy", "childcare", "nursery",
                ],
                "leisure": ["park", "playground"],
                "healthcare": True,
            }
            pois = ox.features_from_point((lat, lon), dist=radius_m * 2, tags=tags)
            if len(pois) > len(data["pois"]):
                data["pois"] = pois
                print(f"[graph] Expanded POI search to {radius_m * 2}m, found {len(pois)}", file=sys.stderr)
        except Exception:
            pass

    return data


# ---------------------------------------------------------------------------
# Graph 1: Urban Morphology
# ---------------------------------------------------------------------------

def generate_morphology_graph(
    osm_data: dict[str, Any],
    lat: float,
    lon: float,
    radius_m: int,
) -> dict[str, Any] | None:
    """Generate urban morphology graph visualization."""
    try:
        import geopandas as gpd
        from shapely.geometry import Point
        import city2graph as c2g

        buildings = osm_data.get("buildings")
        edges_gdf = osm_data.get("edges_gdf")

        if buildings is None or edges_gdf is None:
            print("[graph] Insufficient data for morphology graph", file=sys.stderr)
            return None

        if len(buildings) < 5:
            print(f"[graph] Only {len(buildings)} buildings, skipping morphology", file=sys.stderr)
            return None

        # Prepare building footprints — ensure polygon geometries
        buildings_proj = buildings.copy()
        buildings_proj = buildings_proj[buildings_proj.geometry.geom_type.isin(["Polygon", "MultiPolygon"])]
        if len(buildings_proj) < 5:
            print("[graph] Too few polygon buildings for morphology", file=sys.stderr)
            return None

        # Project to a metric CRS for accurate tessellation
        buildings_proj = buildings_proj.to_crs(epsg=3857)

        # Prepare street segments
        segments = edges_gdf.reset_index()
        segments_proj = segments.to_crs(epsg=3857)

        # Center point for spatial filtering (must be GeoSeries, not GeoDataFrame)
        center_series = gpd.GeoDataFrame(
            geometry=[Point(lon, lat)],
            crs="EPSG:4326",
        ).to_crs(epsg=3857).geometry

        # Build morphological graph
        nodes_dict, edges_dict = c2g.morphological_graph(
            buildings_gdf=buildings_proj,
            segments_gdf=segments_proj,
            center_point=center_series,
            distance=radius_m,
            clipping_buffer=radius_m * 1.5,
            keep_buildings=True,
            keep_segments=True,
        )

        # Visualize
        fig, ax = plt.subplots(figsize=(10, 10))
        ax.set_facecolor("#f8fafc")

        # Plot building footprints as background
        buildings_plot = buildings_proj.to_crs(epsg=4326)
        buildings_plot.plot(
            ax=ax,
            color="#cbd5e1",
            edgecolor="#94a3b8",
            linewidth=0.5,
            alpha=0.6,
        )

        # Plot streets as background
        segments_plot = segments.to_crs(epsg=4326) if segments.crs != "EPSG:4326" else segments
        segments_plot.plot(
            ax=ax,
            color="#94a3b8",
            linewidth=0.8,
            alpha=0.5,
        )

        # Plot the morphological graph using city2graph
        # Convert back to WGS84 for consistent display
        nodes_plot = {}
        for key, gdf in nodes_dict.items():
            nodes_plot[key] = gdf.to_crs(epsg=4326)
        edges_plot = {}
        for key, gdf in edges_dict.items():
            edges_plot[key] = gdf.to_crs(epsg=4326)

        node_colors = {
            "private": "#3b82f6",
            "public": "#f97316",
        }
        edge_colors = {
            ("private", "touched_to", "private"): "#93c5fd",
            ("public", "connected_to", "public"): "#fdba74",
            ("private", "faced_to", "public"): "#a78bfa",
        }

        # Plot graph nodes
        for node_type, gdf in nodes_plot.items():
            if len(gdf) > 0:
                centroids = gdf.to_crs(epsg=3857).geometry.centroid
                centroids = gpd.GeoSeries(centroids, crs="EPSG:3857").to_crs(epsg=4326)
                ax.scatter(
                    centroids.x, centroids.y,
                    c=node_colors.get(node_type, "#6b7280"),
                    s=12, alpha=0.8, zorder=5,
                    label=f"{'建物セル' if node_type == 'private' else '街路'}",
                    edgecolors="white",
                    linewidths=0.3,
                )

        # Plot graph edges
        for edge_type, gdf in edges_plot.items():
            if len(gdf) > 0:
                gdf.plot(
                    ax=ax,
                    color=edge_colors.get(edge_type, "#a3a3a3"),
                    linewidth=0.6,
                    alpha=0.5,
                    linestyle="--",
                )

        # Center marker
        ax.plot(lon, lat, "r+", markersize=18, markeredgewidth=3, zorder=15)

        ax.set_xlabel("経度 (°E)", fontsize=11)
        ax.set_ylabel("緯度 (°N)", fontsize=11)
        ax.set_title("都市形態グラフ", fontsize=14, fontweight="bold", pad=14)
        ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
        ax.tick_params(labelsize=9)

        fig.tight_layout()
        data_url = fig_to_data_url(fig)

        return {
            "id": "morphology",
            "title": "都市形態グラフ",
            "description": "建物フットプリントと街路ネットワークの空間的関係をグラフ構造で表現。青=建物セル、橙=街路セグメント。",
            "imageDataUrl": data_url,
        }

    except Exception as e:
        print(f"[graph] Error generating morphology graph: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Graph 2: Amenity Proximity (KNN)
# ---------------------------------------------------------------------------

AMENITY_COLORS: dict[str, str] = {
    "school": "#3b82f6",
    "hospital": "#ef4444",
    "clinic": "#f97316",
    "kindergarten": "#8b5cf6",
    "childcare": "#a855f7",
    "nursery": "#a855f7",
    "library": "#06b6d4",
    "pharmacy": "#10b981",
    "park": "#22c55e",
    "playground": "#84cc16",
    "healthcare": "#f43f5e",
}

AMENITY_LABELS: dict[str, str] = {
    "school": "学校",
    "hospital": "病院",
    "clinic": "診療所",
    "kindergarten": "幼稚園",
    "childcare": "保育所",
    "nursery": "保育所",
    "library": "図書館",
    "pharmacy": "薬局",
    "park": "公園",
    "playground": "遊び場",
    "healthcare": "医療施設",
}


def _classify_amenity(row: Any) -> str:
    """Classify a POI row into an amenity type string."""
    amenity = row.get("amenity", "")
    leisure = row.get("leisure", "")
    healthcare = row.get("healthcare", "")
    if isinstance(amenity, str) and amenity:
        return amenity
    if isinstance(leisure, str) and leisure:
        return leisure
    if isinstance(healthcare, str) and healthcare:
        return "healthcare"
    return "other"


def generate_proximity_graph(
    osm_data: dict[str, Any],
    lat: float,
    lon: float,
    radius_m: int,
) -> dict[str, Any] | None:
    """Generate amenity proximity KNN graph visualization."""
    try:
        import geopandas as gpd
        from shapely.geometry import Point, LineString
        import city2graph as c2g

        pois = osm_data.get("pois")
        if pois is None or len(pois) < 3:
            print("[graph] Insufficient POI data for proximity graph", file=sys.stderr)
            return None

        edges_gdf = osm_data.get("edges_gdf")

        # Prepare POI points (centroid for polygon features)
        pois_copy = pois.copy()
        pois_copy["amenity_type"] = pois_copy.apply(_classify_amenity, axis=1)
        pois_copy = pois_copy[pois_copy["amenity_type"] != "other"]

        if len(pois_copy) < 3:
            print(f"[graph] Only {len(pois_copy)} classified POIs, skipping proximity", file=sys.stderr)
            return None

        # Get centroids for polygon geometries
        pois_points = pois_copy.copy()
        pois_proj = pois_points.to_crs(epsg=3857)
        pois_proj.geometry = pois_proj.geometry.centroid
        pois_points = pois_proj.to_crs(epsg=4326)

        # Create center point GeoDataFrame
        center_gdf = gpd.GeoDataFrame(
            {"name": ["対象地点"], "amenity_type": ["target"]},
            geometry=[Point(lon, lat)],
            crs="EPSG:4326",
        )

        # Build KNN graph from amenities to center
        k = min(8, len(pois_points))
        nodes_gdf, edges_knn = c2g.knn_graph(
            gdf=pois_points,
            k=k,
            distance_metric="euclidean",
        )

        # Visualize
        fig, ax = plt.subplots(figsize=(10, 10))
        ax.set_facecolor("#f8fafc")

        # Plot streets as light background
        if edges_gdf is not None:
            segments_plot = edges_gdf.reset_index()
            if segments_plot.crs and str(segments_plot.crs) != "EPSG:4326":
                segments_plot = segments_plot.to_crs(epsg=4326)
            segments_plot.plot(
                ax=ax,
                color="#e2e8f0",
                linewidth=0.6,
                alpha=0.5,
            )

        # Draw connection lines from center to each POI
        for _, poi_row in pois_points.iterrows():
            poi_pt = poi_row.geometry
            line = LineString([(lon, lat), (poi_pt.x, poi_pt.y)])
            ax.plot(
                [lon, poi_pt.x], [lat, poi_pt.y],
                color="#94a3b8",
                linewidth=0.8,
                alpha=0.4,
                linestyle="--",
                zorder=3,
            )
            # Distance label at midpoint
            mid_x = (lon + poi_pt.x) / 2
            mid_y = (lat + poi_pt.y) / 2
            dist_m = Point(lon, lat).distance(poi_pt) * 111320  # approximate meters
            ax.annotate(
                f"{dist_m:.0f}m",
                (mid_x, mid_y),
                fontsize=7,
                color="#64748b",
                ha="center",
                va="center",
                bbox=dict(boxstyle="round,pad=0.15", facecolor="white", edgecolor="none", alpha=0.8),
                zorder=6,
            )

        # Plot POIs by type
        plotted_labels: set[str] = set()
        for _, row in pois_points.iterrows():
            atype = row["amenity_type"]
            color = AMENITY_COLORS.get(atype, "#6b7280")
            label_ja = AMENITY_LABELS.get(atype, atype)

            ax.scatter(
                row.geometry.x, row.geometry.y,
                c=color, s=60, alpha=0.9, zorder=8,
                edgecolors="white", linewidths=1.0,
                marker="o",
                label=label_ja if label_ja not in plotted_labels else None,
            )
            plotted_labels.add(label_ja)

            # Label with name if available
            name = row.get("name", "")
            if isinstance(name, str) and name and len(name) < 20:
                ax.annotate(
                    name,
                    (row.geometry.x, row.geometry.y),
                    textcoords="offset points",
                    xytext=(8, 5),
                    fontsize=7,
                    color="#334155",
                    zorder=9,
                )

        # Center marker
        ax.plot(lon, lat, "r*", markersize=20, markeredgewidth=1.5, markeredgecolor="white", zorder=15)
        ax.annotate(
            "対象地点",
            (lon, lat),
            textcoords="offset points",
            xytext=(12, -12),
            fontsize=10,
            fontweight="bold",
            color="#dc2626",
            zorder=15,
        )

        ax.set_xlabel("経度 (°E)", fontsize=11)
        ax.set_ylabel("緯度 (°N)", fontsize=11)
        ax.set_title("施設近接性マップ", fontsize=14, fontweight="bold", pad=14)
        ax.legend(
            loc="upper right",
            fontsize=8,
            framealpha=0.9,
            title="施設タイプ",
            title_fontsize=9,
        )
        ax.tick_params(labelsize=9)

        fig.tight_layout()
        data_url = fig_to_data_url(fig)

        return {
            "id": "proximity",
            "title": "施設近接性マップ",
            "description": f"対象地点から半径{radius_m}m以内の施設分布。施設タイプ別に色分けし、距離を表示。",
            "imageDataUrl": data_url,
        }

    except Exception as e:
        print(f"[graph] Error generating proximity graph: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Graph 3: Road Network Betweenness Centrality
# ---------------------------------------------------------------------------

def generate_road_centrality_graph(
    osm_data: dict[str, Any],
    lat: float,
    lon: float,
    radius_m: int,
) -> dict[str, Any] | None:
    """Generate road network betweenness centrality visualization."""
    try:
        import networkx as nx
        import geopandas as gpd

        G = osm_data.get("street_graph")
        if G is None:
            print("[graph] No street graph for road centrality", file=sys.stderr)
            return None

        if G.number_of_edges() < 10:
            print(f"[graph] Only {G.number_of_edges()} edges, skipping road centrality", file=sys.stderr)
            return None

        # Calculate edge betweenness centrality
        # For performance, use weight='length' if available
        G_undirected = G.to_undirected()
        edge_centrality = nx.edge_betweenness_centrality(G_undirected, weight="length")

        # Map centrality values to edges
        edges_gdf = osm_data["edges_gdf"].copy()
        edges_gdf = edges_gdf.reset_index()

        # Create centrality lookup
        centrality_values = []
        for _, row in edges_gdf.iterrows():
            u, v = row.get("u"), row.get("v")
            key = row.get("key", 0)
            # Try both directions (multigraph keys include edge key)
            c = edge_centrality.get(
                (u, v, key),
                edge_centrality.get(
                    (v, u, key),
                    edge_centrality.get(
                        (u, v),
                        edge_centrality.get((v, u), 0.0),
                    ),
                ),
            )
            centrality_values.append(c)

        edges_gdf["centrality"] = centrality_values

        # Normalize centrality for coloring
        c_arr = np.array(centrality_values)
        c_max = c_arr.max() if c_arr.max() > 0 else 1.0
        c_normalized = c_arr / c_max

        # Color map: low centrality (blue/thin) -> high centrality (red/thick)
        cmap = plt.cm.RdYlBu_r
        edge_colors = [cmap(v) for v in c_normalized]
        edge_widths = 0.5 + c_normalized * 4.0  # 0.5 to 4.5

        # Plot
        fig, ax = plt.subplots(figsize=(10, 10))
        ax.set_facecolor("#f8fafc")

        # Ensure WGS84
        if edges_gdf.crs and str(edges_gdf.crs) != "EPSG:4326":
            edges_gdf = edges_gdf.to_crs(epsg=4326)

        # Plot each edge individually with its color and width
        for idx, (_, row) in enumerate(edges_gdf.iterrows()):
            geom = row.geometry
            if geom is not None:
                xs, ys = geom.xy
                ax.plot(
                    xs, ys,
                    color=edge_colors[idx],
                    linewidth=edge_widths[idx],
                    alpha=0.85,
                    solid_capstyle="round",
                    zorder=3,
                )

        # Center marker
        ax.plot(lon, lat, "k+", markersize=18, markeredgewidth=3, zorder=15)
        ax.plot(lon, lat, "wo", markersize=8, markeredgewidth=0, zorder=14, alpha=0.8)

        # Colorbar
        sm = plt.cm.ScalarMappable(
            cmap=cmap,
            norm=mcolors.Normalize(vmin=0, vmax=c_max),
        )
        sm.set_array([])
        cbar = fig.colorbar(sm, ax=ax, fraction=0.046, pad=0.04)
        cbar.set_label("媒介中心性 (Betweenness Centrality)", fontsize=10)
        cbar.ax.tick_params(labelsize=9)

        ax.set_xlabel("経度 (°E)", fontsize=11)
        ax.set_ylabel("緯度 (°N)", fontsize=11)
        ax.set_title("道路ネットワーク中心性", fontsize=14, fontweight="bold", pad=14)
        ax.tick_params(labelsize=9)

        fig.tight_layout()
        data_url = fig_to_data_url(fig)

        return {
            "id": "road_centrality",
            "title": "道路ネットワーク中心性",
            "description": "Betweenness centrality で道路の重要度を可視化。赤い太線ほど交通上の重要度が高い幹線道路。",
            "imageDataUrl": data_url,
        }

    except Exception as e:
        print(f"[graph] Error generating road centrality graph: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

GRAPH_GENERATORS = {
    "morphology": generate_morphology_graph,
    "proximity": generate_proximity_graph,
    "road_centrality": generate_road_centrality_graph,
}


def main() -> None:
    raw = sys.stdin.read()
    if not raw.strip():
        json.dump({"graphs": []}, sys.stdout)
        return

    data = json.loads(raw)
    lat = data["latitude"]
    lon = data["longitude"]
    radius_m = data.get("radius_m", 400)
    requested_graphs = data.get("graphs", list(GRAPH_GENERATORS.keys()))

    # Fetch all OSM data once
    print(f"[graph] Fetching OSM data for ({lat}, {lon}) r={radius_m}m", file=sys.stderr)
    osm_data = fetch_osm_data(lat, lon, radius_m)
    print("[graph] OSM data fetched", file=sys.stderr)

    graphs: list[dict[str, Any]] = []
    for graph_id in requested_graphs:
        generator = GRAPH_GENERATORS.get(graph_id)
        if generator is None:
            print(f"[graph] Unknown graph type: {graph_id}", file=sys.stderr)
            continue

        print(f"[graph] Generating {graph_id}...", file=sys.stderr)
        result = generator(osm_data, lat, lon, radius_m)
        if result is not None:
            graphs.append(result)
            print(f"[graph] {graph_id} generated successfully", file=sys.stderr)
        else:
            print(f"[graph] {graph_id} skipped (no data or error)", file=sys.stderr)

    json.dump({"graphs": graphs}, sys.stdout)


if __name__ == "__main__":
    main()
