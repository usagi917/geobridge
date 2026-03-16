"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";

interface LocationMapInnerProps {
  latitude: number;
  longitude: number;
  radiusM: number;
}

// Fix default marker icon issue with webpack/next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function LocationMapInner({
  latitude,
  longitude,
  radiusM,
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
      </MapContainer>
    </div>
  );
}
