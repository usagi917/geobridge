"use client";

import dynamic from "next/dynamic";
import type { AnalysisMapInnerProps } from "./analysis-map-inner";
import { useInView } from "@/lib/hooks/use-in-view";

const Skeleton = () => (
  <div className="flex h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 sm:h-[400px]">
    <span className="text-sm text-slate-400">分析地図を読み込み中...</span>
  </div>
);

const AnalysisMapInner = dynamic<AnalysisMapInnerProps>(
  () => import("./analysis-map-inner").then((mod) => mod.default),
  { ssr: false, loading: Skeleton },
);

export function AnalysisMap(props: AnalysisMapInnerProps) {
  const { ref, inView } = useInView("200px");

  return (
    <div ref={ref}>
      {inView ? <AnalysisMapInner {...props} /> : <Skeleton />}
    </div>
  );
}
