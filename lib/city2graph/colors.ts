// city2graph カラー定数の一元管理（JS 側）
import type { CategoryKey } from "./categories";

export const ISOCHRONE_COLORS = {
  5: "#22c55e",
  10: "#eab308",
  15: "#ef4444",
} as const;

export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  grocery: "#10b981",
  hospital: "#ef4444",
  school: "#3b82f6",
  convenience: "#f59e0b",
  park: "#22c55e",
  restaurant: "#f97316",
} as const;

export const MORPHOLOGY_COLORS = {
  density: "#6366f1",
  connectivity: "#8b5cf6",
  facing: "#a78bfa",
} as const;
