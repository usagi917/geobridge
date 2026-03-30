"use client";

import type { MorphologyResult } from "../lib/city2graph/types";
import { MORPHOLOGY_COLORS } from "../lib/city2graph/colors";
import { MORPHOLOGY_RANGES, normalizeMetric, getMetricLevel } from "../lib/city2graph/constants";

interface MorphologyCardProps {
  data: MorphologyResult;
}

const METRICS_CONFIG = [
  {
    key: "building_density_per_km2" as const,
    label: "建物密度",
    unit: "棟/km²",
    colorKey: "density" as const,
    format: (v: number) => Math.round(v).toLocaleString("ja-JP"),
  },
  {
    key: "street_connectivity" as const,
    label: "街路接続度",
    unit: "平均次数",
    colorKey: "connectivity" as const,
    format: (v: number) => v.toFixed(2),
  },
  {
    key: "building_street_facing_ratio" as const,
    label: "道路面率",
    unit: "%",
    colorKey: "facing" as const,
    format: (v: number) => (v * 100).toFixed(1),
  },
] as const;

export function MorphologyCard({ data }: MorphologyCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">街区構造分析</h3>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
          成熟度 {data.maturity_score}/100
        </span>
      </div>

      <div className="space-y-4">
        {METRICS_CONFIG.map(({ key, label, unit, colorKey, format }) => {
          const value = data.metrics[key];
          const range = MORPHOLOGY_RANGES[key];
          const normalized = normalizeMetric(value, range);
          const level = getMetricLevel(normalized);
          const color = MORPHOLOGY_COLORS[colorKey];
          const pct = Math.round(normalized * 100);

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900">
                    {format(value)}{unit}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {level}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                  aria-label={`${label}: ${format(value)}${unit}（基準値の${pct}%）`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
