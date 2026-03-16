"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { MapContainer, TileLayer, ImageOverlay } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";

interface SatelliteOverlayMapInnerProps {
  imageDataUrl: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
  title: string;
  valueLabel?: string;
  capturedRange: [string, string];
}

export default function SatelliteOverlayMapInner({
  imageDataUrl,
  bbox,
  title,
  valueLabel,
  capturedRange,
}: SatelliteOverlayMapInnerProps) {
  const [opacity, setOpacity] = useState(0.7);

  const [west, south, east, north] = bbox;
  const centerLat = (south + north) / 2;
  const centerLon = (west + east) / 2;
  const bounds: LatLngBoundsExpression = [
    [south, west],
    [north, east],
  ];

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
      <div className="flex items-start justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-400">
            {capturedRange[0].slice(0, 10)} 〜 {capturedRange[1].slice(0, 10)}
          </p>
        </div>
        {valueLabel && (
          <span className="rounded-full bg-terra-50 px-2 py-1 text-[11px] font-medium text-terra-700">
            {valueLabel}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <MapContainer
            center={[centerLat, centerLon]}
            zoom={13}
            style={{ height: 280, width: "100%" }}
            scrollWheelZoom={false}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ImageOverlay url={imageDataUrl} bounds={bounds} opacity={opacity} />
          </MapContainer>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">透過</span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity * 100}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-terra-500"
          />
          <span className="min-w-[3ch] text-right text-xs text-slate-500">{Math.round(opacity * 100)}%</span>
        </div>
      </div>
    </article>
  );
}
