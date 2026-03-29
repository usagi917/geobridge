"use client";

import type { ProximityResult } from "../lib/city2graph/types";
import { CATEGORY_LABELS } from "../lib/city2graph/categories";
import { CATEGORY_COLORS } from "../lib/city2graph/colors";
import { getCategoryStatus } from "../lib/city2graph/data-status";
import { distanceToBarWidth, getDistanceTier, getTierStyle } from "../lib/city2graph/proximity-utils";

interface ProximityCardProps {
  data: ProximityResult;
}

export function ProximityCard({ data }: ProximityCardProps) {
  const sortedCategories = Object.entries(data.categories)
    .filter(([key]) => key in CATEGORY_LABELS)
    .sort(([, a], [, b]) => {
      const aNearest = a.facilities[0]?.distance_m ?? Infinity;
      const bNearest = b.facilities[0]?.distance_m ?? Infinity;
      return aNearest - bNearest;
    });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">生活利便ネットワーク</h3>
        <span className="rounded-full bg-terra-50 px-3 py-1 text-sm font-semibold text-terra-700">
          {data.score}/100
        </span>
      </div>

      <div className="space-y-3">
        {sortedCategories.map(([key, cat]) => {
          const config = CATEGORY_LABELS[key];
          if (!config) return null;
          const status = getCategoryStatus(cat);
          const nearest = cat.facilities[0];
          const color = CATEGORY_COLORS[key] ?? "#6b7280";

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${config.color}`}>
                    {config.icon}
                  </span>
                  <span className="font-medium text-slate-700">{config.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {status === "available" && nearest && (
                    <>
                      <span className="text-slate-500">{cat.count}件</span>
                      <span className="font-semibold text-slate-900">
                        {Math.round(nearest.distance_m)}m
                      </span>
                      {(() => {
                        const tier = getDistanceTier(nearest.distance_m);
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTierStyle(tier)}`}>
                            {tier}
                          </span>
                        );
                      })()}
                    </>
                  )}
                  {status === "empty" && (
                    <span className="text-xs text-slate-400" role="status">周辺に該当施設なし</span>
                  )}
                </div>
              </div>
              {status === "available" && nearest && (
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${distanceToBarWidth(nearest.distance_m)}%`,
                    backgroundColor: color,
                    opacity: 0.7,
                  }}
                  aria-label={`${config.label}: 最寄り ${Math.round(nearest.distance_m)}m、${cat.count}件`}
                />
              )}
              {status === "empty" && (
                <div className="h-2 rounded-full border border-dashed border-slate-300" />
              )}
            </div>
          );
        })}

        {/* unavailable カテゴリ（data に含まれないカテゴリ） */}
        {Object.entries(CATEGORY_LABELS)
          .filter(([key]) => !(key in data.categories))
          .map(([key, config]) => (
            <div key={key} className="space-y-1 opacity-50">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
                    {config.icon}
                  </span>
                  <span className="font-medium text-slate-400">{config.label}</span>
                </div>
                <span className="text-xs text-slate-400" role="status">データ未取得</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100" />
            </div>
          ))}
      </div>
    </div>
  );
}
