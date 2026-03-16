"""Generate report images from JAXA raster PNGs and aggregated chart data.

Reads JSON from stdin, writes JSON to stdout.

Input format:
{
  "visualizations": [
    {
      "id": "ndvi" | "lst" | "precipitation",
      "title": "...",
      "imageDataUrl": "data:image/png;base64,...",
      "bbox": [west, south, east, north],
      "center": [lon, lat],
      "min": number | null,
      "max": number | null,
      "unit": "..." | null
    }
  ],
  "charts": [
    {
      "id": "annual-precipitation",
      "title": "...",
      "description": "...",
      "unit": "mm/年",
      "points": [
        { "label": "2021", "value": 1234.5 }
      ]
    }
  ]
}

Output format:
{
  "maps": [
    {
      "id": "ndvi",
      "imageDataUrl": "data:image/png;base64,..."
    }
  ],
  "charts": [
    {
      "id": "annual-precipitation",
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
import numpy as np
from PIL import Image

# Try to use a CJK-capable font for Japanese labels
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


COLORMAPS: dict[str, str] = {
    "ndvi": "YlGn",
    "lst": "YlOrRd",
    "precipitation": "Blues",
}

COLORBAR_LABELS: dict[str, str] = {
    "ndvi": "NDVI",
    "lst": "地表面温度",
    "precipitation": "降水量",
}


def decode_data_url(data_url: str) -> Image.Image:
    """Decode a data:image/png;base64,... URL into a PIL Image."""
    header, encoded = data_url.split(",", 1)
    raw = base64.b64decode(encoded)
    return Image.open(io.BytesIO(raw))


def generate_map(vis: dict[str, Any]) -> str | None:
    """Generate a single annotated map image and return as data URL."""
    try:
        img = decode_data_url(vis["imageDataUrl"])
        arr = np.array(img.convert("RGBA"))

        bbox = vis["bbox"]  # [west, south, east, north]
        west, south, east, north = bbox
        center_lon, center_lat = vis.get("center", [(west + east) / 2, (south + north) / 2])

        layer_id: str = vis["id"]
        cmap_name = COLORMAPS.get(layer_id, "viridis")
        cbar_label = COLORBAR_LABELS.get(layer_id, layer_id)

        unit = vis.get("unit") or ""
        if unit:
            cbar_label = f"{cbar_label} ({unit})"

        vmin = vis.get("min")
        vmax = vis.get("max")

        fig, ax = plt.subplots(figsize=(8, 8))

        # Convert RGBA to grayscale intensity for colormap overlay
        gray = np.mean(arr[:, :, :3], axis=2) / 255.0
        alpha_channel = arr[:, :, 3] / 255.0

        extent = [west, east, south, north]
        im = ax.imshow(
            gray,
            extent=extent,
            origin="upper",
            cmap=cmap_name,
            alpha=0.85,
            vmin=0.0,
            vmax=1.0,
            aspect="auto",
        )

        # Apply original alpha as a mask overlay (white where transparent)
        mask = np.ones((*gray.shape, 4))
        mask[:, :, 3] = 1.0 - alpha_channel
        ax.imshow(mask, extent=extent, origin="upper", aspect="auto")

        # Center point marker
        ax.plot(
            center_lon, center_lat, "r+",
            markersize=15, markeredgewidth=2.5,
            zorder=10,
        )

        # Colorbar
        cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
        if vmin is not None and vmax is not None:
            cbar.set_ticks([0.0, 0.25, 0.5, 0.75, 1.0])
            tick_values = [
                vmin + (vmax - vmin) * t
                for t in [0.0, 0.25, 0.5, 0.75, 1.0]
            ]
            cbar.set_ticklabels([f"{v:.2f}" for v in tick_values])
        cbar.set_label(cbar_label, fontsize=10)

        ax.set_xlabel("経度 (\u00b0E)", fontsize=11)
        ax.set_ylabel("緯度 (\u00b0N)", fontsize=11)
        ax.set_title(vis.get("title", layer_id), fontsize=13, fontweight="bold", pad=12)

        ax.tick_params(labelsize=9)

        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
        plt.close(fig)

        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode("ascii")
        return f"data:image/png;base64,{b64}"

    except Exception as e:
        print(f"[visualize] Error generating {vis.get('id', '?')}: {e}", file=sys.stderr)
        return None


def generate_line_chart(chart: dict[str, Any]) -> str | None:
    """Generate a line chart image from labeled numeric points."""
    try:
        points = chart.get("points") or []
        if not points:
            return None

        labels = [str(point["label"]) for point in points]
        values = [float(point["value"]) for point in points]
        x_positions = np.arange(len(labels))
        title = chart.get("title", chart.get("id", "chart"))
        description = chart.get("description")
        unit = chart.get("unit") or ""

        fig, ax = plt.subplots(figsize=(8, 4.8))

        ax.plot(
            x_positions,
            values,
            color="#2563eb",
            linewidth=2.5,
            marker="o",
            markersize=6,
            markerfacecolor="#ffffff",
            markeredgewidth=2,
        )
        ax.fill_between(x_positions, values, np.zeros(len(values)), color="#93c5fd", alpha=0.18)
        ax.grid(axis="y", color="#cbd5e1", linestyle="--", linewidth=0.8, alpha=0.8)
        ax.set_axisbelow(True)

        for idx, value in enumerate(values):
            ax.annotate(
                f"{value:,.0f}",
                (x_positions[idx], value),
                textcoords="offset points",
                xytext=(0, 8),
                ha="center",
                fontsize=9,
                color="#1e3a8a",
            )

        ax.set_title(title, fontsize=13, fontweight="bold", pad=14)
        if description:
            fig.text(0.125, 0.92, description, fontsize=9, color="#64748b")

        ax.set_xlabel("年", fontsize=10)
        ax.set_ylabel(unit or "値", fontsize=10)
        ax.set_xticks(x_positions, labels)
        ax.tick_params(axis="x", labelsize=10)
        ax.tick_params(axis="y", labelsize=9)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_color("#cbd5e1")
        ax.spines["bottom"].set_color("#cbd5e1")
        ax.set_ylim(bottom=0)

        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
        plt.close(fig)

        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode("ascii")
        return f"data:image/png;base64,{b64}"
    except Exception as e:
        print(f"[visualize] Error generating chart {chart.get('id', '?')}: {e}", file=sys.stderr)
        return None


def main() -> None:
    raw = sys.stdin.read()
    if not raw.strip():
        json.dump({"maps": [], "charts": []}, sys.stdout)
        return

    data = json.loads(raw)
    visualizations = data.get("visualizations", [])
    charts = data.get("charts", [])

    maps: list[dict[str, str]] = []
    for vis in visualizations:
        result = generate_map(vis)
        if result is not None:
            maps.append({"id": vis["id"], "imageDataUrl": result})

    generated_charts: list[dict[str, Any]] = []
    for chart in charts:
        result = generate_line_chart(chart)
        if result is not None:
            chart_payload: dict[str, Any] = {
                "id": chart["id"],
                "title": chart.get("title", chart["id"]),
                "imageDataUrl": result,
            }
            if chart.get("description"):
                chart_payload["description"] = chart["description"]
            generated_charts.append(chart_payload)

    json.dump({"maps": maps, "charts": generated_charts}, sys.stdout)


if __name__ == "__main__":
    main()
