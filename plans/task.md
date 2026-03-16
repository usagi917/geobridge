# TerraScore MVP タスクリスト

## Phase 0: 環境構築

- [x] pnpm + Next.js 15 (App Router) プロジェクト初期化
- [x] Tailwind CSS セットアップ
- [x] `.env.example` / `.env.local` 作成（API キー設定）
- [x] `.gitignore` 設定
- [x] JAXA Earth MCP サーバーのクローン・セットアップ（uv）
- [x] MLIT Geospatial MCP サーバーのクローン・セットアップ（uv）— pyproject.toml 追加で対応
- [x] MLIT DPF MCP サーバーのクローン・セットアップ（uv）
- [x] MCP サーバー起動スクリプト（`scripts/setup-mcp-servers.sh`）
- [x] Git リポジトリ初期化と GitHub リポジトリ作成、`main` への初回 push

## Phase 1: 技術スパイク

- [x] `@modelcontextprotocol/sdk` インストール・基盤コード（`lib/mcp/orchestrator.ts`）
- [x] JAXA MCP クライアント（`lib/mcp/jaxa-client.ts`）
- [x] JAXA スパイク: AW3D（標高）✓ — コレクションID・dlim修正、bbox最小0.01度制約対応済み
- [x] JAXA スパイク: NDVI / LST ✓ — コレクションID修正（G-Portal系）
- [x] JAXA スパイク: GSMaP（降水量）✓ — bbox を 12km に拡大して解決（ISSUE-003）
- [x] MLIT Geospatial MCP クライアント（`lib/mcp/geospatial-client.ts`）
- [ ] MLIT Geospatial スパイク: `get_multi_api` — MCP接続OK、API 401エラー ⚠ **ISSUE-001**（外部依存: APIキー確認待ち）
- [ ] MLIT Geospatial スパイク: `get_land_price_point_by_location` — ISSUE-001 解決待ち ⚠ **ISSUE-002**
- [x] MLIT DPF MCP クライアント（`lib/mcp/dpf-client.ts`）— パラメータ名修正済み
- [x] MLIT DPF スパイク: 疎通テスト ✓ — 709ms で 1,815 件取得成功（ISSUE-004 解決）
- [x] 並列実行テスト: `Promise.allSettled` + タイムアウト（コード実装済み）
- [x] 正規化レイヤー基盤（`lib/normalizer/`）— JAXA レスポンス変換
- [x] 正規化レイヤー — Geospatial レスポンス変換
- [x] レポート JSON スキーマ定義（Zod, `lib/report/schema.ts`）
- [x] Ollama REST クライアント（`lib/llm/ollama.ts`）
- [x] LLM スパイク: Qwen 3.5 thinking モード対応（`think: false`）✓（ISSUE-005 解決）
- [x] システムプロンプト作成（`lib/llm/prompts.ts`）
- [ ] E2E ベンチマーク: 東京タワー座標で全フロー計測 — ISSUE-001 解決後

## Phase 2: MVP バックエンド

- [x] SQLite スキーマ + DB セットアップ（`lib/db.ts`）
- [x] ジオコーディングサービス（`lib/geocode.ts`）— 国土地理院 API
- [x] `POST /api/geocode` エンドポイント
- [x] `POST /api/analyze` エンドポイント — 入力検証と分析ジョブ作成対応
- [x] 分析ジョブ化 — `GET /api/analyze/[id]` で状態取得、バックグラウンド実行キュー追加
- [x] 出典追跡（`lib/report/citations.ts`）
- [x] レポートビルダー（`lib/report/builder.ts`）— 最終レポート組立
- [x] `GET /api/report/[id]` エンドポイント
- [x] 進捗通知（ジョブポーリング）✓ — オーケストレーターに onProgress コールバック追加、フロントで状態ポーリング
- [x] 重視観点 → target_apis マッピング
- [x] エラーハンドリング: 部分失敗時の継続表示

## Phase 3: MVP フロントエンド

- [x] 入力画面（`app/page.tsx`）— 住所入力 + 重視観点セレクター
- [x] 入力バリデーション（住所 or 緯度経度）
- [x] 進捗トラッカーコンポーネント（`components/progress-tracker.tsx`）
- [x] レポート画面（`app/report/[id]/page.tsx`）
- [x] レポートセクションコンポーネント（7 セクション）
- [x] 出典バッジコンポーネント（`components/source-badge.tsx`）
- [x] エラーセクションコンポーネント（`components/error-section.tsx`）
- [x] レスポンシブ対応（最低限読める程度）

## Phase 4: 品質検証

- [x] 不正データ耐性: JAXA 数値文字列の正規化とレポート表示ガード（`data.elevation.mean.toFixed` ランタイムエラー解消）
- [x] MLIT Geospatial MCP の任意配列パラメータ `None` 耐性修正と回帰テスト追加（`get_multi_api` の `NoneType` 例外解消）
- [x] MLIT 地価履歴の未対応年リクエスト防止と geospatial MCP の TLS 証明書検証既定有効化（`year=2026` の 400 と `InsecureRequestWarning` の再発防止）
- [x] MLIT Geospatial の upstream エラー可視化と地価履歴並列制御、人口 API マッピング修正（空データ握り潰し・11 並列・API13/19 取り違えを解消）
- [x] MLIT 地価の価格フィールド解釈を現行 API に合わせて修正し、JAXA 降水カードの月平均表示を明確化
- [x] JAXA GSMaP の `PRECIP` を `mm/hr` から対象月降水量 `mm` へ補正し、ネスト配列の月次時系列パース不具合を修正
- [x] JAXA 読み込み安定化 — 確定済み月への丸め、JAXA 専用 timeout / 並列数制御 / 再試行、画像・時系列失敗の可視化、進捗表示修正
- [x] JAXA coarse raster 取得条件を補正 — SGLI は最小 3km bbox、summary/image は単月取得、GSMaP 画像も単月化して `min() iterable argument is empty` と画像 timeout を解消
- [x] レポート品質改善 — Ollama 入力から base64 可視化データを除外し、出典一覧を集約、無効な地価 0 値を保存前に除外
- [x] LLM 出力の JSON 復元とデータ駆動フォールバック改善 — 生 JSON が画面に露出する表示崩れを防止
- [ ] 都市部テスト（渋谷、新宿など）
- [ ] 郊外テスト（多摩、所沢など）
- [ ] 地方テスト（秋田、高知など）
- [ ] エッジケース: データ疎な地域
- [ ] エッジケース: API タイムアウト時の部分表示
- [ ] 重視観点ごとのレポートトーン差確認
- [ ] LLM 出力レビュー: 断定・推奨・捏造がないか
- [ ] パフォーマンス: レポート生成 30 秒以内の確認

## UI/UX 改善（ミニマル版）

- [x] `app/globals.css` — terra カスタムカラー定義追加
- [x] `app/layout.tsx` — Noto Sans JP フォント、ヘッダー色変更、アクセントライン、max-w-4xl
- [x] `app/page.tsx` — 見出し text-3xl、サブタイトル text-slate-500、エラー rounded-xl
- [x] `components/input-form.tsx` — カード rounded-2xl、セグメンテッドコントロール風切替、入力欄拡大、観点セレクター terra 色、送信ボタン terra
- [x] `components/progress-tracker.tsx` — rounded-2xl p-8、space-y-4、terra 色統一
- [x] `components/report-section.tsx` — rounded-2xl、uppercase tracking-wider サブヘッダー、Facts/Gaps/Risks 背景色ブロック
- [x] `components/report-view.tsx` — ヘッダー rounded-2xl p-8、観点ピル terra 色、メトリクス border-l-4、space-y-8
- [x] JAXA 環境レイヤー可視化カード追加 — 降水量・地表面温度・植生のラスタ画像をレポートに表示
- [x] `components/source-badge.tsx` — rounded-lg px-3 py-1.5
- [x] `components/error-section.tsx` — rounded-2xl、text-base タイトル
- [x] 検索完了後のホーム復帰導線を修正 — ブラウザバック時の state 復帰と「ホームへ戻る」導線追加
- [x] `pnpm build` ビルドエラーなし確認
- [x] JAXA 衛星データの座標付き地図画像生成（matplotlib） — `lib/visualize/` 新規、`lib/report/schema.ts` + `builder.ts` + `components/environment-visualizations.tsx` + `report-view.tsx` 変更

## Phase 5: ビジュアライゼーション強化

- [x] `pnpm add recharts react-leaflet leaflet @types/leaflet`
- [x] 型定義拡張 — `JaxaTimeseriesPoint`, `JaxaTimeseries`, `LandPriceHistoryPoint` 追加（`lib/mcp/types.ts`）
- [x] JAXA 時系列取得関数 — `getTimeseriesNdvi/Lst/Precipitation`（`lib/mcp/jaxa-client.ts`）
- [x] MLIT 地価履歴取得関数 — `getLandPriceHistory`（`lib/mcp/geospatial-client.ts`）
- [x] 設定値追加 — `timeseriesTimeout`, `jaxaTimeseriesYears`, `landPriceHistoryYears`（`lib/config.ts`）
- [x] オーケストレーター拡張 — 時系列4呼び出し追加（`lib/mcp/orchestrator.ts`）
- [x] 正規化レイヤー拡張 — `timeseries`, `land_price_history`（`lib/normalizer/*.ts`）
- [x] Zod スキーマ拡張 — `timeseries`, `land_price_history`（`lib/report/schema.ts`）
- [x] レポートビルダー拡張 — `timeseries`, `land_price_history` 追加（`lib/report/builder.ts`）
- [x] チャートコンポーネント — `TrendChart`, `LandPriceChart`, `ChartSection`（`components/charts/*.tsx`）
- [x] 地図コンポーネント — `LocationMap`, `SatelliteOverlayMap`（`components/maps/*.tsx`）
- [x] レポートページ再設計 — インタラクティブ地図・トレンドチャート・衛星オーバーレイ統合（`components/report-view.tsx`）
- [x] 降水量カードを「直近1か月」に明確化し、年間降水量の Python 生成折れ線グラフをレポートへ追加
- [x] `pnpm build` + `pnpm type-check` 成功確認

---

> 未解決イシューの詳細は `plans/issues.md` を参照
> 残り未解決: ISSUE-001（APIキー）、ISSUE-002（ISSUE-001依存）
