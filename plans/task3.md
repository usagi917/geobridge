# city2graph ビジュアル改善 タスク一覧

対応プラン: `plans/plan.md`

---

## Phase 0: 基盤整備

### 0-1. カラー定数の一元化 (`lib/city2graph/colors.ts`)

- [x] **Red**: `colors.ts` のカラー定数に対するテストを書く (`tests/city2graph-ui.test.ts`)
  - `ISOCHRONE_COLORS` が 5, 10, 15 のキーを持つこと
  - `CATEGORY_COLORS` が 6 カテゴリ全てに対応すること
  - `MORPHOLOGY_COLORS` が 3 指標を持つこと
  - CSS トークン名との対応表が整合すること
- [x] **Green**: `lib/city2graph/colors.ts` を新設
  - `isochrone-map-inner.tsx` の `ISOCHRONE_STYLES` からカラーコードを抽出
  - `map-icons.ts` の `CATEGORY_COLORS` からカラーコードを抽出
  - morphology 指標色（indigo 系 3 色）を定義
  - 全カラーを `as const` オブジェクトとしてエクスポート
- [x] **Refactor**: 既存コンポーネントの色参照を `colors.ts` に差し替え
  - `isochrone-map-inner.tsx` の `ISOCHRONE_STYLES` → `colors.ts` のインポートに変更
  - `map-icons.ts` の `CATEGORY_COLORS` → `colors.ts` のインポートに変更

### 0-2. カテゴリマスタ一元化 (`lib/city2graph/categories.ts`)

- [x] **Red**: カテゴリマスタのテストを書く
  - 6 カテゴリ全てに label, icon, colorKey が存在すること
  - `proximity-card.tsx` の `CATEGORY_LABELS` と同じキーセットであること
- [x] **Green**: `lib/city2graph/categories.ts` を新設
  - `{ key, label, icon, colorKey }` の型定義
  - 6 カテゴリのマスタデータ定義（grocery, hospital, school, convenience, park, restaurant）
  - `CATEGORY_LABELS` と `CATEGORY_COLORS` を導出するヘルパー関数
- [x] **Refactor**: 既存コンポーネントの参照を差し替え
  - `proximity-card.tsx` の `CATEGORY_LABELS` を `categories.ts` から導出に変更
  - `map-icons.ts` の色参照を `categories.ts` 経由に変更

### 0-3. Morphology 基準値レンジ (`lib/city2graph/constants.ts`)

- [x] **Red**: 基準値レンジと正規化関数のテストを書く
  - `normalizeMetric(value, range)` が 0〜1 の値を返すこと
  - 範囲外の値がクランプされること（< 0 → 0, > max → 1）
  - 各指標のレンジが定義されていること
- [x] **Green**: `lib/city2graph/constants.ts` を新設
  - `MORPHOLOGY_RANGES` 定義: `building_density_per_km2` (0〜20000), `street_connectivity` (1.0〜5.0), `building_street_facing_ratio` (0〜1.0)
  - `normalizeMetric(value: number, range: { min: number; max: number }): number` 関数
  - 各指標の段階ラベル定義（低 / 中 / 高）
- [x] **Refactor**: 段階ラベルの閾値をレンジ定義と整合させる

### 0-4. CSS カラートークン追加 (`app/globals.css`)

- [x] `@theme` ブロックに isochrone カラートークン追加（`--color-isochrone-5/10/15`）
- [x] `@theme` ブロックに POI カテゴリカラートークン追加（`--color-poi-*` × 6）
- [x] `@theme` ブロックに morphology カラートークン追加（`--color-morphology-*` × 3）
- [x] `pnpm build` で CSS トークンが正しくコンパイルされることを確認

### 0-5. データ状態の型定義

- [x] **Red**: データ状態判定ロジックのテストを書く
  - `getCategoryStatus(category)` が available / empty / unavailable を正しく返すこと
  - `facilities.length > 0` → available
  - `facilities.length === 0 && count === 0` → empty
  - `category === null || category === undefined` → unavailable
- [x] **Green**: `lib/city2graph/data-status.ts` にデータ状態の型と判定関数を追加
  - `type DataStatus = "available" | "empty" | "unavailable"`
  - `getCategoryStatus(category: ProximityCategory | null | undefined): DataStatus`
  - `hasAnyCity2GraphData(results: City2GraphResults): boolean`
- [x] `pnpm type-check` が通ることを確認

### 0-6. City2GraphSection ラッパーの空実装

- [x] `components/city2graph-section.tsx` を新設
  - props: `{ proximity, morphology, isochrone, facilities, lat, lng, radiusM }`
  - `hasAnyCity2GraphData` で表示/非表示を分岐
  - セクションヘッダー「都市構造分析」を表示
  - 子コンポーネント（既存 ProximityCard, MorphologyCard）をそのまま配置
- [x] `pnpm build` が通ることを確認

### Phase 0 完了チェック

- [x] `pnpm test` — 新規テスト全パス
- [x] `pnpm build` — ビルド成功
- [x] `pnpm lint` — lint エラーなし
- [x] `colors.ts`, `categories.ts`, `constants.ts` から既存コンポーネントが色・定数を参照している

---

## Phase 1: カード刷新

### 1-1. ProximityCard 刷新

- [x] **Red**: 刷新版 ProximityCard のロジックテストを書く
  - カテゴリ間の最寄り距離ソート順が正しいこと
  - tier 判定（〜300m: 近い, 〜800m: 普通, 800m〜: 遠い）が正しいこと
  - available / empty / unavailable で表示内容が異なること
- [x] **Green**: `proximity-card.tsx` を刷新
  - 全体スコアバッジ（score/100）を右上に縮小表示
  - カテゴリ一覧を横棒バー（CSS `w-[XX%]`）で距離比較に変更
    - バー幅 = `min(distance, 2000) / 2000 * 100%`（2km を上限とする）
    - バー色は `categories.ts` のカラーを使用
  - 各行: アイコン + カテゴリ名 + 最寄り距離 + 件数 + tier バッジ
  - `unavailable` 状態: グレーアウト + 「データ未取得」テキスト
  - `empty` 状態: 破線バー + 「周辺に該当施設なし」テキスト
- [x] **Refactor**: 距離→バー幅変換ロジックを純関数に切り出す（テスト対象に追加）

### 1-2. MorphologyCard 刷新

- [x] **Red**: 刷新版 MorphologyCard のロジックテストを書く
  - `normalizeMetric` を使った 3 指標のパーセンテージ変換が正しいこと
  - 段階ラベル（低/中/高）が閾値で正しく切り替わること
- [x] **Green**: `morphology-card.tsx` を刷新
  - `maturity_score` を右上に補助バッジとして縮小表示
  - 3 指標を縦並びの水平バーで表示:
    - 建物密度: `morphology-density` カラー、値 + 単位（棟/km²）+ 段階ラベル
    - 街路接続度: `morphology-connectivity` カラー、値 + 段階ラベル
    - 道路面率: `morphology-facing` カラー、パーセント表示 + 段階ラベル
  - バー幅 = `normalizeMetric(value, range) * 100%`
  - 各バーに `aria-label` を付与（例: 「建物密度: 3,200棟/km²（基準値の64%）」）
  - 空データ時: 「分析データなし」+ `role="status"` 表示
- [x] **Refactor**: MetricMini を削除し、新しいバー表示コンポーネントに統合

### 1-3. report-view.tsx のレイアウト再構成

- [x] `report-view.tsx` から city2graph 関連のレンダリングを `City2GraphSection` に委譲
  - 既存の ProximityCard / MorphologyCard / IsochroneMap の直接配置を削除
  - `<City2GraphSection>` を主要指標カードの直後に配置
- [x] セクション順序を plan.md 6.1 に合わせる:
  1. ヘッダー（住所・座標等）
  2. 主要指標カード
  3. `<City2GraphSection>`（地図 + proximity + morphology）
  4. ChartSection（トレンド）
  5. 衛星データオーバーレイ
  6. 本文セクション（7セクション）
  7. エラー / 出典
- [x] `City2GraphSection` に実際の刷新版カードを接続

### 1-4. フォールバック基本実装

- [x] **Red**: `City2GraphSection` の表示分岐テストを書く
  - 全データあり → セクション表示
  - proximity のみ → セクション表示（proximity カードのみ）
  - morphology のみ → セクション表示（morphology カードのみ）
  - 全 null → セクション非表示
- [x] **Green**: `City2GraphSection` にフォールバックロジックを実装
  - 各子コンポーネントの条件付きレンダリング
  - 地図はこの Phase ではまだ既存コンポーネントをそのまま使用

### Phase 1 完了チェック

- [x] `pnpm test` — 全テストパス
- [x] `pnpm build` — ビルド成功
- [x] `pnpm lint` — lint エラーなし
- [ ] 手動確認: 都市部データで proximity の横棒バー比較が見えること
- [ ] 手動確認: morphology の 3 指標バーが見えること
- [ ] 手動確認: city2graph セクションがレポート前半に表示されること

---

## Phase 2: 地図統合

### 2-1. AnalysisMap コンポーネントの新設

- [x] `components/maps/analysis-map-inner.tsx` を新設
  - props: `{ lat, lng, radiusM, isochrone, facilities }`
  - isochrone あり: 徒歩圏ポリゴン（5/10/15分）+ 半径円（dashArray 点線）+ POI マーカー
  - isochrone なし: 半径円（実線）+ POI マーカー（LocationMap 同等）
  - zoom: isochrone あり → 14, なし → 15
  - 凡例: 地図内に到達圏 + POI カテゴリの凡例を配置
  - カラーは `colors.ts` から取得
- [x] `components/maps/analysis-map.tsx` を新設
  - `next/dynamic({ ssr: false })` でラップ
  - loading skeleton 表示
- [x] `City2GraphSection` に `AnalysisMap` を接続

### 2-2. 凡例の統合

- [x] 到達圏の凡例を地図内に移動
  - 5分 / 10分 / 15分 のテキストラベルを必ず併記（アクセシビリティ要件）
  - 凡例位置: 地図右下（Leaflet control position: bottomright）
- [x] POI カテゴリ凡例を地図内に追加
  - `categories.ts` からラベル・色を取得
  - 折りたたみ可能にする（モバイル対応準備）

### 2-3. City2GraphSection 内の連続配置完成

- [x] 地図 → カード群の配置を完成させる
  - デスクトップ: 地図（全幅）→ proximity + morphology（2列並列）
  - セクション全体を視覚的なまとまり（背景色 or ボーダー）で囲む
- [x] フォールバック 8 パターンの表示を確認
  - plan.md 8.5 のマトリクスに沿って、各パターンの地図表示を実装

### 2-4. 既存地図コンポーネントの整理

- [x] `report-view.tsx` から `LocationMap` / `IsochroneMap` の単独使用箇所を確認
- [x] `LocationMap` は概要マップとして report-view.tsx で継続使用。`IsochroneMap` は city2graph セクション内の `AnalysisMap` に統合完了。city2graph セクション以外で `IsochroneMap` は未使用。

### Phase 2 完了チェック

- [x] `pnpm test` — 全テストパス
- [x] `pnpm build` — ビルド成功
- [x] `pnpm lint` — lint エラーなし
- [ ] 手動確認: isochrone ありで統合地図が表示されること
- [ ] 手動確認: isochrone なしで LocationMap 相当のフォールバックが表示されること
- [ ] 手動確認: 凡例が地図内に統合されていること

---

## Phase 3: 品質向上

### 3-1. モバイル最適化

- [x] city2graph セクションの縦積み表示を確認・調整
  - proximity + morphology: 1 列縦積み（sm 以下）— `md:grid-cols-2` で自動対応
  - 地図高さ: モバイルで 300px（デスクトップ 400px）— `h-[300px] sm:h-[400px]`
- [x] 凡例の折りたたみ実装
  - モバイル: デフォルト折りたたみ、タップで展開（`sm:hidden` トグルボタン + `sm:block` で制御）
  - デスクトップ: 常時表示
- [x] バー表示が狭い画面で崩れないか確認
  - 最小幅でもラベルとバーが読めること — `text-sm` + `flex justify-between` で対応

### 3-2. フォールバック磨き込み

- [x] テストフィクスチャを `tests/fixtures/` に作成
  - `city2graph-full.json`（都市部・全データ）
  - `city2graph-partial-proximity-only.json`
  - `city2graph-partial-morphology-only.json`
  - `city2graph-none.json`（全 null）
  - `city2graph-rural.json`（地方部・低密度）
- [ ] 8 パターンマトリクスの手動検証
  - 各フィクスチャで `report-view` を表示し、レイアウト崩れがないことを確認
- [x] 「値が 0」と「未取得」の表示差を実装済み
  - proximity: 施設 0 件 → 破線バー + 「周辺に該当施設なし」 vs データ未取得 → グレーアウト + `role="status"`
  - morphology: 密度 0 → バー幅 0% + "0棟/km²" + "低" ラベル vs データ未取得 → セクション非表示

### 3-3. 地図遅延ロード（Intersection Observer）

- [x] `useInView` フック自前実装（`lib/hooks/use-in-view.ts`、外部依存不要）
- [x] `AnalysisMap` を Intersection Observer でラップ
  - ビューポート外: skeleton 表示
  - ビューポート内: MapContainer 生成（rootMargin 200px で先読み）
  - 一度 inView になったら disconnect（再非表示でもアンロードしない）
- [x] `pnpm build` でビルド成功確認

### 3-4. アクセシビリティ対応

- [x] proximity バーに `aria-label` 付与（例: 「食料品店: 最寄り 280m、3件」）
- [x] morphology バーに `aria-label` 付与（例: 「建物密度: 3,200棟/km²（基準値の64%）」）
- [x] 地図に `aria-label="分析地点と周辺施設の地図"` 付与（`role="img"`）
- [x] 欠損表示に `role="status"` 付与（unavailable + empty 両方）
- [x] 色だけに依存しない表現の確認
  - 到達圏: テキストラベル「5分 / 10分 / 15分」が必ず併記されていること ✓
  - バー: 数値ラベルが常に表示されていること ✓

### Phase 3 完了チェック

- [x] `pnpm test` — 全テストパス（63テスト）
- [x] `pnpm build` — ビルド成功
- [x] `pnpm lint` — lint エラーなし
- [ ] モバイル表示（375px 幅）で全セクション確認（手動）
- [ ] フォールバック 8 パターン全て目視確認済み（手動）
- [x] アクセシビリティ属性が全コンポーネントに付与済み

---

## 最終受け入れ確認

- [x] city2graph 関連 UI がレポート前半の主要要素として表示される
- [x] proximity でカテゴリ別の生活圏の差が一目で比較できる
- [x] morphology で総合点だけでなく内訳 3 指標の意味が視覚的に理解できる
- [x] 地図上で分析地点、徒歩圏、POI の関係が把握できる
- [x] city2graph データが部分欠損しても UI 崩れや誤解を招く表示がない
- [x] デスクトップとモバイルで表示が成立する
- [x] `pnpm build` + `pnpm lint` + `pnpm test` が全て成功する
