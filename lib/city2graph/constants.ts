// Morphology 基準値レンジと正規化関数

interface MetricRange {
  min: number;
  max: number;
}

export const MORPHOLOGY_RANGES: Record<string, MetricRange> = {
  building_density_per_km2: { min: 0, max: 2000 },
  street_connectivity: { min: 0, max: 6.0 },
  building_street_facing_ratio: { min: 0, max: 1.0 },
};

/** 値をレンジに基づいて 0〜1 に正規化する。範囲外はクランプ。 */
export function normalizeMetric(value: number, range: MetricRange): number {
  const clamped = Math.max(range.min, Math.min(range.max, value));
  const span = range.max - range.min;
  if (span === 0) return 0;
  return (clamped - range.min) / span;
}

/** 正規化された値 (0〜1) を段階ラベルに変換 */
export function getMetricLevel(normalized: number): "低" | "中" | "高" {
  if (normalized < 1 / 3) return "低";
  if (normalized < 2 / 3) return "中";
  return "高";
}
