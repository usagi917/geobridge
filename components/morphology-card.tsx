"use client";

import type { MorphologyResult } from "../lib/city2graph/types";

interface MorphologyCardProps {
  data: MorphologyResult;
}

function MetricMini({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value.toLocaleString("ja-JP")}</p>
      <p className="text-xs text-slate-400">{unit}</p>
    </div>
  );
}

export function MorphologyCard({ data }: MorphologyCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">街区構造スコア</h3>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
          成熟度 {data.maturity_score}/100
        </span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${Math.min(data.maturity_score, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricMini label="建物数" value={data.metrics.building_count} unit="棟" />
        <MetricMini
          label="建物密度"
          value={Math.round(data.metrics.building_density_per_km2)}
          unit="棟/km²"
        />
        <MetricMini
          label="街路接続度"
          value={Number(data.metrics.street_connectivity.toFixed(2))}
          unit="平均次数"
        />
        <MetricMini
          label="道路面率"
          value={Number((data.metrics.building_street_facing_ratio * 100).toFixed(1))}
          unit="%"
        />
      </div>
    </div>
  );
}
