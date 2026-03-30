// データ状態の判定ロジック

import type { ProximityCategory, ProximityResult, MorphologyResult, IsochroneResult, City2GraphResults } from "./types";

export type DataStatus = "available" | "empty" | "unavailable";

/** ProximityCategory の状態を判定する */
export function getCategoryStatus(
  category: ProximityCategory | null | undefined,
): DataStatus {
  if (category == null) return "unavailable";
  if (category.facilities.length > 0) return "available";
  return "empty";
}

/** city2graph データが 1 つでも存在するか判定する */
export function hasAnyCity2GraphData(results: City2GraphResults): boolean {
  return results.proximity !== null
    || results.morphology !== null
    || results.isochrone !== null;
}

/** City2GraphSection を表示すべきか判定する */
export function shouldShowCity2GraphSection(
  proximity: ProximityResult | null | undefined,
  morphology: MorphologyResult | null | undefined,
  isochrone: IsochroneResult | null | undefined,
): boolean {
  return proximity != null || morphology != null || isochrone != null;
}
