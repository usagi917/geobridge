"use client";

import dynamic from "next/dynamic";

interface SatelliteOverlayMapProps {
  imageDataUrl: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
  title: string;
  valueLabel?: string;
  capturedRange: [string, string];
}

const SatelliteMapInner = dynamic(() => import("./satellite-overlay-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
      <p className="text-sm text-slate-400">地図を読み込み中...</p>
    </div>
  ),
});

export function SatelliteOverlayMap(props: SatelliteOverlayMapProps) {
  return <SatelliteMapInner {...props} />;
}
