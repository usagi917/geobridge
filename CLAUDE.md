# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

TerraScore — JAXA 衛星データと国交省（MLIT）行政データを MCP 経由で統合し、候補地の「住む価値」をレポートする AI アプリ。MVP のターゲットは個人（引越し・移住検討者）。

## 開発状況

プロジェクトは Pre-MVP（計画・設計完了、コード未実装）。実装プランは `plans/zazzy-gliding-pelican.md`、タスクは `plans/task.md` で管理。タスク完了時は `plans/task.md` の該当項目を `- [x]` に更新すること。

## 技術スタック

- **Frontend/Backend:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **DB:** SQLite (better-sqlite3)
- **LLM:** Ollama REST API (`qwen3.5:35b-a3b`)、フォールバックに OpenAI GPT-4o
- **MCP Client:** `@modelcontextprotocol/sdk` (STDIO トランスポート)
- **ジオコーディング:** 国土地理院 API
- **JS パッケージマネージャー:** pnpm（npm/yarn 禁止）
- **Python パッケージマネージャー:** uv（pip/poetry 禁止）

## コマンド（実装後）

```bash
pnpm dev              # Next.js 開発サーバー起動
pnpm build            # プロダクションビルド
pnpm lint             # ESLint
pnpm type-check       # TypeScript 型チェック
pnpm test             # ユニットテスト
pnpm test:e2e         # E2E テスト (Playwright)
```

MCP サーバーセットアップ:
```bash
./scripts/setup-mcp-servers.sh    # 3つの MCP サーバーをクローン・設定
```

## アーキテクチャ

### データフロー

```
ユーザー入力（住所 + 重視観点）
  → ジオコーディング（国土地理院）
  → MCP Orchestrator（Promise.allSettled 並列実行、個別 15s タイムアウト）
    ├── JAXA MCP: 標高, NDVI, 地表面温度, 降水
    ├── MLIT Geospatial MCP: 地価, 用途地域, 災害, 施設, 人口
    └── MLIT DPF MCP: 補助データ探索
  → 正規化レイヤー（Zod バリデーション + 統一 JSON）
  → Qwen レポート生成（事実 / 不足 / 注意点のみ）
  → SQLite 保存 → UI 表示
```

### 主要ディレクトリ

- `app/` — Next.js App Router（ページ + API Route Handlers）
- `lib/mcp/` — MCP クライアント管理・オーケストレーション（シングルトン長期稼働）
- `lib/normalizer/` — 3 MCP サーバーの生レスポンスを統一スキーマに変換
- `lib/llm/` — Ollama クライアント + プロンプトテンプレート + レポート生成
- `lib/report/` — Zod スキーマ、レポート組立、出典管理
- `mcp-servers/` — 外部 MCP サーバー 3 種（JAXA, Geospatial, DPF）のクローン先
- `plans/` — 実装プラン + タスク管理 + 参照ドキュメント

### 設計上の重要方針

- **MCP 呼び出しは LLM に丸投げしない** — アプリケーションコード（Node.js）が全 MCP 呼び出しを管理
- **正規化してから LLM に渡す** — 生 API レスポンスは Qwen に渡さない
- **Qwen の出力制約** — 事実 / 不足 / 注意点のみ。断定・推奨・価格予測は禁止
- **出典は LLM の外で管理** — URL、取得日時、失敗ステータスはコード側で保持・挿入
- **部分失敗を許容** — API 失敗時は他セクションの表示を継続し、空画面にしない
- **MCP クライアントはシングルトン** — リクエストごとの起動を避ける

### MCP サーバー起動例

```typescript
// JAXA: Python 子プロセス (uv 経由)
new StdioClientTransport({
  command: "uv",
  args: ["run", "--directory", "./mcp-servers/jaxa", "python", "-m", "jaxa_earth_mcp"],
});

// MLIT Geospatial: Python 子プロセス (uv 経由)
new StdioClientTransport({
  command: "uv",
  args: ["run", "--directory", "./mcp-servers/geospatial", "python", "-m", "mlit_geospatial_mcp"],
  env: { LIBRARY_API_KEY: process.env.MLIT_GEOSPATIAL_API_KEY },
});
```

### レポート 7 セクション構成

1. 総合サマリー
2. 災害・安全性
3. 暮らしやすさ
4. 自然環境
5. 地域コンテキスト
6. 不足データと注意点
7. 出典一覧

### 重視観点 → API マッピング

| 観点 | MLIT target_apis |
|---|---|
| 総合 | [3,4,5,6,10,11,12,13,14,19,21,22,23,24,25] |
| 子育て重視 | [10,11,12,13,14,15,16,19,20] |
| 災害重視 | [21,22,23,24,25,4,5] |
| 生活利便重視 | [3,5,10,11,12,13,14,16,17,18,19] |

## 参照ドキュメント

- `plans/zazzy-gliding-pelican.md` — MVP 実装プラン（技術詳細・フェーズ定義）
- `plans/task.md` — 全タスクチェックリスト

## 環境変数（.env.local）

- `MLIT_GEOSPATIAL_API_KEY` — 国交省 Geospatial MCP 用
- `MLIT_DPF_API_KEY` — 国交省 DPF MCP 用
- JAXA Earth API は認証不要
