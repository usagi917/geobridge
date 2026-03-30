"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, GeoJSON } from "react-leaflet";
import type { PathOptions } from "leaflet";
import type { IsochroneResult, ProximityFacility } from "../../lib/city2graph/types";
import { ISOCHRONE_COLORS, CATEGORY_COLORS } from "../../lib/city2graph/colors";
import { CATEGORIES, type CategoryKey } from "../../lib/city2graph/categories";
import { defaultIcon, getCategoryIcon } from "./map-icons";

export interface AnalysisMapInnerProps {
  lat: number;
  lng: number;
  radiusM: number;
  isochrone?: IsochroneResult | null;
  facilities?: ProximityFacility[];
}

const ISOCHRONE_STYLES: Record<number, { color: string; fillOpacity: number }> = {
  5: { color: ISOCHRONE_COLORS[5], fillOpacity: 0.2 },
  10: { color: ISOCHRONE_COLORS[10], fillOpacity: 0.15 },
  15: { color: ISOCHRONE_COLORS[15], fillOpacity: 0.12 },
};

function getIsochroneStyle(feature: GeoJSON.Feature): PathOptions {
  const minutes = feature.properties?.threshold_minutes ?? 0;
  const config = ISOCHRONE_STYLES[minutes] ?? { color: "#6b7280", fillOpacity: 0.1 };
  return {
    color: config.color,
    fillColor: config.color,
    fillOpacity: config.fillOpacity,
    weight: 2,
  };
}

function MapLegend({
  hasIsochrone,
  presentCategories,
}: {
  hasIsochrone: boolean;
  presentCategories: CategoryKey[];
}) {
  const [open, setOpen] = useState(false);
  const hasContent = hasIsochrone || presentCategories.length > 0;

  if (!hasContent) return null;

  return (
    <div className="absolute bottom-3 right-3 z-[1000] rounded-lg bg-white/90 text-xs shadow-md">
      {/* モバイル: トグルボタン、sm以上: 常時展開 */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 sm:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="凡例を開閉"
      >
        <span className="font-medium text-slate-600">凡例</span>
        <span className={`ml-2 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      <div className={`px-3 pb-2 ${open ? "" : "hidden"} sm:block sm:pt-2`}>
        {hasIsochrone && (
          <div className="mb-1.5 border-b border-slate-200 pb-1.5">
            {Object.entries(ISOCHRONE_STYLES).map(([mins, { color }]) => (
              <div key={mins} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: color, opacity: 0.6 }}
                />
                <span>徒歩{mins}分</span>
              </div>
            ))}
          </div>
        )}
        {presentCategories.length > 0 && (
          <div>
            {presentCategories.map((key) => {
              const cat = CATEGORIES.find((c) => c.key === key);
              const color = CATEGORY_COLORS[key];
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>{cat?.label ?? key}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalysisMapInner({
  lat,
  lng,
  radiusM,
  isochrone,
  facilities,
}: AnalysisMapInnerProps) {
  const hasIsochrone = isochrone != null && isochrone.features.length > 0;
  const hasFacilities = facilities != null && facilities.length > 0;
  const zoom = hasIsochrone ? 14 : 15;

  // Collect present POI categories for legend
  const presentCategories = hasFacilities
    ? [...new Set(facilities.map((f) => f.category))].filter((k) => k in CATEGORY_COLORS)
    : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h3 className="mb-3 text-lg font-bold text-slate-900 sm:mb-4">
        {hasIsochrone ? "分析地図（徒歩圏 + POI）" : "分析地点マップ"}
      </h3>
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200"
        role="img"
        aria-label="分析地点と周辺施設の地図"
      >
        <MapContainer
          center={[lat, lng]}
          zoom={zoom}
          className="h-[300px] sm:h-[400px]"
          style={{ width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Isochrone polygons */}
          {hasIsochrone && (
            <GeoJSON
              data={isochrone as unknown as GeoJSON.FeatureCollection}
              style={(feature) => (feature ? getIsochroneStyle(feature) : {})}
              onEachFeature={(feature, layer) => {
                const mins = feature.properties?.threshold_minutes;
                if (mins) layer.bindPopup(`徒歩${mins}分圏`);
              }}
            />
          )}

          {/* Radius circle: dashed when isochrone present, solid otherwise */}
          <Circle
            center={[lat, lng]}
            radius={radiusM}
            pathOptions={{
              color: "#0d9488",
              fillColor: "#0d9488",
              fillOpacity: hasIsochrone ? 0 : 0.1,
              weight: 2,
              dashArray: hasIsochrone ? "8 4" : undefined,
            }}
          />

          {/* Center marker */}
          <Marker position={[lat, lng]} icon={defaultIcon}>
            <Popup>分析地点</Popup>
          </Marker>

          {/* POI markers */}
          {facilities?.map((fac, i) => (
            <Marker
              key={`${fac.category}-${i}`}
              position={[fac.lat, fac.lon]}
              icon={getCategoryIcon(fac.category, 12)}
            >
              <Popup>
                <strong>{fac.name}</strong>
                <br />
                {Math.round(fac.distance_m)}m
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legend */}
        <MapLegend
          hasIsochrone={hasIsochrone}
          presentCategories={presentCategories}
        />
      </div>
    </div>
  );
}
