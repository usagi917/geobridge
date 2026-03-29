// city2graph カラー定数の一元管理
// CSS トークン (globals.css @theme) と JS 定数の Single Source of Truth

export const ISOCHRONE_COLORS: Record<number, string> = {
  5: "#22c55e",
  10: "#eab308",
  15: "#ef4444",
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  grocery: "#10b981",
  hospital: "#ef4444",
  school: "#3b82f6",
  convenience: "#f59e0b",
  park: "#22c55e",
  restaurant: "#f97316",
} as const;

export const MORPHOLOGY_COLORS: Record<string, string> = {
  density: "#6366f1",
  connectivity: "#8b5cf6",
  facing: "#a78bfa",
} as const;
