"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from "react-leaflet";
import type { PathOptions } from "leaflet";
import type { IsochroneResult, ProximityFacility } from "../../lib/city2graph/types";
import { ISOCHRONE_COLORS } from "../../lib/city2graph/colors";
import { defaultIcon, getCategoryIcon } from "./map-icons";

export interface IsochroneMapInnerProps {
  latitude: number;
  longitude: number;
  isochrone: IsochroneResult;
  facilities?: ProximityFacility[];
}

const ISOCHRONE_STYLES: Record<number, { color: string; fillOpacity: number }> = {
  5: { color: ISOCHRONE_COLORS[5], fillOpacity: 0.2 },
  10: { color: ISOCHRONE_COLORS[10], fillOpacity: 0.15 },
  15: { color: ISOCHRONE_COLORS[15], fillOpacity: 0.12 },
};

function getStyle(feature: GeoJSON.Feature): PathOptions {
  const minutes = feature.properties?.threshold_minutes ?? 0;
  const config = ISOCHRONE_STYLES[minutes] ?? { color: "#6b7280", fillOpacity: 0.1 };
  return {
    color: config.color,
    fillColor: config.color,
    fillOpacity: config.fillOpacity,
    weight: 2,
  };
}

export default function IsochroneMapInner({
  latitude,
  longitude,
  isochrone,
  facilities,
}: IsochroneMapInnerProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-bold text-slate-900">徒歩圏マップ</h3>
      <div className="relative overflow-hidden rounded-xl border border-slate-200">
        <MapContainer
          center={[latitude, longitude]}
          zoom={14}
          style={{ height: 400, width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            data={isochrone as unknown as GeoJSON.FeatureCollection}
            style={(feature) => feature ? getStyle(feature) : {}}
            onEachFeature={(feature, layer) => {
              const mins = feature.properties?.threshold_minutes;
              if (mins) layer.bindPopup(`徒歩${mins}分圏`);
            }}
          />
          <Marker position={[latitude, longitude]} icon={defaultIcon}>
            <Popup>分析地点</Popup>
          </Marker>
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
        <div className="absolute bottom-3 right-3 z-[1000] rounded-lg bg-white/90 px-3 py-2 text-xs shadow-md">
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
      </div>
    </div>
  );
}
