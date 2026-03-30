import dynamic from "next/dynamic";
import type { IsochroneMapInnerProps } from "./isochrone-map-inner";

const IsochroneMapInner = dynamic<IsochroneMapInnerProps>(
  () => import("./isochrone-map-inner").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
        <span className="text-sm text-slate-400">徒歩圏マップを読み込み中...</span>
      </div>
    ),
  }
);

export function IsochroneMap(props: IsochroneMapInnerProps) {
  return <IsochroneMapInner {...props} />;
}
