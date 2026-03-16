# Python (matplotlib) で JAXA 衛星データの座標付き地図画像を生成

## Context

現在のレポート画面は JAXA 衛星画像を CSS オーバーレイ付きの静的 PNG として表示しているが、座標軸やカラーバーがなく、データの意味が直感的に伝わらない。matplotlib で座標軸（緯度・経度）、カラーバー（値の範囲）、中心点マーカーを追加した高品質な地図画像を生成し、既存表示を置き換える。

## 方針

- **matplotlib + numpy + Pillow のみ**（外部タイル取得なし）
- JAXA ラスター PNG を imshow で bbox 座標に合わせて描画
- 適切な colormap でカラーバーを追加（NDVI=YlGn, LST=YlOrRd, Precipitation=Blues）
- 中心点マーカー + 座標軸ラベル（°N, °E）
- `uv run` で子プロセス実行
- 失敗時は既存表示にフォールバック

## 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---|---|---|
| `lib/visualize/pyproject.toml` | 新規 | Python パッケージ定義 |
| `lib/visualize/generate.py` | 新規 | 地図画像生成スクリプト |
| `lib/visualize/client.ts` | 新規 | Node.js → Python 子プロセスクライアント |
| `lib/report/schema.ts` | 変更 | `generated_maps` フィールド追加 |
| `lib/report/builder.ts` | 変更 | 可視化呼び出しを統合 |
| `components/environment-visualizations.tsx` | 変更 | Python 生成地図を表示 |
| `components/report-view.tsx` | 変更 | props 追加（1行） |

## 実装ステップ

### Step 1: `lib/visualize/pyproject.toml`

```toml
[project]
name = "terrascore-visualize"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["matplotlib>=3.9", "numpy>=1.26", "Pillow>=10.0"]
```

### Step 2: `lib/visualize/generate.py`

stdin JSON → 地図画像生成 → stdout JSON（base64 PNG）。

各 visualization につき 1 枚生成:
1. base64 PNG デコード → PIL.Image → numpy array
2. `fig, ax = plt.subplots(figsize=(8, 8))`
3. `ax.imshow(array, extent=[west, east, south, north], cmap=colormap, alpha=0.85)`
4. 中心点を赤十字マーカー `ax.plot(lon, lat, 'r+', markersize=15)`
5. colormap に応じたカラーバー（`fig.colorbar()`）
6. 軸ラベル `経度 (°E)` / `緯度 (°N)` + タイトル
7. PNG 出力 → base64

### Step 3: `lib/visualize/client.ts`

`spawn("uv", ["run", "--directory", "./lib/visualize", "python", "generate.py"])` で起動。タイムアウト 30 秒。失敗時は空配列。

### Step 4: `lib/report/schema.ts`

`summaryDataSchema` に `generated_maps` フィールド追加。

### Step 5: `lib/report/builder.ts`

レポート構築時に `generateMapImages()` を呼び出し。

### Step 6: `components/environment-visualizations.tsx`

`generatedMaps` がある場合は Python 生成画像を表示、ない場合は既存表示にフォールバック。

### Step 7: `components/report-view.tsx`（1行変更）

`generatedMaps` props を追加。

## 主要参照ファイル

- `lib/mcp/types.ts` — `JaxaLayerImage`（`imageDataUrl`, `bbox`）
- `lib/normalizer/jaxa.ts` — `buildVisualization()`
- `lib/report/schema.ts:44-56` — `jaxaVisualizationSchema`
- `components/environment-visualizations.tsx` — 現在の静的表示

## 検証方法

1. `cd lib/visualize && echo '<test-json>' | uv run python generate.py`
2. `pnpm dev` → レポートページで座標付き地図が表示されること
3. Python 失敗時に既存表示にフォールバック
4. `pnpm build && pnpm type-check` エラーなし
