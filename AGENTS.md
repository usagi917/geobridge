# Repository Guidelines

## プロジェクト概要
TerraScore は、JAXA 衛星データと国交省データを MCP 経由で統合し、候補地の「住む価値」をレポートする AI アプリです。現在は Pre-MVP で、実装前の計画・設計が中心です。作業開始前に `CLAUDE.md`、`plans/zazzy-gliding-pelican.md`、`plans/task.md` を確認し、完了したタスクは `plans/task.md` のチェックを更新してください。

## プロジェクト構成
現状の主な作業領域は `plans/` と `old/` です。`plans/` は実装計画とタスク管理、`old/` は旧仕様や調査メモの保管場所です。実装後は `app/` に Next.js App Router、`lib/mcp/` に MCP オーケストレーション、`lib/normalizer/` にレスポンス正規化、`lib/llm/` に Ollama/OpenAI 連携、`lib/report/` に Zod スキーマと出典管理、`mcp-servers/` に外部 MCP サーバーを配置します。

## 開発コマンド
Node.js は `pnpm`、Python は `uv` を使います。`npm`、`yarn`、`pip`、`poetry` は使いません。アプリの土台追加後は `pnpm dev`、`pnpm build`、`pnpm lint`、`pnpm type-check`、`pnpm test`、`pnpm test:e2e` を標準コマンドとします。MCP サーバーの準備は `./scripts/setup-mcp-servers.sh` を想定します。

## 実装ルール
TypeScript を基本とし、インデントは 2 スペースです。ファイル名は kebab-case、React コンポーネントは PascalCase、関数・変数は camelCase を使ってください。MCP 呼び出しは Node.js 側で管理し、LLM に直接ツール実行を委ねないこと。生レスポンスはそのまま渡さず、正規化してから LLM に入力します。Qwen の出力は「事実 / 不足 / 注意点」に限定し、断定・推奨・価格予測は禁止です。出典 URL、取得日時、失敗状態は必ずコード側で保持します。

## テスト方針
ユニットテストは正規化、MCP オーケストレーション、Zod スキーマ、レポート生成を優先します。E2E では住所入力からレポート表示までの主経路に加え、API タイムアウトや部分失敗時でも空画面にしないことを確認してください。テスト名は `*.test.ts` と `*.spec.ts` を目安にします。

## コミット・設定
このディレクトリはまだ Git 管理されていないため、履歴ベースの規約はありません。Git 導入後は Conventional Commits を推奨します。シークレットは `.env.local` に置き、`MLIT_GEOSPATIAL_API_KEY` と `MLIT_DPF_API_KEY` を想定します。認証情報やローカル MCP の状態はコミットしないでください。
