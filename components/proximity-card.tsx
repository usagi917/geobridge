"use client";

import type { ProximityResult } from "../lib/city2graph/types";
import { CATEGORY_LABELS } from "../lib/city2graph/categories";

interface ProximityCardProps {
  data: ProximityResult;
}

export function ProximityCard({ data }: ProximityCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">生活利便ネットワーク</h3>
        <span className="rounded-full bg-terra-50 px-3 py-1 text-sm font-semibold text-terra-700">
          スコア {data.score}/100
        </span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-terra-500 transition-all"
          style={{ width: `${Math.min(data.score, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Object.entries(data.categories).map(([key, cat]) => {
          const config = CATEGORY_LABELS[key];
          if (!config) return null;
          const nearest = cat.facilities[0];

          return (
            <div key={key} className="rounded-xl border border-slate-100 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${config.color}`}>
                  {config.icon}
                </span>
                <span className="text-sm font-medium text-slate-700">{config.label}</span>
              </div>
              {nearest ? (
                <>
                  <p className="text-lg font-bold text-slate-900">
                    {Math.round(nearest.distance_m)}m
                  </p>
                  <p className="truncate text-xs text-slate-500">{nearest.name}</p>
                  {cat.count > 1 && (
                    <p className="text-xs text-slate-400">他 {cat.count - 1} 件</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">データなし</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
