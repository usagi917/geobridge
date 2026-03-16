"use client";

import Image from "next/image";
import type { JaxaVisualization, GeneratedMap } from "@/lib/report/schema";

interface EnvironmentVisualizationsProps {
  visualizations: JaxaVisualization[];
  generatedMaps?: GeneratedMap[];
}

const legendStyles: Record<JaxaVisualization["id"], string> = {
  precipitation: "linear-gradient(90deg, #dbeafe 0%, #60a5fa 45%, #1d4ed8 100%)",
  lst: "linear-gradient(90deg, #fef3c7 0%, #fb923c 55%, #dc2626 100%)",
  ndvi: "linear-gradient(90deg, #fef3c7 0%, #86efac 50%, #166534 100%)",
};

const legendLabels: Record<JaxaVisualization["id"], string> = {
  precipitation: "少雨 -> 多雨",
  lst: "低温 -> 高温",
  ndvi: "低植生 -> 高植生",
};

export function EnvironmentVisualizations({
  visualizations,
  generatedMaps,
}: EnvironmentVisualizationsProps) {
  if (visualizations.length === 0) return null;

  const mapById = new Map(
    (generatedMaps ?? []).map((m) => [m.id, m])
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">環境レイヤー可視化</h3>
          <p className="text-sm text-slate-500">
            {mapById.size > 0
              ? "JAXA 衛星データを座標付き地図として表示しています。カラーバーで値の範囲を確認できます。"
              : "JAXA ラスタを白背景カードに重ねた簡易マップです。降水量は広域メッシュのため表示範囲を広めに取っています。"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {visualizations.map((visualization) => {
          const generated = mapById.get(visualization.id);
          return (
            <article
              key={visualization.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70"
            >
              <div className="flex items-start justify-between border-b border-slate-200 bg-white px-4 py-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{visualization.title}</h4>
                  <p className="text-xs text-slate-500">{visualization.description}</p>
                </div>
                {visualization.valueLabel && (
                  <span className="rounded-full bg-terra-50 px-2 py-1 text-[11px] font-medium text-terra-700">
                    {visualization.valueLabel}
                  </span>
                )}
              </div>

              <div className="p-4">
                {generated ? (
                  /* Python-generated annotated map with axes and colorbar */
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <Image
                      src={generated.imageDataUrl}
                      alt={visualization.title}
                      width={800}
                      height={800}
                      unoptimized
                      className="h-auto w-full"
                    />
                  </div>
                ) : (
                  /* Fallback: original CSS overlay display */
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div
                      className="absolute inset-0 opacity-80"
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px)
                        `,
                        backgroundSize: "20% 20%",
                      }}
                    />
                    <Image
                      src={visualization.imageDataUrl}
                      alt={visualization.title}
                      fill
                      unoptimized
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),rgba(255,255,255,0.34))]" />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(15,23,42,0.15)]" />
                    <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/70" />
                    <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/70" />
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  {!generated && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          Legend
                        </span>
                        <span className="text-xs text-slate-500">{legendLabels[visualization.id]}</span>
                      </div>
                      <div
                        className="h-2 rounded-full"
                        style={{ background: legendStyles[visualization.id] }}
                      />
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>{formatBoundsLabel("西", visualization.bbox[0])}</span>
                        <span className="text-right">{formatBoundsLabel("東", visualization.bbox[2])}</span>
                        <span>{formatBoundsLabel("南", visualization.bbox[1])}</span>
                        <span className="text-right">{formatBoundsLabel("北", visualization.bbox[3])}</span>
                      </div>
                    </>
                  )}
                  <p className="text-xs text-slate-400">
                    取得期間: {formatCapturedRange(visualization.capturedRange)}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatBoundsLabel(direction: string, value: number): string {
  return `${direction} ${value.toFixed(3)}°`;
}

function formatCapturedRange([start, end]: JaxaVisualization["capturedRange"]): string {
  return `${start.slice(0, 10)} - ${end.slice(0, 10)}`;
}
