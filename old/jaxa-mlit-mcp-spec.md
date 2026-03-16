# JAXA Earth API × 国交省MCP アプリ企画・仕様書

---

# 出力形式1: 公式調査サマリ

## 1. JAXA側で公式に確認できたこと

### 提供形態
- **Python版**: `jaxa-earth` パッケージ（v0.1.5、2026/01/14公開）。カスタムPyPIインデックス（`https://data.earth.jaxa.jp/api/python/repository/`）から配布
- **JavaScript版**: `jaxa.earth.esm.js`（v2.0.0、2026/02/18公開）。ESM/UMDモジュールとして配布（120KB、依存なし）
- **認証不要**: ユーザー登録・APIキー・利用制限なし
- 出典: [JAXA Earth API公式](https://data.earth.jaxa.jp/en/), [Python MCP docs](https://data.earth.jaxa.jp/api/python/v0.1.5/en/mcpserver.html), [JavaScript docs](https://data.earth.jaxa.jp/api/javascript/v2.0.0/ja/docs/)

### MCP実行方式
- **Python版**: `mcp_server.py` をSTDIOトランスポートで実行。Claude Desktopや自前のMCPクライアントから子プロセスとして起動可能
- **JavaScript版**: Node.js + TypeScriptでSTDIOトランスポート。`server.registerTool()` で1機能1ツール登録。Streamable HTTP版、MCP Apps版も提供
- 出典: [Python MCP Server docs](https://data.earth.jaxa.jp/api/python/v0.1.5/en/mcpserver.html), [JS MCP STDIO docs](https://data.earth.jaxa.jp/api/javascript/v2.0.0/ja/docs/documents/MCP_(STDIO).html)

### 利用可能な主な機能（Python版 MCPツール 4種）
| ツール名 | 説明 |
|---------|------|
| `search_collections_id` | コレクション（データセット）の詳細情報を返す |
| `show_images` | ユーザー入力に基づき衛星画像を表示 |
| `calc_spatial_stats` | 衛星データの空間統計値（mean/std/min/max/median）を算出 |
| `show_spatial_stats` | 空間統計結果をグラフ画像として表示 |

### 利用可能な主な機能（JavaScript版 MCPツール サンプル3種）
| ツール名 | 説明 |
|---------|------|
| `jaxa-earth-api-get-elevation-value` | 指定座標の標高値を取得（AW3D30） |
| `jaxa-earth-api-get-elevation-image` | 標高データのPNG画像を取得 |
| `jaxa-earth-api-get-catalog-list` | 利用可能なデータセットカタログ一覧を取得 |

**重要**: JavaScript版はサンプルとして3ツールが提供されているが、`registerTool` により自由にツールを追加可能。Python版のような統合的な4ツール構成ではなく、**1機能1ツールの粒度**でカスタムツールを開発する設計。
- 出典: [JS MCP STDIO tutorial](https://data.earth.jaxa.jp/api/javascript/v2.0.0/ja/docs/documents/MCP_(STDIO).html)

### 入力パラメータの傾向
- **collection**: STAC collection URL またはコレクションID
- **bbox**: バウンディングボックス `[lng_min, lat_min, lng_max, lat_max]`
- **dlim**: 日付範囲 `["YYYY-MM-DD", "YYYY-MM-DD"]`
- **band**: バンド名（例: "DSM", "NDVI", "LST"）
- **ppu**: ピクセル/単位（解像度指定）
- **width/height**: 出力画像サイズ
- 出典: [Python API Reference](https://data.earth.jaxa.jp/api/python/v0.1.5/en/jaxa.earth.html)

### 返せるデータの種類
80以上のデータセットを提供（COG形式）:
| カテゴリ | 主なデータ | 衛星/ソース | 解像度 |
|---------|-----------|------------|--------|
| 地形 | 全球標高（AW3D30） | ALOS PRISM | ~30m |
| 降水 | GSMaP降水量 | マルチ衛星 | 日次/半月/月次（2000年〜） |
| 地表面温度 | LST | GCOM-C SGLI | ~5km |
| 海面温度 | SST | GCOM-C / GCOM-W | ~250m（沿岸） |
| 植生 | NDVI | GCOM-C SGLI | ~5km |
| 森林 | 森林/非森林マップ | PALSAR-2 | 25m |
| 土壌水分 | Soil Moisture | GCOM-W AMSR2 | 2012年〜 |
| 海氷 | 海氷密度 | GCOM-W AMSR2 | 日次 |
| 大気 | エアロゾル光学厚 | GCOM-C | - |
| 海洋 | クロロフィルa濃度 | GCOM-C | ~250m |
| 放射 | 短波放射 | MODIS | 日次（2002年〜） |
- 出典: [Datasets](https://data.earth.jaxa.jp/en/datasets/), [MCP Catalog](https://data.earth.jaxa.jp/app/mcp/catalog.v2.md)

### 制約
- **認証**: 不要（オープンアクセス、登録・APIキー不要）
- **利用制限**: 公式には明記されていないが、常識的な範囲でのアクセスが前提（推測）
- **ライセンス**: 無料利用、商用利用は大半のデータセットで許可、学術出版時は帰属表示が必要
- **データ形式**: COG (Cloud Optimized GeoTIFF) + STAC
- **配布方式**: PyPIにもnpmにもない。JAXA独自リポジトリ/CDNから配布。GitHubリポジトリも存在しない
- **Python版MCP**: `mcp_server.py` のソースコードは公式ドキュメントからダウンロードが必要
- **JavaScript版MCP**: 3エディション（STDIO/Streamable HTTP/MCP Apps）。サンプルコードのダウンロードが必要
- **STDIO制約**: `console.log()` は使えず `console.error()` のみ（JavaScript版STDIO）
- **SSL問題**: 環境により `NODE_TLS_REJECT_UNAUTHORIZED` の設定が必要な場合あり
- **Python版メソッドチェーン順序**: `filter_date()` → `filter_resolution()` → `filter_bounds()` → `select()` → `get_images()` の順序厳守

### 実装時の注意点
- Python版は `pip install` ではなく `--extra-index-url` が必要
- JavaScript版は Node.js v22+ / TypeScript 5.9+ を要求
- Claude DesktopをMCPホストとして使う場合は、設定変更のたびに完全再起動が必要
- バウンディングボックスの指定ミスでエラーになりやすい
- 大きな領域・長期間のデータ取得はレスポンス時間に影響（推測）

---

## 2. 国交省側で公式に確認できたこと

### mlit-dpf-mcp でできること
**国土交通データプラットフォーム**のGraphQL APIをMCP経由で利用可能にするサーバー。

| ツール名 | 説明 |
|---------|------|
| `search` | キーワードによるデータ検索（ソート・ページネーション対応） |
| `search_by_location_rectangle` | 矩形範囲でのデータ検索 |
| `search_by_location_point_distance` | 中心座標+半径の円形範囲検索 |
| `search_by_attribute` | カタログ名・データセット名・都道府県・市区町村で検索 |
| `get_data` | データの詳細メタデータ取得 |
| `get_data_summary` | データの基本情報（ID・タイトル）取得 |
| `get_data_catalog` | カタログ・データセット詳細取得 |
| `get_data_catalog_summary` | カタログ基本情報取得 |
| `get_file_download_urls` | ファイルダウンロードURL生成（有効期限60秒） |
| `get_zipfile_download_url` | ZIP一括ダウンロードURL生成（有効期限60秒） |
| `get_thumbnail_urls` | サムネイル画像URL取得（有効期限60秒） |
| `get_all_data` | 大量結果のバッチ取得 |
| `get_count_data` | 件数取得 |
| `get_suggest` | オートコンプリート候補取得 |
| `get_prefecture_data` | 都道府県一覧（コード付き） |
| `get_municipality_data` | 市区町村一覧（コード付き） |
| `get_mesh` | メッシュグリッド内データ取得 |
| `normalize_codes` | 都道府県・市区町村名の正規化 |

**検索対象データ**: インフラ施設、PLATEAU（3D都市モデル）、交通、地理・測量、気象・防災情報
- **認証**: APIキーが必要（プラットフォームでアカウント登録）
- **ライセンス**: MIT
- **ステータス**: α版
- 出典: [GitHub](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp), [国土交通データプラットフォーム](https://data-platform.mlit.go.jp/)

### MLIT Geospatial MCP Server でできること
**不動産情報ライブラリAPI** を通じて25種類の不動産・地理空間データにアクセス可能。
- 公式GitHub: https://github.com/chirikuuka/mlit-geospatial-mcp （chirikuuka = 国土交通省地理空間情報課の公式アカウント「MLIT GIS LAB」）
- 作成: 2026/02/17、最終更新: 2026/03/09

**MCPツール5種**:

| ツール名 | 説明 |
|---------|------|
| `get_multi_api` | 25種のAPIを統合的に呼び出す汎用ツール。target_apis配列で呼び出すAPIを指定 |
| `get_land_price_point_by_location` | 地価公示・地価調査のポイントデータ専用ツール |
| `get_urban_planning` | 都市計画区域・区域区分データ専用ツール |
| `get_zoning_district` | 用途地域データ専用ツール |
| `plateau_space_id` | 緯度経度→PLATEAU空間ID（z/f/x/y）変換ツール。PLATEAUデータ利用の前段 |

**get_multi_api の主要パラメータ**:
- `lat` (必須): 緯度
- `lon` (必須): 経度
- `target_apis` (必須): 呼び出すAPI番号の配列（空配列 = 全25 API）
- `distance` (任意): 検索半径（メートル、最大425m、ポイント/ライン系API用）
- `year` (任意): 対象年（1995〜最新）
- `quarter` (任意): 四半期 1-4（API 1用）
- `save_file` (任意): GeoJSON保存フラグ
- その他API個別パラメータ多数

**出力形式**: GeoJSON（不動産情報ライブラリの地図表示URLも付与）
**検索制約**: ポイントデータは最大半径425m、ポリゴンデータは座標と交差するもの

**利用可能な25データソース**:

| # | データ | カテゴリ |
|---|-------|---------|
| 1 | 不動産取引価格情報 | 不動産 |
| 2 | 鑑定評価書情報 | 不動産 |
| 3 | 公示地価・基準地価 | 地価 |
| 4 | 都市計画区域・区域区分 | 都市計画GIS |
| 5 | 用途地域 | 都市計画GIS |
| 6 | 立地適正化計画 | 都市計画GIS |
| 7 | 防火・準防火地域 | 都市計画GIS |
| 8 | 地区計画 | 都市計画GIS |
| 9 | 高度利用地区 | 都市計画GIS |
| 10 | 小学校区 | 教育 |
| 11 | 中学校区 | 教育 |
| 12 | 学校 | 教育 |
| 13 | 保育園・幼稚園 | 福祉 |
| 14 | 医療機関 | 福祉 |
| 15 | 福祉施設 | 福祉 |
| 16 | 図書館 | 公共施設 |
| 17 | 市役所・公民館 | 公共施設 |
| 18 | 駅別乗降客数 | 交通 |
| 19 | 将来推計人口（250mメッシュ） | 人口 |
| 20 | 自然公園地域 | 自然 |
| 21 | 大規模盛土造成地マップ | 災害 |
| 22 | 土砂災害防止法指定区域 | 災害 |
| 23 | 急傾斜地崩壊危険区域 | 災害 |
| 24 | 液状化リスク | 災害 |
| 25 | 災害危険区域 | 災害 |

- **認証**: 不動産情報ライブラリAPIキーが必要
- **ライセンス**: MIT
- **ステータス**: α版
- 出典: [GitHub](https://github.com/chirikuuka/mlit-geospatial-mcp), [国土交通省公式](https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/tochi_fudousan_kensetsugyo_fr17_000001_00047.html)

### 両者の違い

| 比較項目 | mlit-dpf-mcp | MLIT Geospatial MCP |
|---------|-------------|---------------------|
| データソース | 国土交通データプラットフォーム | 不動産情報ライブラリAPI |
| ツール数 | 18種 | 5種（get_multi_api + 専用4種） |
| 対象データ | インフラ・PLATEAU・交通・地理全般 | 不動産・地価・都市計画・防災25種 |
| API方式 | GraphQL | REST API |
| 空間検索 | 矩形・円形・メッシュ（制限なし） | 最大半径425m（ポイントデータ） |
| ファイルDL | 対応（URL生成、60秒失効） | GeoJSONファイル保存対応 |
| 出力形式 | JSON | GeoJSON |
| APIキー取得先 | data-platform.mlit.go.jp | reinfolib.mlit.go.jp |
| GitHub組織 | MLIT-DATA-PLATFORM（公式Org） | chirikuuka / MLIT GIS LAB（公式個人） |
| 公開時期 | 2025/10 | 2026/02 |
| 強み | 広範なデータカタログ横断検索 | 不動産特化の詳細GeoSpatialデータ + PLATEAU空間ID変換 |

### 制約
- 両方ともα版で動作保証なし
- 予告なく変更・削除の可能性
- Claude/Python/GitHubに関する技術的問い合わせは国交省非サポート
- ダウンロードURLは60秒で失効（mlit-dpf-mcp）
- 不動産情報ライブラリの利用規約遵守が必要

### 実装時の注意点
- 両方ともPython 3.10+必須
- APIキーの事前取得が必要（それぞれ別のプラットフォームで取得）
- GraphQL（dpf）とREST（Geospatial）でAPI方式が異なる
- レートリミットの明確な公式記載がない（不足）

---

## 3. 組み合わせ上の整理

### JAXAが担うべき役割
- **衛星観測データの提供**: 標高、地表面温度、海面温度、降水量、植生指数、土壌水分等
- **時系列分析**: 長期間（2000年〜）の環境変化モニタリング
- **空間統計計算**: 指定範囲の統計値（平均・最大・最小等）
- **衛星画像の可視化**: 地表面の視覚的な状態表示

### 国交省MCPが担うべき役割
- **行政・不動産データの提供**: 地価、都市計画、用途地域、防災区域
- **インフラ情報**: 学校、医療機関、交通データ
- **人口動態**: 将来推計人口（250mメッシュ）
- **災害リスク**: 液状化、土砂災害、急傾斜地等のハザード情報

### 機能重複
- **地理的検索**: 両方とも緯度経度・バウンディングボックスでの範囲指定が可能
- **地形データ**: JAXA（AW3D30標高）と国交省（急傾斜地・盛土情報）で一部重複するが、粒度・観点が異なる

### 補完関係
- **JAXA（自然環境）× 国交省（社会環境）**: 衛星で見える物理的環境と、行政区分・インフラ等の社会情報は本質的に補完的
- **JAXA（広域・時系列）× 国交省（地点・スナップショット）**: JAXAは広域の時系列変化、国交省は特定地点の詳細属性
- **JAXA（画像・数値）× 国交省（メタデータ・属性）**: 衛星画像と行政データの重ね合わせ

### 現時点で不足するレイヤー

| レイヤー | 状況 |
|---------|------|
| 認証・ユーザー管理 | 自前で構築が必要。国交省側はAPIキー管理のみ |
| データ保存・キャッシュ | MCP自体はステートレス。永続化は別途必要 |
| 地図UI | Mapbox / Leaflet / Deck.gl 等で自前構築 |
| 予測モデル | 両MCPとも過去〜現在データのみ。将来予測は別途ML/統計モデルが必要 |
| 通知 | なし。リアルタイムアラート等は自前で構築 |
| 決済 | なし |
| レポート生成 | LLMの要約能力に依存。PDF等のフォーマット出力は自前 |
| 座標系変換・ジオコーディング | 住所→座標の変換が必要な場面で外部サービス依存 |
| オーケストレーション | 複数MCP呼び出しの順序制御・結果統合は自前で構築 |

---

# 出力形式2: アプリ案の発散

---

### 案1: 土地環境スコアリングエンジン
### 一言説明
衛星データと行政データを組み合わせ、任意の土地の環境品質スコアを算出する

### 想定ユーザー
不動産デベロッパー、不動産仲介業者、土地購入検討者

### ユーザー課題
土地購入判断に必要な環境情報（日照、植生、災害リスク、周辺施設）が複数サイトに分散しており、統合的な評価が困難

### JAXA MCPの使い方
- `calc_spatial_stats`: 指定地点周辺の地表面温度（ヒートアイランド評価）、NDVI（緑地率）、標高を取得
- `show_images`: 衛星画像で周辺環境を可視化

### 国交省MCPの使い方
- **Geospatial**: 用途地域、地価、災害危険区域、液状化リスク、周辺施設（学校・医療・保育）を取得
- **DPF**: PLATEAUの3D都市モデルデータを検索

### なぜ両方必要か
衛星から見える「物理的環境品質」（温度、緑地、地形）と行政データの「社会的環境品質」（用途規制、災害指定、インフラ充実度）を統合しないと、真の土地評価はできない

### MVPでできる範囲
- 指定座標の衛星環境データ（温度・NDVI・標高）取得
- 同座標の行政データ（用途地域・災害リスク・周辺施設数）取得
- LLMによる統合レポート生成（テキストベース）

### MVPではまだできない範囲
- スコアリングの重み付けロジック最適化
- 地図UI上での可視化
- 時系列での地価予測
- 物件データベースとの連携

### 実装難易度: 中

### 新規性
衛星環境データと不動産情報を1クエリで統合評価するサービスは既存にない

### 収益化の可能性
B2B（不動産会社向けAPI/レポートSaaS）、B2C（土地購入者向け有料レポート）

### リスク
- スコアリングロジックの妥当性検証が必要
- 不動産情報ライブラリの利用規約で商用利用可否の確認が必要

### 公式ドキュメント根拠
- JAXA: [calc_spatial_stats](https://data.earth.jaxa.jp/api/python/v0.1.5/en/jaxa.earth.html) - 空間統計計算
- 国交省: [Geospatial MCP 25 API](https://github.com/chirikuuka/mlit-geospatial-mcp) - 用途地域・災害リスク・施設情報
- 国交省: [DPF MCP](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp) - PLATEAUデータ検索

---

### 案2: 農地コンディションモニター
### 一言説明
衛星の植生・温度・降水データと行政情報を組み合わせ、農地の状態をモニタリング

### 想定ユーザー
農業法人、JA（農協）、自治体農政部門

### ユーザー課題
広域の農地状態をリアルタイムに把握できず、圃場巡回に依存。干ばつ・高温被害の予兆を見逃す

### JAXA MCPの使い方
- `calc_spatial_stats`: NDVI（植生活性度）、地表面温度、土壌水分の時系列統計を農地単位で算出
- `show_images`: 衛星画像で農地の植生状態を可視化
- `show_spatial_stats`: NDVIの時系列変化グラフを生成

### 国交省MCPの使い方
- **DPF**: 農地区画・土地利用データの検索
- **Geospatial**: 自然公園地域、災害危険区域の確認（農地周辺の環境制約把握）

### なぜ両方必要か
衛星データだけでは「どの農地か」「周辺にどんな制約があるか」が分からない。行政データで農地の区画・属性情報を補完することで、初めて実用的なモニタリングになる

### MVPでできる範囲
- 指定範囲のNDVI・LST・土壌水分の現在値と過去比較
- 周辺の土地利用・災害リスク情報
- LLMによる農地状態サマリ生成

### MVPではまだできない範囲
- 収量予測モデル
- 圃場単位の精密管理
- リアルタイムアラート
- 気象予報との統合

### 実装難易度: 中

### 新規性
衛星NDVIと行政土地利用データを統合した農地モニタリングはJAXA MCPで容易に実現可能

### 収益化の可能性
B2B（農業法人・JA向けSaaS）、行政向け（自治体農政モニタリング）

### リスク
- GCOM-C NDVIの解像度（~5km）が圃場単位の管理には粗い
- 農地区画データの粒度が不足する可能性

### 公式ドキュメント根拠
- JAXA: [NDVI/LST datasets](https://data.earth.jaxa.jp/en/datasets/), [calc_spatial_stats](https://data.earth.jaxa.jp/api/python/v0.1.5/en/jaxa.earth.html)
- 国交省: [DPF search_by_location](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp)

---

### 案3: 災害リスク統合ダッシュボード
### 一言説明
衛星観測の物理的リスク指標と行政指定の災害区域を重ね合わせて、統合的な災害リスクを表示

### 想定ユーザー
自治体防災部門、保険会社、不動産デューデリジェンス担当

### ユーザー課題
ハザードマップは行政区域指定のみで、実際の地表面温度上昇・降水パターン変化・植生劣化などの物理的兆候は反映されていない

### JAXA MCPの使い方
- `calc_spatial_stats`: GSMaP降水量の時系列統計（豪雨頻度の変化）、地表面温度の変化
- `show_images`: 標高データ（AW3D30）で地形的なリスク可視化
- `jaxa-earth-api-get-elevation-value`（JS版）: 地点標高取得

### 国交省MCPの使い方
- **Geospatial**: 土砂災害防止法指定区域、急傾斜地、液状化リスク、大規模盛土、災害危険区域（5種の災害データ）
- **DPF**: 防災関連データカタログの横断検索

### なぜ両方必要か
行政指定の災害区域（法的リスク）と衛星で観測される物理的環境変化（実態リスク）を統合することで、より包括的なリスク評価が可能

### MVPでできる範囲
- 指定地点の行政災害指定5種の有無判定
- 同地点のGSMaP降水パターン・標高・地表面温度の取得
- LLMによる統合リスクレポート生成

### MVPではまだできない範囲
- リスクスコアの定量化モデル
- リアルタイム気象データとの連動
- 地図UI上での可視化
- 過去災害事例データベースとの照合

### 実装難易度: 中

### 新規性
衛星物理データと行政ハザード指定の統合は、既存ハザードマップにない付加価値

### 収益化の可能性
B2B（保険会社向けリスク評価API、不動産DD向け）、行政向け

### リスク
- リスク判定の法的責任問題
- 「安全」と誤認されるリスク

### 公式ドキュメント根拠
- JAXA: [GSMaP降水/AW3D30標高/LST](https://data.earth.jaxa.jp/en/datasets/)
- 国交省: [災害関連5データソース](https://github.com/chirikuuka/mlit-geospatial-mcp)

---

### 案4: 都市ヒートアイランド分析ツール
### 一言説明
衛星の地表面温度と都市計画データを組み合わせ、ヒートアイランド現象を用途地域別に分析

### 想定ユーザー
自治体環境部門、都市計画コンサルタント、研究者

### ユーザー課題
ヒートアイランド対策の施策立案に、用途地域別・土地利用別の温度分布データが不足

### JAXA MCPの使い方
- `calc_spatial_stats`: GCOM-C 地表面温度の空間統計（日中/夜間、月次推移）
- `show_images`: LST衛星画像で温度分布を可視化
- `show_spatial_stats`: 温度の時系列変化グラフ

### 国交省MCPの使い方
- **Geospatial**: 用途地域、高度利用地区、都市計画区域を取得
- **DPF**: PLATEAU 3Dモデルで建物密度データを検索

### なぜ両方必要か
温度データだけでは対策を打てない。「商業地域が高温」「住居地域でも緑地減少エリアは高温化」など、都市計画区分との対応関係が施策立案に必須

### MVPでできる範囲
- 指定都市のLST統計値と用途地域情報の対比レポート
- 季節別・用途地域別の温度傾向分析

### MVPではまだできない範囲
- 詳細な建物密度との相関分析
- 緑化シミュレーション
- 地図UI上のオーバーレイ表示

### 実装難易度: 中

### 新規性
用途地域×衛星温度の自動クロス分析

### 収益化の可能性
行政向けコンサルティングツール、ESGレポート素材

### リスク
- LST解像度（~5km）が都市分析には粗い可能性
- 用途地域の境界と衛星データグリッドの不一致

### 公式ドキュメント根拠
- JAXA: [GCOM-C LST](https://data.earth.jaxa.jp/en/datasets/)
- 国交省: [用途地域・都市計画](https://github.com/chirikuuka/mlit-geospatial-mcp)

---

### 案5: 沿岸域環境×不動産価値モニター
### 一言説明
海面温度・クロロフィルa等の沿岸環境データと地価・不動産取引情報を組み合わせた沿岸不動産評価

### 想定ユーザー
沿岸部の不動産投資家、リゾート開発事業者、漁業協同組合

### ユーザー課題
温暖化による海洋環境変化が沿岸不動産価値や漁業に影響するが、衛星データと不動産データを統合的に見る手段がない

### JAXA MCPの使い方
- `calc_spatial_stats`: 海面温度（SST）、クロロフィルa濃度の時系列統計
- `show_images`: 海面温度の衛星画像

### 国交省MCPの使い方
- **Geospatial**: 沿岸部の不動産取引価格、公示地価、災害危険区域

### なぜ両方必要か
海洋環境の変化（SST上昇、赤潮リスク）と沿岸不動産価値は相互に影響するが、現在統合データが存在しない

### MVPでできる範囲
- 沿岸エリア指定でSST推移と地価推移のレポート生成
- 災害リスクとの統合表示

### MVPではまだできない範囲
- 因果関係分析モデル
- 予測モデル
- 漁獲データとの連携

### 実装難易度: 中

### 新規性
海洋衛星データと不動産データの統合は新しい

### 収益化の可能性
ニッチだがリゾート開発・沿岸投資分野で需要

### リスク
- 相関≠因果の解釈リスク
- 対象エリアが限定的

### 公式ドキュメント根拠
- JAXA: [SST/クロロフィルa](https://data.earth.jaxa.jp/en/datasets/)
- 国交省: [不動産取引価格/地価](https://github.com/chirikuuka/mlit-geospatial-mcp)

---

### 案6: 子育て環境AIレポーター
### 一言説明
衛星環境データと周辺施設・学区情報を統合し、子育て世帯向けの居住地レポートを生成

### 想定ユーザー
子育て世帯（特に転居検討中の家庭）、ファミリー向け不動産仲介

### ユーザー課題
「子育てしやすい街」の判断材料が口コミに偏り、客観的な環境データ（温度環境、緑地率、災害リスク）と施設データ（学校・保育園・医療機関）を統合的に見られない

### JAXA MCPの使い方
- `calc_spatial_stats`: NDVI（周辺の緑地率）、LST（夏場の温度環境）
- `show_images`: 衛星画像で周辺環境を視覚的に提示

### 国交省MCPの使い方
- **Geospatial**: 小学校区・中学校区、保育園・幼稚園、医療機関、公園（自然公園）、災害危険区域

### なぜ両方必要か
施設の充実度だけでなく、物理的な環境品質（緑地の多さ、夏の暑さ、災害リスク）を含めた総合判断が必要

### MVPでできる範囲
- 住所入力→周辺施設数+衛星環境データのテキストレポート
- 学区・災害リスクの確認

### MVPではまだできない範囲
- 地図UI
- 複数候補地の比較機能
- 通勤時間との統合

### 実装難易度: 低〜中

### 新規性
衛星環境データ×子育て施設の統合は新しい切り口

### 収益化の可能性
B2C（フリーミアムレポート）、B2B（不動産仲介向けツール）

### リスク
- 情報の鮮度（施設の開廃業）
- 「子育てしやすさ」の定義の曖昧さ

### 公式ドキュメント根拠
- JAXA: [NDVI/LST](https://data.earth.jaxa.jp/en/datasets/)
- 国交省: [学校区・保育園・医療機関](https://github.com/chirikuuka/mlit-geospatial-mcp)

---

### 案7: 森林・緑地変化モニター
### 一言説明
PALSAR-2森林マップとNDVIの時系列変化を行政区域・インフラデータと重ね合わせて緑地変化を追跡

### 想定ユーザー
自治体環境部門、環境コンサルタント、ESG投資家

### ユーザー課題
開発による緑地減少を定量的に把握し、環境影響評価やESGレポートに活用したいが、衛星データの扱いが難しい

### JAXA MCPの使い方
- `calc_spatial_stats`: NDVI時系列統計で植生変化を検出
- `show_images`: PALSAR-2 森林/非森林マップの可視化
- `show_spatial_stats`: NDVI経年変化グラフ

### 国交省MCPの使い方
- **DPF**: 土地利用データ・PLATEAU建物データの変化検索
- **Geospatial**: 都市計画区域、自然公園地域の境界確認

### なぜ両方必要か
衛星で「緑地が減った」ことは分かるが、「なぜ減ったか（開発？用途変更？）」は行政データがないと判明しない

### MVPでできる範囲
- 指定エリアのNDVI変化＋都市計画情報のレポート
- 森林/非森林マップの表示

### MVPではまだできない範囲
- 変化原因の自動推定
- 将来シミュレーション
- カーボンクレジット算定

### 実装難易度: 中

### 新規性
衛星森林データ×行政土地利用の変化追跡

### 収益化の可能性
ESGコンサル向け、環境影響評価支援

### リスク
- PALSAR-2森林マップの更新頻度
- 緑地変化の要因特定は複雑

### 公式ドキュメント根拠
- JAXA: [PALSAR-2 Forest Map / NDVI](https://data.earth.jaxa.jp/en/datasets/)
- 国交省: [都市計画・自然公園](https://github.com/chirikuuka/mlit-geospatial-mcp), [DPF](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp)

---

### 案8: 地域ポテンシャル診断AI
### 一言説明
衛星データと行政データを統合し、特定地域の開発・投資ポテンシャルを多角的に診断

### 想定ユーザー
地方自治体（企業誘致担当）、地域金融機関、不動産ファンド

### ユーザー課題
地域の開発ポテンシャルを客観的に評価するデータが分散・不統一で、比較困難

### JAXA MCPの使い方
- `calc_spatial_stats`: 標高・地形、気温環境、日照（短波放射）の統計
- `show_images`: 地域の衛星俯瞰画像
- `search_collections_id`: 利用可能データセットの探索

### 国交省MCPの使い方
- **Geospatial**: 地価推移、人口推計、駅乗降客数、都市計画、災害リスク
- **DPF**: インフラデータの横断検索

### なぜ両方必要か
自然環境（気候・地形）と社会環境（人口動態・インフラ・交通）の両面がないと地域評価はできない

### MVPでできる範囲
- 指定地域の環境+社会データの統合レポート
- 複数地域の簡易比較

### MVPではまだできない範囲
- 投資リターン予測
- 産業適性分析
- 動的スコアリング

### 実装難易度: 中〜高

### 新規性
衛星環境+行政社会データの統合地域診断

### 収益化の可能性
B2G（自治体）、B2B（金融機関・ファンド）

### リスク
- 評価指標の設計が複雑
- 利用規約上の商用利用可否

### 公式ドキュメント根拠
- JAXA: [全データセット](https://data.earth.jaxa.jp/en/datasets/)
- 国交省: [Geospatial 25 API](https://github.com/chirikuuka/mlit-geospatial-mcp), [DPF 18 tools](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp)

---

### 案9: インフラ老朽化リスクスクリーナー（ボーナス案）
### 一言説明
衛星画像の経年変化とインフラ台帳データを組み合わせ、老朽化リスクの高いインフラを優先順位付け

### 想定ユーザー
自治体インフラ管理部門、建設コンサルタント

### ユーザー課題
膨大なインフラ施設の点検優先順位付けにデータが不足

### JAXA MCPの使い方
- `show_images`: 衛星画像の経年比較（植生侵食、地盤変動の兆候検出）
- `calc_spatial_stats`: 周辺環境変化の定量化

### 国交省MCPの使い方
- **DPF**: インフラ台帳（橋梁、トンネル等）の検索、PLATEAUデータ

### なぜ両方必要か
台帳データ（年齢・材質）と衛星画像（物理的変化）の両方がないと優先順位付けできない

### MVPでできる範囲
- 指定エリアのインフラ一覧＋周辺環境データのレポート

### MVPではまだできない範囲
- 画像ベースの劣化検出AI
- 点検記録との統合

### 実装難易度: 高

### 新規性
高い（衛星×インフラ台帳の統合スクリーニング）

### 収益化の可能性
B2G（自治体DX）、建設コンサル向け

### リスク
- 衛星解像度がインフラ個別の劣化検出には不十分（~30m最高）
- DPFにインフラ台帳データがどこまで含まれるか要確認（不足）

### 公式ドキュメント根拠
- JAXA: [AW3D30/衛星画像](https://data.earth.jaxa.jp/en/datasets/)
- 国交省: [DPF インフラ施設データ](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp)

---

# 出力形式3: 絞り込み評価

## 比較表

| 評価軸 | 案1 土地環境 | 案2 農地 | 案3 災害 | 案4 ヒート | 案5 沿岸 | 案6 子育て | 案7 森林 | 案8 地域 | 案9 インフラ |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 実装容易性 | ◎ | ○ | ◎ | ○ | ○ | ◎ | ○ | △ | △ |
| データ取得安定性 | ◎ | ○ | ◎ | ○ | ○ | ◎ | ○ | ○ | △ |
| デモ映え | ◎ | ○ | ◎ | ◎ | ○ | ◎ | ○ | ○ | △ |
| 社会実装しやすさ | ◎ | ○ | ◎ | ○ | △ | ◎ | ○ | △ | △ |
| B2B適性 | ◎ | ○ | ◎ | ○ | △ | ○ | ○ | ◎ | ◎ |
| 行政適性 | ○ | ○ | ◎ | ◎ | △ | ○ | ◎ | ◎ | ◎ |
| 一次産業適性 | △ | ◎ | ○ | △ | ○ | × | ◎ | △ | × |
| 不動産適性 | ◎ | × | ◎ | ○ | ○ | ◎ | △ | ○ | × |
| 将来的拡張性 | ◎ | ◎ | ◎ | ○ | △ | ○ | ◎ | ◎ | ○ |

## 上位3案

### 🥇 1位: 案1「土地環境スコアリングエンジン」
**選定理由**: 実装容易性・デモ映え・不動産適性・B2B適性・拡張性のすべてで高評価。JAXA（環境物理データ）と国交省（行政不動産データ）の補完関係が最も明確。不動産市場という巨大な出口があり、MVPからの段階的拡張パスが見える。

### 🥈 2位: 案3「災害リスク統合ダッシュボード」
**選定理由**: 行政適性・B2B適性（保険）が突出。国交省の災害関連5データソースをフル活用でき、社会的意義も高い。ただし「リスク」を扱うため法的責任の設計が必要。

### 🥉 3位: 案6「子育て環境AIレポーター」
**選定理由**: 実装難易度が低く、デモ映えする。B2Cにも展開可能で、国交省Geospatialの施設系データを最大限活用できる。ただし収益化は案1・3より弱い。

---

# 出力形式4: MVP仕様書（案1: 土地環境スコアリングエンジン）

## 1. プロダクト概要

**名称**: TerraScore（テラスコア）

**概要**: 衛星観測データ（JAXA Earth API）と行政データ（国交省MCP）を統合し、任意の地点の「環境品質レポート」を自然言語で生成するAIツール。不動産取引・投資判断・居住地選定を支援する。

**コア価値**: 複数の公的データソースを横断して、1クエリで統合的な土地環境評価を得られる。

## 2. 対象ユーザー

| ペルソナ | 特徴 | 利用シーン |
|---------|------|-----------|
| 不動産デベロッパー | 土地仕入れの判断を迅速化したい | 候補地の環境品質事前スクリーニング |
| 不動産仲介業者 | 顧客に客観的な物件環境情報を提供したい | 物件紹介資料への環境データ添付 |
| 土地購入検討者 | 住む場所の環境を多角的に知りたい | 候補地の比較検討 |
| 自治体都市計画担当 | 地域の環境品質を把握したい | まちづくり計画の基礎資料 |

## 3. 解決する課題

1. **データ分散問題**: 衛星データ・地価・用途地域・災害リスク・施設情報が別々のサイト・APIに散在し、統合的な評価に時間がかかる
2. **専門知識の壁**: 衛星データ（COG/STAC）やGIS APIの扱いに専門知識が必要
3. **定量比較の困難**: 異なるデータソースの指標を同一基準で比較する手段がない

## 4. ユースケース

### ユースケース1: 候補地の環境クイック診断
- **アクター**: 不動産デベロッパー
- **フロー**: 住所 or 座標を入力 → 衛星環境データ＋行政データを自動取得 → 統合レポート（テキスト＋数値）を表示
- **成功条件**: 5分以内に主要環境指標がすべて揃ったレポートが得られる

### ユースケース2: 複数候補地の比較
- **アクター**: 土地購入検討者
- **フロー**: 2〜3箇所の住所を入力 → 各地点のレポートを並列生成 → 比較サマリをLLMが生成
- **成功条件**: 各指標の比較表＋総合コメントが得られる

### ユースケース3: 災害リスク重点チェック
- **アクター**: 不動産仲介業者
- **フロー**: 物件住所を入力 → 災害関連データ（液状化・土砂・急傾斜地・標高・降水パターン）に絞ったレポート生成
- **成功条件**: 重説（重要事項説明）の補助資料として使えるレベルの情報が得られる

## 5. 画面仕様

### 画面1: 入力画面
- **目的**: 分析対象地点の指定
- **入力**:
  - 住所テキスト（自由入力）or 緯度経度
  - 分析モード選択（総合/災害重点/不動産重点）
  - 分析範囲（半径: 500m/1km/3km）
- **出力**: バリデーション結果、ジオコーディング結果の確認表示
- **操作**: 「分析開始」ボタン
- **エラーパターン**:
  - 住所が特定できない → 候補提示
  - 海上の座標 → エラーメッセージ

### 画面2: 分析中画面
- **目的**: 処理進捗の表示
- **入力**: なし
- **出力**: 各MCP呼び出しの進捗状況（ステップインジケーター）
- **操作**: キャンセルボタン
- **エラーパターン**:
  - MCP接続エラー → リトライ or 部分結果で続行
  - タイムアウト → 取得できたデータのみでレポート生成

### 画面3: レポート画面
- **目的**: 統合環境レポートの表示
- **入力**: なし（画面1からの引き継ぎ）
- **出力**:
  - 環境サマリ（LLM生成テキスト）
  - 衛星画像サムネイル（NDVI/LST/標高）
  - 行政データ一覧（用途地域、地価、災害指定、周辺施設）
  - 数値テーブル
- **操作**:
  - セクション折りたたみ
  - PDF出力
  - 別地点の追加比較
- **エラーパターン**:
  - 一部データ取得失敗 → 欠損箇所を明示して他は表示

### 画面4: 比較画面
- **目的**: 複数地点のレポート比較
- **入力**: 2〜3地点の選択
- **出力**: 項目別比較テーブル、LLM生成の比較コメント
- **操作**: 比較軸の選択
- **エラーパターン**: 1地点しかない場合は比較不可メッセージ

## 6. 機能要件

| 機能ID | 機能名 | 概要 | 必須/任意 | 利用MCP | 入力 | 出力 | 異常系 |
|--------|--------|------|----------|---------|------|------|--------|
| F-001 | ジオコーディング | 住所→座標変換 | 必須 | 外部（Google/国土地理院API） | 住所文字列 | 緯度・経度 | 住所不明→候補提示 |
| F-002 | 衛星環境データ取得 | NDVI/LST/標高/降水統計を取得 | 必須 | JAXA MCP | 座標・範囲・日付範囲 | 統計値+画像 | API障害→キャッシュ or エラー表示 |
| F-003 | 行政不動産データ取得 | 用途地域/地価/施設/災害区域を取得 | 必須 | 国交省 Geospatial MCP | 座標・APIキー | 25種のデータ | API障害→部分結果 |
| F-004 | インフラデータ検索 | PLATEAUや交通データを横断検索 | 任意 | 国交省 DPF MCP | キーワード・座標・範囲 | メタデータ一覧 | 該当なし→空結果 |
| F-005 | データ統合・正規化 | 複数MCPの結果を統一フォーマットに | 必須 | なし（アプリ内ロジック） | 各MCP結果 | 正規化JSON | データ型不整合→デフォルト値 |
| F-006 | レポート生成 | LLMによる統合分析レポート作成 | 必須 | なし（LLM） | 正規化データ | Markdownテキスト | LLMエラー→テンプレート出力 |
| F-007 | 衛星画像表示 | 衛星画像のサムネイル表示 | 必須 | JAXA MCP | 座標・コレクション | PNG画像 | 画像取得失敗→プレースホルダー |
| F-008 | 比較機能 | 複数地点の並列比較 | 任意 | 全MCP | 複数座標セット | 比較テーブル | 2地点目の取得失敗→1地点のみ表示 |
| F-009 | PDF出力 | レポートのPDFエクスポート | 任意 | なし | レポートHTML | PDFファイル | 生成失敗→再試行 |

## 7. MCPツール設計

### ツール1: search_dataset_catalog
- **役割**: 利用可能なJAXAデータセットの検索
- **公式対応**: Python版 `search_collections_id` / JS版 `jaxa-earth-api-get-catalog-list`
- **入力**: `{ keywords: string[] }` （例: ["LST", "temperature"]）
- **出力**: `{ collections: [{ id, name, description, bands, temporal_range }] }`
- **エラー**: ネットワークエラー → 空配列を返しログ記録

### ツール2: get_satellite_stats
- **役割**: 指定範囲の衛星データ統計値を計算
- **公式対応**: Python版 `calc_spatial_stats`
- **入力**: `{ collection: string, band: string, bbox: [number,number,number,number], date_range: [string,string] }`
- **出力**: `{ mean: number, std: number, min: number, max: number, median: number, unit: string }`
- **エラー**: 範囲外 → エラーメッセージ、データなし → null値

### ツール3: get_satellite_image
- **役割**: 衛星画像の取得
- **公式対応**: Python版 `show_images` / JS版 `jaxa-earth-api-get-elevation-image`
- **入力**: `{ collection: string, band: string, bbox: [number,number,number,number], date_range: [string,string], colormap?: string }`
- **出力**: `{ image_base64: string, format: "png" }`
- **エラー**: 画像生成失敗 → プレースホルダー画像

### ツール4: get_elevation
- **役割**: 指定座標の標高取得
- **公式対応**: JS版 `jaxa-earth-api-get-elevation-value`
- **入力**: `{ longitude: number, latitude: number }`
- **出力**: `{ elevation_m: number }`
- **エラー**: 海上座標 → 0またはnull

### ツール5: get_land_info
- **役割**: 不動産・都市計画・施設情報の統合取得
- **公式対応**: Geospatial MCP `get_multi_api`
- **入力**: `{ latitude: number, longitude: number, data_types: string[] }` （例: ["zoning", "land_price", "disaster_risk", "schools", "medical"]）
- **出力**: `{ zoning: {...}, land_price: {...}, disaster_zones: [...], facilities: [...] }`
- **エラー**: APIキー無効 → 認証エラー、データなし → 空オブジェクト

### ツール6: search_infrastructure
- **役割**: インフラ・PLATEAU データの検索
- **公式対応**: DPF MCP `search` / `search_by_location_rectangle`
- **入力**: `{ keyword?: string, bbox?: [number,number,number,number], prefecture?: string }`
- **出力**: `{ results: [{ id, title, description, data_type, download_url? }], total_count: number }`
- **エラー**: APIキー無効 → 認証エラー

### ツール7: get_disaster_risk
- **役割**: 災害リスク情報の集中取得
- **公式対応**: Geospatial MCP `get_multi_api`（災害系5データソースを一括）
- **入力**: `{ latitude: number, longitude: number }`
- **出力**: `{ liquefaction: {...}, landslide: {...}, steep_slope: {...}, large_fill: {...}, disaster_zone: {...} }`
- **エラー**: 部分取得失敗 → 取得できたもののみ返却

## 8. データフロー

```
[ユーザー入力]
    │ 住所 or 座標 + 分析モード
    ▼
[ジオコーディング] ← 外部API（国土地理院 or Google）
    │ 緯度・経度
    ▼
[オーケストレーター（LLM）]
    │ 分析モードに応じてツール呼び出しを計画
    ├──────────────┬──────────────┐
    ▼              ▼              ▼
[JAXA MCP]    [Geospatial MCP]  [DPF MCP]
 ・NDVI統計     ・用途地域        ・PLATEAU検索
 ・LST統計      ・地価            ・インフラ検索
 ・標高         ・災害区域
 ・降水統計     ・周辺施設
 ・衛星画像     ・人口推計
    │              │              │
    └──────────────┴──────────────┘
                   │
                   ▼
           [結果正規化レイヤー]
            ・データ型統一
            ・欠損値ハンドリング
            ・単位変換
                   │
                   ▼
           [LLM説明生成]
            ・統合分析テキスト
            ・リスク要約
            ・推奨事項
                   │
                   ▼
           [レポート表示]
            ・サマリテキスト
            ・衛星画像
            ・数値テーブル
            ・災害リスク一覧
```

## 9. 非機能要件

| 項目 | 要件 |
|------|------|
| **性能** | 1レポート生成: 30秒以内（目標）。各MCP呼び出しは並列化。タイムアウト: MCP個別15秒、全体60秒 |
| **ログ** | MCP呼び出しのリクエスト/レスポンス/エラーを構造化ログ（JSON）で記録。個人情報は含めない |
| **再試行** | MCP呼び出し失敗時は1回リトライ（指数バックオフ1秒→2秒）。2回失敗で部分結果モードに移行 |
| **キャッシュ** | 衛星統計データ: 24時間キャッシュ（日次データの場合）。行政データ: 1時間キャッシュ。キャッシュキー: collection+bbox+date |
| **セキュリティ** | APIキーはサーバーサイドのみ保持（フロント非露出）。入力バリデーション（座標範囲、文字列長制限）。XSS/インジェクション対策 |
| **APIキー管理** | 環境変数で管理（.env）。国交省DPF/Geospatialの2種のAPIキーを個別管理 |
| **監査性** | 全クエリログを保存（座標・分析モード・結果概要）。利用統計の月次集計可能 |
| **LLM切替性** | `ollama` と `openai` など複数プロバイダを切替可能にする。入力は共通の正規化JSONに固定 |

## 10. 技術構成案

| レイヤー | 技術 | 理由 |
|---------|------|------|
| **フロントエンド** | Next.js (App Router) + TailwindCSS | SSR対応、React Server Components でMCP結果のストリーミング表示 |
| **バックエンド** | Next.js Route Handlers / Node.js | フロントと統合。MCPクライアント、オーケストレーター、LLMアダプタをサーバーサイドで実行 |
| **MCP接続** | MCP SDK (TypeScript) + stdio/streamable HTTP | JAXA JS版MCPはstdio、国交省MCPもstdio。順序制御・再試行・タイムアウトはアプリ側コードで実装 |
| **LLM実行基盤** | Ollama + `qwen3.5:35b-a3b`（ローカル開発） | ローカルで開発でき、APIコストなし。まずはレポート生成専用で利用 |
| **LLMフォールバック** | OpenAI Responses API など（任意） | 本番で品質・速度・安定性が不足した場合に切替可能 |
| **データ保存** | SQLite（MVP）→ PostgreSQL（拡張時） | レポート履歴、キャッシュ、ユーザー設定 |
| **認証** | なし（MVP）→ NextAuth.js（拡張時） | MVP は認証不要。拡張時にGoogle/GitHub認証 |
| **地図表示** | Leaflet + OpenStreetMap（MVP）→ Mapbox GL JS（拡張時） | MVPはOSS地図で十分。拡張時に3D対応 |
| **監視** | console.error + 構造化ログ（MVP）→ Sentry（拡張時） | |
| **ジオコーディング** | 国土地理院API（無料）→ Google Geocoding API（拡張時） | |
| **デプロイ** | Docker + Cloud Run / Render / Railway | Node.js + Python + stdio MCP の混在構成をまとめて載せやすい |

## 11. 実装ステップ

### Step 1: 最小実装（1〜2週間）
- JAXA MCP（JS版 STDIO）のセットアップ、標高+NDVI+LST取得ツール実装
- 国交省Geospatial MCPのセットアップ、用途地域+災害リスク取得
- Node.js側でMCPオーケストレーターを実装し、並列実行・再試行・部分結果処理を固定ロジック化
- Ollama + `qwen3.5:35b-a3b` によるレポート生成テンプレートを実装
- **成果物**: ローカルCLIまたはローカルAPIに住所を入力すると統合レポートが返るデモ

### Step 2: 実用化（2〜4週間）
- Web UI（Next.js）の構築
- 国交省DPF MCPの統合
- 地図表示（Leaflet）
- 複数地点比較機能
- PDF出力
- キャッシュ層の実装
- Dockerfile整備とステージング環境へのデプロイ
- **成果物**: ブラウザで使えるWebアプリケーション + コンテナデプロイ可能な構成

### Step 3: 拡張（4週間〜）
- スコアリングロジック（重み付き総合スコア）
- 時系列比較（1年前 vs 現在）
- PLATEAU 3Dビューとの統合
- ユーザー認証・レポート保存
- API提供（B2B向け）
- LLMプロバイダ切替機能（`ollama` / `openai`）と本番最適化
- **成果物**: SaaS版プロダクト

## 12. 制約・不確実性

### 公式に確認できたこと
- JAXA Earth APIは認証不要でMCPツール4種（Python）/サンプル3種（JS）が利用可能
- 国交省Geospatial MCPは25種の不動産・地理データにアクセス可能（APIキー要）
- 国交省DPF MCPは18種のツールでインフラデータを検索可能（APIキー要）
- すべてstdioトランスポートで接続可能。公式例としてClaude Desktopとの接続は確認済
- 出典: 上記各公式URL

### 公式には確認できないこと
- JAXA MCPの同時リクエスト制限・レートリミット（不足）
- 国交省APIのレートリミット詳細（不足）
- 不動産情報ライブラリAPIの商用利用可否の詳細条件（不足）
- 国交省DPFのPLATEAUデータの具体的な検索可能範囲（不足）
- JavaScript版JAXA MCPの全ツール一覧（サンプル3種は確認済だが、公式に推奨される全ツール構成は不明）

### 実装前に検証すべき点
1. 国交省の2つのAPIキーの取得プロセスと所要時間
2. JAXA衛星データの応答速度（大きな bbox 指定時）
3. 国交省Geospatial MCP `get_multi_api` の25 API同時呼び出し時の挙動
4. GCOM-C LST（~5km解像度）が地点レベルの分析に十分か
5. 自前のNode.js MCPクライアントで3つのMCPサーバーを同時接続した際の安定性
6. Ollama + `qwen3.5:35b-a3b` の推論時間とメモリ使用量が30秒目標に収まるか
7. 本番でOllama同梱デプロイにするか、OpenAI等のAPI型LLMに切り替えるか

### 法務・利用規約上の注意点
- 不動産情報ライブラリ: 利用規約・プライバシーポリシーの遵守必須（出典: [国交省公式ページ](https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/tochi_fudousan_kensetsugyo_fr17_000001_00047.html)）
- JAXA Earth API: 利用規約は公式サイト参照。「登録・APIキー不要」だが商用利用条件は要確認
- 国交省DPF: 利用規約の遵守が必要（出典: [DPF GitHub](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp)）
- 生成されたレポートの「助言」としての位置づけ：不動産取引の意思決定に直接利用される場合、免責事項が必須

## 13. 代替案

### JAXA中心案
JAXA MCPのみを使い、衛星データの可視化・分析に特化したツール。行政データは利用しない。
- **メリット**: APIキー不要、実装が簡単
- **デメリット**: 社会実装価値が限定的（研究用途止まり）

### 国交省中心案
国交省MCPのみを使い、不動産・インフラデータの検索・比較ツール。衛星データは利用しない。
- **メリット**: データの信頼性が高い（公的データ）
- **デメリット**: 類似サービスが既に存在（不動産情報ライブラリ自体がUIを持つ）

### 両方使わない代替案
Google Earth Engine + OpenStreetMap + 公開統計データで同等機能を構築。
- **メリット**: データソースが豊富、グローバル対応
- **デメリット**: MCP統合の利点がない、GEEの利用制限、セットアップが複雑

---

# 出力形式5: 実装開始用アセット

## 1. MVPのシステムプロンプト

```
あなたは「TerraScore」の環境分析AIアシスタントです。

あなたの役割は、アプリケーションが収集・正規化した地点データをもとに、
環境品質レポートを分かりやすい日本語で生成することです。

入力として渡されるデータ:
- JAXA Earth API由来の衛星観測データ（標高、植生指数、地表面温度、降水量等）
- 国交省 Geospatial MCP由来の不動産・都市計画・災害・施設データ
- 国交省 DPF MCP由来のインフラ・PLATEAU等の検索結果
- 欠損値、取得失敗、注意事項を含む正規化済みJSON

分析手順:
1. 渡されたJSONから分析対象地点と分析モードを把握する
2. 自然環境、都市環境、リスクの順に情報を読む
3. 欠損値や取得失敗を踏まえて、断定を避けつつ要点を整理する
4. 構造化レポートを生成する

レポート構成:
- 環境サマリ（2〜3文の概要）
- 自然環境: 標高、植生、温度環境、降水傾向
- 都市環境: 用途地域、地価水準、周辺施設
- リスク: 災害指定区域の有無、液状化・土砂災害リスク
- 総合評価

注意:
- データが取得できなかった項目は「データ未取得」と明記する
- 推測は「推測」と明記する
- ツール呼び出しや追加取得を前提にしない
- 不動産購入の最終判断は専門家への相談を推奨する文言を必ず付ける
- 数値には単位を必ず付ける
```

## 2. MCPオーケストレーション仕様（コード実装用）

```
TerraScoreではMCPの順序制御をLLMに任せず、アプリケーションコードで実装する。

基本ルール:
1. 独立したMCP呼び出しは必ず並列実行する
2. JAXA系と国交省系は常に別promiseとして扱い、片方が失敗しても他方は継続する
3. 各ツールの応答時間が15秒を超えたらタイムアウトとして扱う
4. 再試行は1回まで。2回失敗したツールは `status=partial_failure` として結果に残す
5. LLMにはツール生レスポンスではなく、正規化済みJSONのみを渡す

呼び出し順序（総合モード）:
[並列グループ1]
  - get_elevation(lng, lat) → JAXA
  - get_satellite_stats(NDVI, bbox, date) → JAXA
  - get_satellite_stats(LST_Day, bbox, date) → JAXA
  - get_land_info(lat, lng, ["zoning","land_price","schools","medical","nursery"]) → 国交省Geospatial
  - get_disaster_risk(lat, lng) → 国交省Geospatial

[並列グループ2]（グループ1完了後、必要に応じて）
  - get_satellite_image(NDVI, bbox, date) → JAXA
  - search_infrastructure(keyword, bbox) → 国交省DPF

[最終]
  - normalizeResults()
  - generateReport(normalizedJson, provider=ollama, model=qwen3.5:35b-a3b)
  - provider障害時のみ OpenAI 等のフォールバックを許可
```

## 3. 画面一覧

| # | 画面名 | パス | 主要コンポーネント |
|---|--------|------|-------------------|
| 1 | トップ/入力画面 | `/` | AddressInput, ModeSelector, RadiusSelector, AnalyzeButton |
| 2 | 分析中画面 | `/analyzing` | ProgressStepper, CancelButton |
| 3 | レポート画面 | `/report/[id]` | SummaryCard, SatelliteImageViewer, DataTable, DisasterRiskPanel, MapView |
| 4 | 比較画面 | `/compare` | ComparisonTable, RadarChart |

## 4. API呼び出し順

```
1. POST /api/geocode        → 住所→座標変換
2. POST /api/analyze         → 分析開始（以下を内部で並列実行）
   ├─ JAXA MCP: get_elevation
   ├─ JAXA MCP: get_satellite_stats (NDVI)
   ├─ JAXA MCP: get_satellite_stats (LST)
   ├─ JAXA MCP: get_satellite_stats (GSMaP)
   ├─ Geospatial MCP: get_multi_api (zoning)
   ├─ Geospatial MCP: get_multi_api (land_price)
   ├─ Geospatial MCP: get_multi_api (disaster x5)
   └─ Geospatial MCP: get_multi_api (facilities)
3. POST /api/generate-report → LLMによるレポート生成
4. GET  /api/report/[id]     → 生成済みレポート取得
```

## 5. デモシナリオ

```
【デモタイトル】「東京都世田谷区三軒茶屋の環境品質を30秒で診断」

1. [画面1] 住所欄に「東京都世田谷区三軒茶屋2丁目」と入力
2. [画面1] 分析モード「総合」、範囲「1km」を選択
3. [画面1] 「分析開始」をクリック
4. [画面2] 進捗表示:
   - ✅ 座標特定完了（35.6437, 139.6713）
   - ✅ JAXA: 標高 35.2m 取得
   - ✅ JAXA: NDVI 0.42（中程度の緑地）取得
   - ✅ JAXA: 地表面温度 32.1°C 取得
   - ✅ 国交省: 用途地域「商業地域」取得
   - ✅ 国交省: 災害リスク情報取得
   - ✅ 国交省: 周辺施設16件取得
5. [画面3] レポート表示:
   「三軒茶屋2丁目は商業地域に位置し、標高35.2mの比較的平坦な地形です。
    NDVI 0.42は都市部としては平均的な緑地率を示します。
    夏季の地表面温度は32.1°Cでヒートアイランドの影響が見られます。
    液状化リスク: 低、土砂災害: 指定なし。
    半径1km以内に小学校3校、医療機関8施設、保育園5施設があり、
    生活利便性は高い地域です。」
6. [画面3] 衛星画像（NDVI）のサムネイルを表示
7. [比較] 「世田谷区用賀」を追加して比較デモ
```

## 6. ハッカソン向けの一言ピッチ

**「JAXAの衛星で地球を見て、国交省のデータで街を知る。TerraScoreは、任意の場所の環境品質を30秒で診断するAIです。」**

## 7. README冒頭ドラフト

```markdown
# TerraScore - 衛星×行政データ統合 環境品質診断AI

JAXAの衛星観測データと国土交通省の行政データを、MCP（Model Context Protocol）で
統合し、任意の地点の環境品質レポートを自然言語で生成するAIツールです。
ローカル開発では Ollama + `qwen3.5:35b-a3b` を使い、本番では必要に応じてAPI型LLMへ切り替え可能です。

## できること
- 🛰️ JAXA衛星データ: 標高・植生指数・地表面温度・降水パターンの自動取得・統計計算
- 🏛️ 国交省データ: 用途地域・地価・災害リスク・周辺施設（学校/医療/保育）の一括取得
- 📊 統合レポート: LLMが両データを分析し、分かりやすい日本語レポートを生成
- 🔄 複数地点の比較分析

## データソース
| ソース | MCP | 主なデータ |
|--------|-----|-----------|
| [JAXA Earth API](https://data.earth.jaxa.jp/) | STDIO (Node.js) | 80+衛星データセット（認証不要） |
| [不動産情報ライブラリ](https://www.mlit.go.jp/) | STDIO (Python) | 25種の不動産・地理空間データ（APIキー要） |
| [国土交通データプラットフォーム](https://data-platform.mlit.go.jp/) | STDIO (Python) | インフラ・PLATEAU等（APIキー要） |

## クイックスタート

### 前提条件
- Node.js v22+
- Python 3.10+
- Ollama
- `ollama pull qwen3.5:35b-a3b`
- 国交省 不動産情報ライブラリ APIキー
- 国交省 データプラットフォーム APIキー
- 任意: OpenAI API Key（本番フォールバック用）

### セットアップ
\```bash
# リポジトリのクローン
git clone https://github.com/your-org/terrascore.git
cd terrascore

# 依存関係のインストール
pnpm install

# JAXA MCP (JavaScript版) のセットアップ
cd mcp-servers/jaxa && pnpm install && pnpm build && cd ../..

# 国交省 Geospatial MCP のセットアップ
cd mcp-servers/geospatial && uv venv && source .venv/bin/activate && uv pip install -r requirements.txt && deactivate && cd ../..

# 国交省 DPF MCP のセットアップ
cd mcp-servers/dpf && uv venv && source .venv/bin/activate && uv pip install -e . && deactivate && cd ../..

# 環境変数の設定
cp .env.example .env
# .env を編集して各APIキーと LLM_PROVIDER=ollama, OLLAMA_MODEL=qwen3.5:35b-a3b を設定

# Ollama起動（未起動の場合）
ollama serve

# 開発サーバー起動
pnpm dev
\```

## アーキテクチャ
\```
[ブラウザ] → [Next.js]
              ├── [App Orchestrator (Node.js)]
              │     ├── [JAXA MCP Server (Node.js/STDIO)]
              │     ├── [国交省 Geospatial MCP (Python/STDIO)]
              │     ├── [国交省 DPF MCP (Python/STDIO)]
              │     └── [LLM Adapter]
              │           ├── [Ollama (qwen3.5:35b-a3b)]
              │           └── [OpenAI Responses API (optional)]
\```

## 利用規約
- JAXA Earth API: https://data.earth.jaxa.jp/ の利用規約に準拠
- 不動産情報ライブラリ: 国交省利用規約に準拠
- 国土交通データプラットフォーム: プラットフォーム利用規約に準拠
- 本ツールの出力は参考情報であり、不動産取引等の最終判断には専門家への相談を推奨します

## ライセンス
MIT
```

---

## 出典一覧

### JAXA
- [JAXA Earth API公式トップ](https://data.earth.jaxa.jp/en/)
- [Python版 MCP Serverドキュメント](https://data.earth.jaxa.jp/api/python/v0.1.5/en/mcpserver.html)
- [Python版 APIリファレンス](https://data.earth.jaxa.jp/api/python/v0.1.5/en/jaxa.earth.html)
- [JavaScript版 v2.0.0ドキュメント](https://data.earth.jaxa.jp/api/javascript/v2.0.0/ja/docs/)
- [JavaScript版 MCP STDIOチュートリアル](https://data.earth.jaxa.jp/api/javascript/v2.0.0/ja/docs/documents/MCP_(STDIO).html)
- [データセット一覧](https://data.earth.jaxa.jp/en/datasets/)
- [MCPカタログ](https://data.earth.jaxa.jp/app/mcp/catalog.v2.md)
- [@IT JAXA JavaScript MCP記事](https://atmarkit.itmedia.co.jp/ait/articles/2602/27/news078.html)

### 国交省
- [mlit-dpf-mcp GitHub](https://github.com/MLIT-DATA-PLATFORM/mlit-dpf-mcp)
- [mlit-geospatial-mcp GitHub](https://github.com/chirikuuka/mlit-geospatial-mcp)
- [国交省公式ページ（Geospatial MCP）](https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/tochi_fudousan_kensetsugyo_fr17_000001_00047.html)
- [国土交通データプラットフォーム](https://data-platform.mlit.go.jp/)
