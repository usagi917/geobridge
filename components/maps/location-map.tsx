"use client";

import dynamic from "next/dynamic";

interface LocationMapProps {
  latitude: number;
  longitude: number;
  radiusM: number;
}

const MapInner = dynamic(() => import("./location-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
      <p className="text-sm text-slate-400">地図を読み込み中...</p>
    </div>
  ),
});

export function LocationMap(props: LocationMapProps) {
  return <MapInner {...props} />;
}
