import dynamic from "next/dynamic";
import type { AnalysisMapInnerProps } from "./analysis-map-inner";

const AnalysisMapInner = dynamic<AnalysisMapInnerProps>(
  () => import("./analysis-map-inner").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 sm:h-[400px]">
        <span className="text-sm text-slate-400">分析地図を読み込み中...</span>
      </div>
    ),
  }
);

export function AnalysisMap(props: AnalysisMapInnerProps) {
  return <AnalysisMapInner {...props} />;
}
