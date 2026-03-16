# TerraScore MVP 実装プラン

## Context

TerraScore は JAXA 衛星データと国交省行政データを統合し、候補地の「住む価値」を対話的に説明するレポート AI。plan.md の方針に基づき、**個人向け B2C（引越し・移住検討者）** を最初のターゲットとする。

前提条件:
- コードはゼロからの新規実装
- 国交省 API キー取得済み
- Ollama + Qwen セットアップ済み
- pnpm (JS/TS) / uv (Python) を使用

## Tech Stack

| レイヤー | 技術 | 理由 |
|---|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui | SSE ストリーミング対応、pnpm 対応 |
| Backend | Next.js Route Handlers (Node.js) | 単一デプロイ、MCP SDK が TypeScript |
| MCP Client | `@modelcontextprotocol/sdk` | STDIO で Python/Node 両方の MCP サーバーを統一管理 |
| LLM | Ollama REST API (`qwen3.5:35b-a3b`) | ローカル実行、直接 HTTP 呼び出し |
| DB | SQLite (better-sqlite3) | MVP ではインフラ不要 |
| ジオコーディング | 国土地理院 API | 無料、日本の住所に特化 |

## ディレクトリ構成

```
jaxa_plato/
├── package.json
├── pnpm-workspace.yaml
├── .env.local                      # API キー（gitignore）
├── .env.example
├── app/                            # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                    # 入力画面（住所 + 重視観点）
│   ├── report/[id]/page.tsx        # レポート表示
│   └── api/
│       ├── analyze/route.ts        # POST: メインオーケストレーション
│       ├── report/[id]/route.ts    # GET: レポート取得
│       └── geocode/route.ts        # POST: 住所 → 座標
├── components/
│   ├── ui/                         # shadcn/ui
│   ├── input-form.tsx
│   ├── progress-tracker.tsx
│   ├── report-view.tsx
│   ├── report-section.tsx
│   ├── source-badge.tsx
│   └── error-section.tsx
├── lib/
│   ├── mcp/
│   │   ├── orchestrator.ts         # 並列 MCP 呼び出し管理
│   │   ├── jaxa-client.ts          # JAXA MCP STDIO クライアント
│   │   ├── geospatial-client.ts    # MLIT Geospatial MCP STDIO クライアント
│   │   ├── dpf-client.ts           # MLIT DPF MCP STDIO クライアント
│   │   └── types.ts
│   ├── normalizer/
│   │   ├── index.ts                # 全 MCP レスポンス正規化
│   │   ├── jaxa.ts
│   │   ├── geospatial.ts
│   │   └── dpf.ts
│   ├── llm/
│   │   ├── ollama.ts               # Ollama REST クライアント
│   │   ├── prompts.ts              # システムプロンプト + テンプレート
│   │   └── report-generator.ts     # 正規化JSON → LLM → レポート
│   ├── report/
│   │   ├── schema.ts               # Zod スキーマ
│   │   ├── builder.ts              # 最終レポート組立
│   │   └── citations.ts            # 出典管理
│   ├── geocode.ts
│   ├── db.ts
│   └── config.ts
├── mcp-servers/                    # MCP サーバー（外部クローン）
│   ├── jaxa/                       # JAXA Earth Python MCP
│   ├── geospatial/                 # MLIT Geospatial MCP (Python)
│   └── dpf/                        # MLIT DPF MCP (Python)
├── scripts/
│   ├── setup-mcp-servers.sh
│   └── seed-test-data.ts
└── plans/
```

## データフロー

```
ユーザー入力（住所 + 重視観点）
  │
  ▼
[ジオコーディング] 住所 → { lat, lon }
  │
  ▼
[MCP Orchestrator] Promise.allSettled で並列実行
  ├── JAXA: calc_spatial_stats (AW3D 標高)
  ├── JAXA: calc_spatial_stats (NDVI 植生)
  ├── JAXA: calc_spatial_stats (LST 地表面温度)
  ├── JAXA: calc_spatial_stats (GSMaP 降水)
  ├── MLIT Geospatial: get_multi_api (重視観点に応じた API セット)
  ├── MLIT Geospatial: get_land_price_point_by_location
  └── MLIT Geospatial: get_urban_planning
  │
  ▼
[正規化レイヤー] 統一 JSON + 欠損フラグ + 出典追跡
  │
  ▼
[Qwen レポート生成] 事実 / 不足 / 注意点のみ記述
  │
  ▼
[最終組立] LLM テキスト + 構造化データ + 出典 + エラー
  │
  ▼
[SQLite 保存] → [UI 表示]
```

## 重視観点 → API マッピング

| 観点 | MLIT target_apis |
|---|---|
| 総合 | [3,4,5,6,10,11,12,13,14,19,21,22,23,24,25] |
| 子育て重視 | [10,11,12,13,14,15,16,19,20] |
| 災害重視 | [21,22,23,24,25,4,5] |
| 生活利便重視 | [3,5,10,11,12,13,14,16,17,18,19] |

## MCP サーバー管理

3つの MCP サーバーはすべて STDIO トランスポート。Node.js の `StdioClientTransport` で Python プロセスも統一管理。

```typescript
// JAXA: Python 子プロセス
new StdioClientTransport({
  command: "uv",
  args: ["run", "--directory", "./mcp-servers/jaxa", "python", "-m", "jaxa_earth_mcp"],
});

// MLIT Geospatial: Python 子プロセス
new StdioClientTransport({
  command: "uv",
  args: ["run", "--directory", "./mcp-servers/geospatial", "python", "-m", "mlit_geospatial_mcp"],
  env: { LIBRARY_API_KEY: process.env.MLIT_GEOSPATIAL_API_KEY },
});
```

MCP クライアントはシングルトンで長期稼働（リクエストごとの起動を避ける）。

## 実装フェーズ

### Phase 0: 環境構築

1. pnpm + Next.js 15 プロジェクト初期化
2. MCP サーバー 3 種のクローン・セットアップ（uv）
3. `.env.local` に API キー設定
4. Tailwind + shadcn/ui セットアップ

### Phase 1: 技術スパイク

1. MCP オーケストレーター基盤（`lib/mcp/orchestrator.ts`）
2. JAXA スパイク: 東京タワー座標で `calc_spatial_stats`(AW3D) 呼び出し確認
3. MLIT Geospatial スパイク: 同座標で `get_multi_api` 呼び出し確認
4. 並列実行: `Promise.allSettled` + 15 秒タイムアウト
5. 正規化: 生レスポンス → レポート JSON スキーマ変換
6. LLM スパイク: 正規化 JSON → Ollama → レポートテキスト生成確認
7. E2E ベンチマーク: 3 座標で所要時間測定（目標 30 秒以内）

### Phase 2: MVP バックエンド

1. `POST /api/geocode` — 国土地理院 API でジオコーディング
2. `POST /api/analyze` — オーケストレーション → 正規化 → LLM → 保存
3. `GET /api/report/[id]` — レポート取得
4. SSE またはポーリングで進捗通知
5. SQLite スキーマ + Zod バリデーション
6. 出典追跡: `{ source_name, source_url, fetched_at, status }`

### Phase 3: MVP フロントエンド

1. 入力画面: 住所テキスト + 重視観点セレクター + 緯度経度直接入力（オプション）
2. 進捗表示: MCP 呼び出し状況のリアルタイム表示
3. レポート画面: 7 セクション（サマリー / 災害・安全性 / 暮らしやすさ / 自然環境 / 地域コンテキスト / 不足データ / 出典一覧）
4. 出典バッジ + 取得日時表示
5. 失敗セクションの明示（空画面にしない）

### Phase 4: 品質検証

1. 都市部・郊外・地方の 5-10 地点でテスト
2. エッジケース対応（海上座標、データ疎な地域、API 障害）
3. 重視観点によるレポートトーン差の確認
4. Qwen の出力品質レビュー（断定・推奨がないか確認）

## エラーハンドリング方針

- `Promise.allSettled` で全 MCP 呼び出しを並列実行
- 個別 API 失敗時は他セクションの表示を継続
- 失敗項目は「データ取得不可」としてレポートに明示
- MCP プロセスのヘルスチェック + 自動再起動

## レポート JSON スキーマ（概要）

spec.md Section 10 の構造をベースに、plan.md の 7 セクション構造へマッピング:

```json
{
  "id": "uuid",
  "input": { "address": "", "latitude": 0, "longitude": 0, "radius_m": 400, "perspective": "comprehensive" },
  "sections": {
    "summary": { "facts": [], "gaps": [], "risks": [] },
    "disaster_safety": {},
    "livability": {},
    "environment": {},
    "regional_context": {},
    "data_gaps": {}
  },
  "sources": [{ "name": "", "url": "", "fetched_at": "", "status": "success|partial|failed" }],
  "errors": [{ "source": "", "tool": "", "message": "", "timestamp": "" }],
  "generated_at": "",
  "llm_model": "qwen3.5:35b-a3b",
  "generation_time_ms": 0
}
```

## LLM プロンプト方針

- Qwen には正規化済み JSON のみ渡す（生 API レスポンスは渡さない）
- 出力構造: 事実 / 不足 / 注意点（推奨・断定は禁止）
- 出典 URL と取得日時は LLM の外で管理・挿入
- 重視観点に応じてシステムプロンプトのトーンを変更
- プロンプトは日本語

## 検証方法

1. **MCP 疎通テスト**: 各 MCP サーバーに対して既知座標（東京タワー: 35.6586, 139.7454）でツール呼び出し
2. **正規化テスト**: 生レスポンス → スキーマ準拠 JSON の変換確認
3. **LLM テスト**: 5-10 地点でレポート生成、断定・捏造がないか確認
4. **E2E テスト**: 住所入力 → レポート表示の全フロー（都市 / 郊外 / 地方）
5. **部分失敗テスト**: 意図的に API をタイムアウトさせ、残りセクションが表示されることを確認

## 主要リスクと対策

| リスク | 対策 |
|---|---|
| Qwen 35b がローカルで遅い | 60 秒タイムアウト。不十分なら小モデルに切替 |
| MLIT MCP α版の不安定さ | レスポンス形状の柔軟なパース + エラー時の継続表示 |
| MCP プロセスのクラッシュ | シングルトン + ヘルスチェック + 自動再起動 |
| レポート品質のばらつき | 強い構造制約のプロンプト + 後処理で構造を強制 |

## 参照ファイル

- `plan.md` — MVP 方針、7 セクション構成、Qwen の 3 役割
- `spec.md` — レポート JSON スキーマ、機能要件、非機能要件
- `jaxa-mlit-mcp-spec.md` — 全 MCP ツール定義、パラメータ、制約
- `idea.md` — 4 レイヤーモデル（Land Quality / Risk / Livability / Regional Potential）
- `research.md` — 市場分析、競合、TAM/SAM/SOM
