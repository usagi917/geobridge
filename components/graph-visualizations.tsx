"use client";

import Image from "next/image";
import type { GeneratedGraph } from "@/lib/report/schema";

interface GraphVisualizationsProps {
  graphs: GeneratedGraph[];
}

export function GraphVisualizations({ graphs }: GraphVisualizationsProps) {
  if (graphs.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            都市構造グラフ分析
          </h3>
          <p className="text-sm text-slate-500">
            OpenStreetMap データを基に、建物・街路・施設の空間的関係をグラフ構造で可視化しています。
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {graphs.map((graph) => (
          <article
            key={graph.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70"
          >
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <h4 className="text-sm font-semibold text-slate-900">
                {graph.title}
              </h4>
              {graph.description && (
                <p className="text-xs text-slate-500">{graph.description}</p>
              )}
            </div>
            <div className="p-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <Image
                  src={graph.imageDataUrl}
                  alt={graph.title}
                  width={800}
                  height={800}
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                データソース: OpenStreetMap
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
