# TerraScore

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.en.md)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-required-F69220.svg)](https://pnpm.io/)
[![uv](https://img.shields.io/badge/uv-required-4B32C3.svg)](https://docs.astral.sh/uv/)
[![License](https://img.shields.io/badge/license-not%20specified-lightgrey.svg)](#license)

> JAXA 衛星データと国交省データを統合し、候補地の居住環境を地図・チャート付きレポートとして返す Next.js アプリです。

TerraScore は、住所または緯度経度から分析ジョブを作成し、JAXA と国交省の外部 MCP サーバーを Node.js から並列実行してデータを収集します。取得結果は正規化され、Ollama を優先、必要に応じて OpenAI をフォールバックに使って、日本語の「事実 / 不足データ / 注意点」レポートとして保存・表示されます。

一部の外部データ取得が失敗しても、空画面にはせず、取得済みの結果・エラー内容・出典一覧を表示する設計です。

## 主な機能

- 住所入力または緯度経度入力で候補地を分析
- 4 つの観点でレポート生成: `総合`, `子育て重視`, `災害重視`, `生活利便重視`
- バックグラウンド分析ジョブと進捗ポーリング
- レポートの SQLite 保存
- レポート画面に主要指標カード、分析地点マップ、時系列チャート、JAXA ラスタオーバーレイ、6 セクション本文、データ取得エラー、出典一覧を表示
- Ollama 優先、`OPENAI_API_KEY` 設定時のみ OpenAI フォールバック

## 画面フロー

1. ホーム画面で住所または緯度経度を入力します。
2. 観点を選び、分析を開始します。
3. `/api/geocode` と `/api/analyze` を通じて分析ジョブを起票します。
4. フロントエンドは `/api/analyze/[id]` をポーリングして進捗を表示します。
5. 完了後、`/report/[id]` に遷移し、保存済みレポートを表示します。

## 技術スタック

| レイヤー | 実装 |
| --- | --- |
| Web | Next.js 15 App Router + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Maps | React Leaflet + Leaflet + OpenStreetMap |
| Storage | SQLite (`terrascore.db`) |
| MCP Client | `@modelcontextprotocol/sdk` + STDIO transport |
| LLM | Ollama (`qwen3.5:35b-a3b` 既定) / OpenAI `gpt-5-nano` フォールバック |
| Python utilities | `uv` + matplotlib / numpy / Pillow |

## リポジトリ構成

```text
app/                 Next.js ページと API Route Handlers
components/          入力フォーム、進捗、レポート、地図、チャート
lib/mcp/             JAXA / MLIT Geospatial / MLIT DPF クライアントとオーケストレーター
lib/normalizer/      MCP 生レスポンスの正規化
lib/llm/             Ollama / OpenAI 呼び出しとプロンプト
lib/report/          Zod スキーマ、出典追跡、レポート組み立て
lib/visualize/       Python ベースの地図・グラフ画像生成
scripts/             MCP セットアップとスパイク検証スクリプト
tests/               回帰テスト
plans/               実装計画と未完了タスク
```

`mcp-servers/` はコミットされておらず、セットアップスクリプトで外部から取得します。

## 前提条件

- Node.js と `pnpm`
- Python 3.11 以上と `uv`
- `git`
- ローカルで起動している Ollama
- 国交省 API キー
- `MLIT_GEOSPATIAL_API_KEY`
- `MLIT_DPF_API_KEY`
- OpenAI フォールバックを使う場合のみ `OPENAI_API_KEY`

## セットアップ

```bash
pnpm install
cp .env.example .env.local
./scripts/setup-mcp-servers.sh
pnpm dev
```

`.env.local` には最低でも以下を設定してください。

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `MLIT_GEOSPATIAL_API_KEY` | Yes | MLIT Geospatial MCP 用 |
| `MLIT_GEOSPATIAL_SKIP_SSL_VERIFY` | No | TLS 検証を明示的に無効化したい場合のみ `true` |
| `MLIT_DPF_API_KEY` | Yes | MLIT DPF MCP 用 |
| `OLLAMA_BASE_URL` | No | Ollama 接続先。既定は `http://localhost:11434` |
| `OLLAMA_MODEL` | No | 既定は `qwen3.5:35b-a3b` |
| `OPENAI_MODEL` | No | 既定は `gpt-5-nano` |
| `OPENAI_API_KEY` | No | Ollama 失敗時のフォールバック |

補足:

- `./scripts/setup-mcp-servers.sh` は `mcp-servers/` に JAXA / MLIT Geospatial / MLIT DPF の 3 サーバーを準備します。
- レポート生成時には `lib/visualize/generate.py` が `uv run --directory ./lib/visualize` 経由で呼ばれます。
- 最初の分析成功時にルートディレクトリへ `terrascore.db` が作成されます。

## 開発コマンド

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm type-check
```

このリポジトリで確認できた状態:

- `pnpm build` は成功
- `pnpm test` は成功
- `pnpm lint` は成功
- `pnpm type-check` は `.next/types` 生成後に成功

`tsconfig.json` が `.next/types/**/*.ts` を参照するため、クリーン環境では先に `pnpm build` を 1 回実行しておくと安全です。

## クイックスタート

アプリの UI を使う場合:

1. `pnpm dev` で開発サーバーを起動します。
2. ブラウザで `http://localhost:3000` を開きます。
3. 住所または緯度経度を入力します。
4. 観点を選びます。
5. 進捗を確認し、完了後のレポート画面で結果を確認します。

HTTP API を直接叩く場合:

```bash
curl -s http://localhost:3000/api/geocode \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"address":"東京都世田谷区三軒茶屋2丁目"}'
```

```bash
curl -s http://localhost:3000/api/analyze \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "address":"東京タワー周辺",
    "latitude":35.6586,
    "longitude":139.7454,
    "perspective":"comprehensive"
  }'
```

```bash
curl -s http://localhost:3000/api/analyze/YOUR_JOB_ID
curl -s http://localhost:3000/api/report/YOUR_REPORT_ID
```

## レポートに含まれるもの

- ヘッダー: 住所、緯度経度、観点、半径、生成時間
- 指標カード: 標高、対象月降水量、地表面温度、NDVI、地価
- 分析地点の地図
- トレンド分析: 年間降水量、月次降水量、地表面温度、NDVI、地価推移
- 衛星データオーバーレイ: NDVI、地表面温度、降水量
- 本文セクション: 総合サマリー、災害・安全性、暮らしやすさ、自然環境、地域コンテキスト、不足データと注意点
- エラー一覧
- 出典一覧

## 実装上のポイント

- MCP 呼び出しはすべて Node.js 側で管理し、LLM に直接ツール実行を委ねません。
- 外部データは `lib/normalizer/` で正規化してから LLM に渡します。
- LLM には JSON 出力を要求し、構造化に失敗した場合はデータ駆動フォールバックに切り替えます。
- 出典とエラーは LLM の外で追跡・保存します。
- レポート保存後も、生 JSON がそのまま画面露出しないよう復元・サニタイズ処理を入れています。

## 制約と既知のギャップ

- 現在の入力スキーマでは分析半径は最大 400m です。
- JAXA の月次データは不完全月を避けるため、最新月をそのまま使わず安全側に遅らせています。
- 地価履歴は実装上、サポート済み最新年 2025 までに制限されています。
- MLIT API キーが無効、または外部 MCP サーバーで失敗が起きた場合、該当セクションは部分表示または未取得になります。
- 現在の自動テストはユニット / 回帰テスト中心です。E2E と地点カバレッジ検証のタスクは `plans/task.md` に残っています。
- `scripts/` には疎通確認や調査用のスパイクスクリプトが含まれていますが、日常利用向けの安定 CLI ではありません。

## ロードマップ

`plans/task.md` 上で未完了の代表項目:

- 都市部 / 郊外 / 地方での追加検証
- API タイムアウト時の部分表示テスト
- 観点ごとのレポート品質レビュー
- 30 秒以内の性能確認
- E2E を含む品質保証の拡張

## License

このリポジトリには現時点で `LICENSE` ファイルがありません。ライセンス条件が明示されるまでは、コードの利用条件は未設定として扱ってください。
