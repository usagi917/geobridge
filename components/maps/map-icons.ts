import L from "leaflet";
import { CATEGORY_COLORS } from "../../lib/city2graph/colors";

export { CATEGORY_COLORS };

// Fix default marker icon issue with webpack/next.js
export const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Pre-built icon caches per size to avoid recreating on every render
const iconCaches = new Map<number, Record<string, L.DivIcon>>();

function buildIconCache(size: number): Record<string, L.DivIcon> {
  const anchor = size / 2;
  const cache: Record<string, L.DivIcon> = {};
  for (const [category, color] of Object.entries(CATEGORY_COLORS)) {
    cache[category] = L.divIcon({
      className: "",
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
    });
  }
  // Default for unknown categories
  cache._default = L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#6b7280;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
  return cache;
}

export function getCategoryIcon(category: string, size: number = 10): L.DivIcon {
  let cache = iconCaches.get(size);
  if (!cache) {
    cache = buildIconCache(size);
    iconCaches.set(size, cache);
  }
  return cache[category] ?? cache._default;
}
