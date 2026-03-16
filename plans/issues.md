# TerraScore 未解決イシュー

## ISSUE-001: MLIT Geospatial API 401 認証エラー

- **ステータス:** ブロッカー（外部依存）
- **影響範囲:** Phase 1 Geospatial スパイク、Phase 2 全体（地価・用途地域・災害・施設・人口データ取得不可）
- **詳細:**
  - MCP サーバーへの接続自体は成功（JSON-RPC initialize OK）
  - `get_multi_api` 呼び出し時に API が `401 Access Denied` を返す
  - 環境変数名は修正済み（`MLIT_API_KEY` → `LIBRARY_API_KEY`）
  - `save_file: false` パラメータも追加済み
  - **原因推定:** `.env.local` の `MLIT_GEOSPATIAL_API_KEY` が無効（未発行・期限切れ・申請未承認）
- **対応:**
  - 不動産情報ライブラリ API（https://www.reinfolib.mlit.go.jp/）でキーの有効性を確認
  - 利用申請が必要な場合は申請完了を待つ
- **関連ファイル:** `lib/mcp/geospatial-client.ts`, `mcp-servers/geospatial/src/utils/const.py`

## ISSUE-002: MLIT Geospatial `get_land_price_point_by_location` が `save_file` を無視

- **ステータス:** ISSUE-001 解決待ち
- **影響範囲:** 地価ポイントデータ取得
- **詳細:**
  - `get_multi_api` は `save_file: false` で確認プロンプトをスキップできる
  - `get_land_price_point_by_location` は内部的に `save_file` パラメータを受け付けない可能性あり
  - API 401 が解決しないと検証不可
- **対応:** ISSUE-001 解決後に再テスト
- **関連ファイル:** `lib/mcp/geospatial-client.ts`

## ~~ISSUE-003: JAXA GSMaP（降水量）が小領域で空データを返す~~ ✅ 解決済み

- **ステータス:** 解決済み（2026-03-12）
- **修正内容:** `getPrecipitation()` で GSMaP 専用の radiusM を 12,000m に固定。GSMaP の空間解像度（0.1度 ≈ 10km）に対して十分な bbox を確保。
- **検証:** 東京駅座標で GSMaP データ取得成功を確認。
- **関連ファイル:** `lib/mcp/jaxa-client.ts`

## ~~ISSUE-004: MLIT DPF MCP スパイクテスト未完了~~ ✅ 解決済み

- **ステータス:** 解決済み（2026-03-12）
- **検証結果:** 東京駅座標で `search_by_location_point_distance` 実行、709ms で 1,815 件取得成功。
- **パラメータ:** `location_lat`, `location_lon`, `location_distance` で正常動作確認。
- **関連ファイル:** `lib/mcp/dpf-client.ts`

## ~~ISSUE-005: LLM スパイク未実施~~ ✅ 解決済み

- **ステータス:** 解決済み（2026-03-12）
- **問題発見:** Qwen 3.5 は thinking モデルのため、thinking トークンが `num_predict` を消費し `response` が空になっていた。
- **修正内容:** `lib/llm/ollama.ts` に `think: false` パラメータを追加し、thinking モードを無効化。
- **検証:** Ollama API 直接呼び出しで正常なレスポンスを確認。
- **関連ファイル:** `lib/llm/ollama.ts`

## ~~ISSUE-006: 進捗通知（SSE / ポーリング）未実装~~ ✅ 解決済み

- **ステータス:** 解決済み（2026-03-12）
- **修正内容:**
  - `app/api/analyze/route.ts` を SSE ストリーミングレスポンスに変更
  - `lib/mcp/orchestrator.ts` に `onProgress` コールバックを追加（各 MCP 呼び出し完了時に通知）
  - `app/page.tsx` を SSE 消費（`ReadableStream` + `TextDecoder`）に更新
  - 既存の `components/progress-tracker.tsx` はそのまま活用
- **関連ファイル:** `app/api/analyze/route.ts`, `lib/mcp/orchestrator.ts`, `app/page.tsx`

## ~~ISSUE-007: `/api/analyze` が `This operation was aborted` で終了する~~ ✅ 解決済み

- **ステータス:** 解決済み（2026-03-12）
- **原因:**
  - Ollama 呼び出しのデフォルトタイムアウトが 60 秒で、`qwen3.5:35b-a3b` の応答時間を下回るケースがあった
  - MCP クライアントが `connect()` 完了前に並列リクエストを流し、`Received request before initialization was complete` 警告を発生させていた
  - Geospatial の返却 envelope とアプリ側の期待する JSON 形状がずれていた
- **修正内容:**
  - Ollama タイムアウトを環境変数化し、デフォルトを 180 秒に延長
  - LLM 失敗時でも取得済みデータから簡易レポートを生成して保存・表示するフォールバックを追加
  - JAXA / Geospatial / DPF の MCP クライアントに接続待ち Promise を追加して初期化レースを解消
  - Geospatial `get_multi_api` のレスポンスを API 番号ごとの GeoJSON に正規化し、アプリ側マッピングを修正
- **検証:**
  - `pnpm type-check`
  - `pnpm build`
- **関連ファイル:** `lib/config.ts`, `lib/llm/ollama.ts`, `lib/llm/report-generator.ts`, `lib/mcp/*.ts`, `lib/normalizer/geospatial.ts`

## ~~ISSUE-008: MLIT Geospatial `get_multi_api` が `NoneType` 例外で落ちる~~ ✅ 解決済み

- **ステータス:** 解決済み（2026-03-12）
- **原因:**
  - `mcp-servers/geospatial/src/utils/map_url_generator.py` が `welfare_facility_class_code=None` を配列として反復していた
  - `target_apis` に `12`（福祉施設）が含まれると、地図 URL 生成時に `TypeError: 'NoneType' object is not iterable` が発生していた
- **修正内容:**
  - Geospatial MCP の URL 生成で、任意配列パラメータを `(p.get(...) or [])` で扱うよう修正
  - `get_multi_api` の `allowed_params` にあった `welfare_facility_minor_class_code` の typo を修正
  - `None` 入力を扱う回帰テストを追加
- **検証:**
  - `python3 -c 'import sys; sys.path.insert(0, "mcp-servers/geospatial/src"); from utils.map_url_generator import build_map_url; print(build_map_url(35.68,139.76,[10,11,12,13,14,19],{"welfare_facility_class_code": None}))'`
  - `python3 -m unittest discover -s mcp-servers/geospatial/tests -p 'test_*.py'`
- **関連ファイル:** `mcp-servers/geospatial/src/utils/map_url_generator.py`, `mcp-servers/geospatial/src/tools/multi_api.py`, `mcp-servers/geospatial/tests/test_map_url_generator.py`
