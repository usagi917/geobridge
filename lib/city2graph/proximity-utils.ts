// Proximity カード用のロジック（純関数）

const MAX_DISTANCE_M = 2000;

/** 距離をバー幅パーセント (0〜100) に変換。2km を上限とする。 */
export function distanceToBarWidth(distanceM: number): number {
  return Math.round(Math.min(distanceM, MAX_DISTANCE_M) / MAX_DISTANCE_M * 100);
}

export type DistanceTier = "近い" | "普通" | "遠い";

/** 距離を tier に変換: 〜300m: 近い, 〜800m: 普通, 800m〜: 遠い */
export function getDistanceTier(distanceM: number): DistanceTier {
  if (distanceM <= 300) return "近い";
  if (distanceM <= 800) return "普通";
  return "遠い";
}

const TIER_STYLES: Record<DistanceTier, string> = {
  "近い": "bg-emerald-100 text-emerald-700",
  "普通": "bg-amber-100 text-amber-700",
  "遠い": "bg-red-100 text-red-700",
};

export function getTierStyle(tier: DistanceTier): string {
  return TIER_STYLES[tier];
}
