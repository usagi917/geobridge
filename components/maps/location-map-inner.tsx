"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import type { ProximityFacility } from "../../lib/city2graph/types";
import { defaultIcon, getCategoryIcon } from "./map-icons";

interface LocationMapInnerProps {
  latitude: number;
  longitude: number;
  radiusM: number;
  proximityFacilities?: ProximityFacility[];
}

export default function LocationMapInner({
  latitude,
  longitude,
  radiusM,
  proximityFacilities,
}: LocationMapInnerProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        style={{ height: 400, width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={defaultIcon}>
          <Popup>分析地点</Popup>
        </Marker>
        <Circle
          center={[latitude, longitude]}
          radius={radiusM}
          pathOptions={{
            color: "#0d9488",
            fillColor: "#0d9488",
            fillOpacity: 0.1,
            weight: 2,
          }}
        />
        {proximityFacilities?.map((fac, i) => (
          <Marker
            key={`poi-${fac.category}-${i}`}
            position={[fac.lat, fac.lon]}
            icon={getCategoryIcon(fac.category, 10)}
          >
            <Popup>
              <strong>{fac.name}</strong>
              <br />
              {Math.round(fac.distance_m)}m
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
