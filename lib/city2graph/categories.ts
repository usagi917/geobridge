// city2graph カテゴリマスタデータの一元管理

export type CategoryKey =
  | "grocery"
  | "hospital"
  | "school"
  | "convenience"
  | "park"
  | "restaurant";

export interface CategoryMaster {
  key: CategoryKey;
  label: string;
  icon: string;
  colorKey: string;
}

export const CATEGORIES: CategoryMaster[] = [
  { key: "grocery", label: "食料品店", icon: "🛒", colorKey: "bg-emerald-100 text-emerald-700" },
  { key: "hospital", label: "医療機関", icon: "🏥", colorKey: "bg-red-100 text-red-700" },
  { key: "school", label: "学校", icon: "🏫", colorKey: "bg-blue-100 text-blue-700" },
  { key: "convenience", label: "コンビニ", icon: "🏪", colorKey: "bg-amber-100 text-amber-700" },
  { key: "park", label: "公園", icon: "🌳", colorKey: "bg-green-100 text-green-700" },
  { key: "restaurant", label: "飲食店", icon: "🍽️", colorKey: "bg-orange-100 text-orange-700" },
];

/** カテゴリキーからマスタデータを引く */
export function getCategoryMaster(key: string): CategoryMaster | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

/** Record<key, { label, icon, colorKey }> 形式で導出（既存コンポーネント互換） */
export const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> =
  Object.fromEntries(
    CATEGORIES.map((c) => [c.key, { label: c.label, icon: c.icon, color: c.colorKey }]),
  );
