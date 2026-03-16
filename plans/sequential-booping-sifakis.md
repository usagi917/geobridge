# TerraScore ビジュアライゼーション強化プラン

## Context

現在のレポート出力は数値カード（標高・降水量・温度・NDVI）とテキスト（事実/不足/注意点）のみで、地図は JAXA ラスタ PNG の再着色画像に過ぎない。ユーザーは地価の10年推移グラフ、降水量・温暖化トレンド、多角的なデータの可視化を求めている。

**決定事項:**
- MLIT Geospatial API 401 は解決済み → 地価履歴データ取得可能
- インタラクティブ地図: react-leaflet + OpenStreetMap
- JAXA 時系列: 5年分（月次）、地価: 10年分（年次）
- 生成時間の制約なし

---

## Phase 1: 依存パッケージ追加

**ファイル:** `package.json`

```bash
pnpm add recharts react-leaflet leaflet @types/leaflet
```

- `recharts` — 折れ線・棒グラフ
- `react-leaflet` + `leaflet` — インタラクティブ地図
- `@types/leaflet` — TypeScript 型定義

---

## Phase 2: 型定義の拡張

**ファイル:** `lib/mcp/types.ts`

```typescript
// 追加
export interface JaxaTimeseriesPoint {
  date: string;       // "YYYY-MM"
  mean: number;
  min?: number;
  max?: number;
}

export interface JaxaTimeseries {
  points: JaxaTimeseriesPoint[];
  unit?: string;
}

export interface LandPriceHistoryPoint {
  year: number;
  price: number;
  address?: string;
}
```

`JaxaResults` に追加:
```typescript
timeseriesData?: {
  ndvi?: JaxaTimeseries | null;
  lst?: JaxaTimeseries | null;
  precipitation?: JaxaTimeseries | null;
};
```

`GeospatialResults` に追加:
```typescript
land_price_history?: LandPriceHistoryPoint[] | null;
```

---

## Phase 3: JAXA 時系列データ取得

**ファイル:** `lib/mcp/jaxa-client.ts`

### 方針
`calc_spatial_stats` は `{mean: number[], std: number[], min: number[], max: number[], median: number[]}` を返す（1要素 = 1タイムステップ）。現在は3ヶ月分のみ取得し先頭値のみ使用。

### 実装
新関数 `calcSpatialStatsTimeseries` を追加:
1. 5年分を年ごとのチャンク（`[{Y}-01-01, {Y}-12-31]`）に分割
2. 各年を `Promise.allSettled`（個別20sタイムアウト）で並列実行
3. 返された配列を結合、日付ラベル（YYYY-MM）を補間生成
4. NaN/null をフィルタリング
5. 部分的失敗を許容（一部の年が失敗しても他年のデータは返す）

```typescript
export async function getTimeseriesPrecipitation(lat, lon, years: number): Promise<JaxaTimeseries | null>
export async function getTimeseriesLst(lat, lon, radiusM, years: number): Promise<JaxaTimeseries | null>
export async function getTimeseriesNdvi(lat, lon, radiusM, years: number): Promise<JaxaTimeseries | null>
```

**日付ラベル生成:** 配列長と年範囲から月次ラベルを補間。例: 2021年のクエリで12要素 → `["2021-01", "2021-02", ..., "2021-12"]`

**降水量の注意:** GSMaP は解像度が粗い（0.1°）ため `radiusM=12000` を維持。

---

## Phase 4: MLIT 地価履歴データ取得

**ファイル:** `lib/mcp/geospatial-client.ts`

### 実装
新関数 `getLandPriceHistory`:
1. 2015〜2024 の各年に `get_land_price_point_by_location(lat, lon, 425, year)` を呼び出し（または `getMultiApi` で `target_apis=[3]` + year パラメータ）
2. `Promise.allSettled`（個別15sタイムアウト）で並列実行
3. GeoJSON features から price, address, year を抽出
4. 同一地点の最近傍ポイントを選択し、年次推移を配列で返す

**geospatial-client.ts の `getMultiApi` に `year` パラメータを追加可能か確認必要。** `get_land_price_point_by_location` ツールを直接呼ぶ方が year パラメータを明示的に渡せて確実。

### 不動産取引価格（API #1）も追加検討
`get_multi_api(target_apis=[1], year=Y)` で取引実績データも取得可能。地価公示 + 取引実績の2系列をグラフ化できる。

---

## Phase 5: オーケストレーター拡張

**ファイル:** `lib/mcp/orchestrator.ts`

既存の9並列呼び出しに加え、4つの時系列呼び出しを追加:

```typescript
const [
  // 既存9つ ...
  // 追加
  ndviTimeseriesResult,
  lstTimeseriesResult,
  precipTimeseriesResult,
  landPriceHistoryResult,
] = await Promise.allSettled([
  // 既存9つ（15sタイムアウト）...
  // 追加（60sタイムアウト）
  tracked(withTimeout(jaxa.getTimeseriesNdvi(lat, lon, radiusM, 5), 60_000, "JAXA NDVI timeseries"), "NDVI トレンド"),
  tracked(withTimeout(jaxa.getTimeseriesLst(lat, lon, radiusM, 5), 60_000, "JAXA LST timeseries"), "温度トレンド"),
  tracked(withTimeout(jaxa.getTimeseriesPrecipitation(lat, lon, 5), 60_000, "JAXA precip timeseries"), "降水トレンド"),
  tracked(withTimeout(geospatial.getLandPriceHistory(lat, lon, 2015, 2025), 60_000, "MLIT land price history"), "地価推移"),
]);
```

`OrchestratorResult` に `jaxa.timeseriesData` と `geospatial.land_price_history` を追加。

**重要:** 時系列データは LLM に渡さない。フロントエンドのチャート用データとして `summary.data` に格納。

---

## Phase 6: 正規化レイヤー拡張

**ファイル:** `lib/normalizer/index.ts`, `lib/normalizer/jaxa.ts`, `lib/normalizer/geospatial.ts`

### NormalizedJaxa に追加
```typescript
timeseries?: {
  ndvi?: { label: "NDVI"; unit: ""; data: TimeseriesDataPoint[] };
  lst?: { label: "地表面温度"; unit: "°C"; data: TimeseriesDataPoint[] };
  precipitation?: { label: "降水量"; unit: "mm/月"; data: TimeseriesDataPoint[] };
};
```

### NormalizedGeospatial に追加
```typescript
land_price_history?: Array<{ year: number; price: number; address?: string }>;
```

### jaxa.ts の処理
- LST: ケルビン → 摂氏変換
- NaN/null/Infinity フィルタリング
- 空配列の場合は undefined

---

## Phase 7: スキーマ・ビルダー拡張

**ファイル:** `lib/report/schema.ts`

`summaryDataSchema` に追加:
```typescript
timeseries: z.object({
  ndvi: normalizedTimeseriesSchema.optional(),
  lst: normalizedTimeseriesSchema.optional(),
  precipitation: normalizedTimeseriesSchema.optional(),
}).optional(),
land_price_history: z.array(landPriceHistoryPointSchema).optional(),
```

**ファイル:** `lib/report/builder.ts`

`mergeSectionWithData` に `timeseries` と `land_price_history` を追加。

---

## Phase 8: チャートコンポーネント（Recharts）

### `components/charts/trend-chart.tsx`（新規）
汎用折れ線チャート:
- `ResponsiveContainer` + `LineChart`
- mean の `Line`、min-max の `Area`（信頼帯）
- `XAxis`（日付）、`YAxis`（単位）、`Tooltip`、`CartesianGrid`
- terra カラースキーム適用
- Props: `{ title, data, unit, color }`

### `components/charts/land-price-chart.tsx`（新規）
地価推移チャート:
- `BarChart` + `Line` のコンボチャート
- X軸: 年、Y軸: 円/m²（日本語数値フォーマット）
- 前年比変化率の注釈
- Props: `{ data: Array<{year, price}> }`

### `components/charts/chart-section.tsx`（新規）
チャート統合コンテナ:
- 2カラムグリッド（デスクトップ）/ 1カラム（モバイル）
- データがない項目は「データ未取得」プレースホルダー表示
- 降水量・LST・NDVI・地価の4チャートを条件付きレンダリング

**全チャートコンポーネントは `"use client"` 指定。**

---

## Phase 9: インタラクティブ地図コンポーネント（react-leaflet）

### `components/maps/location-map.tsx`（新規）
基本地図:
- OpenStreetMap タイルレイヤー（認証不要）
- 分析地点の中心マーカー
- 分析半径の円オーバーレイ
- 地価ポイントマーカー（データ存在時）
- `next/dynamic` で `{ ssr: false }` 読み込み（Leaflet は window 必須）

### `components/maps/satellite-overlay-map.tsx`（新規）
衛星データオーバーレイ地図:
- Leaflet `ImageOverlay` で JAXA ラスタ PNG を basemap 上に配置
- bbox がそのまま overlay bounds に対応
- 不透明度スライダーで basemap と衛星データを切替
- 現在の CSS グリッドオーバーレイ（`environment-visualizations.tsx`）を置換

### Leaflet CSS
`leaflet/dist/leaflet.css` をコンポーネント内でインポート。

---

## Phase 10: レポートページのレイアウト再設計

**ファイル:** `components/report-view.tsx`

### 新レイアウト構成

```
┌────────────────────────────────────┐
│ ヘッダー（住所・座標・観点・時間） │
├────────────────────────────────────┤
│ キーメトリクス（4-5カード）         │  ← 既存 MetricCard
├────────────────────────────────────┤
│ インタラクティブ地図（全幅）        │  ← 新規 LocationMap
├──────────────────┬─────────────────┤
│ 降水量トレンド    │ 地表面温度トレンド│  ← 新規 TrendChart x2
├──────────────────┼─────────────────┤
│ NDVI トレンド     │ 地価推移         │  ← 新規 TrendChart + LandPriceChart
├──────────────────┴─────────────────┤
│ 衛星データオーバーレイ（3列）       │  ← 新規 SatelliteOverlayMap x3
├────────────────────────────────────┤
│ テキストレポートセクション          │  ← 既存 ReportSection x6
├────────────────────────────────────┤
│ 出典一覧                           │  ← 既存
└────────────────────────────────────┘
```

### 変更点
- `EnvironmentVisualizations` → `SatelliteOverlayMap` に置換
- チャートセクションを `ReportSection` の前に配置
- 地図を MetricCard の直後に全幅で配置

---

## Phase 11: 設定変更

**ファイル:** `lib/config.ts`

```typescript
mcp: {
  toolTimeout: 15_000,      // 既存
  timeseriesTimeout: 60_000, // 追加
},
report: {
  jaxaTimeseriesYears: 5,    // 追加
  landPriceHistoryYears: 10, // 追加
},
```

---

## 実装順序

| Step | 内容 | 主要ファイル |
|------|------|-------------|
| 1 | `pnpm add recharts react-leaflet leaflet @types/leaflet` | `package.json` |
| 2 | 型定義追加 | `lib/mcp/types.ts` |
| 3 | JAXA 時系列取得関数追加 | `lib/mcp/jaxa-client.ts` |
| 4 | MLIT 地価履歴取得関数追加 | `lib/mcp/geospatial-client.ts` |
| 5 | 設定値追加 | `lib/config.ts` |
| 6 | オーケストレーター拡張 | `lib/mcp/orchestrator.ts` |
| 7 | 正規化レイヤー拡張 | `lib/normalizer/*.ts` |
| 8 | Zod スキーマ拡張 | `lib/report/schema.ts` |
| 9 | レポートビルダー拡張 | `lib/report/builder.ts` |
| 10 | チャートコンポーネント作成 | `components/charts/*.tsx` |
| 11 | 地図コンポーネント作成 | `components/maps/*.tsx` |
| 12 | レポートページ再設計 | `components/report-view.tsx`, `components/environment-visualizations.tsx` |
| 13 | ビルド検証 | `pnpm build && pnpm type-check` |
| 14 | 動作テスト | 東京タワー座標でE2E確認 |

---

## 検証方法

1. **ビルド確認:** `pnpm build` + `pnpm type-check` が成功すること
2. **時系列データ確認:** JAXA `calc_spatial_stats` のレスポンスが配列として正しくパースされること（console.log で確認）
3. **チャート描画確認:** `pnpm dev` → レポート生成 → 4つのトレンドチャートが表示されること
4. **地図表示確認:** OpenStreetMap タイルが読み込まれ、中心マーカーと半径円が表示されること
5. **衛星オーバーレイ確認:** JAXA ラスタが basemap 上の正しい座標に配置されること
6. **地価履歴確認:** MLIT API で10年分のデータが取得され、棒グラフとして表示されること
7. **部分失敗テスト:** 一部 API が失敗しても他のチャート・セクションは正常表示されること
8. **テスト座標:** 東京タワー (35.6586, 139.7454)
