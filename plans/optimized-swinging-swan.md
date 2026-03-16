# E2E テスト問題修正プラン（大阪市中央区高麗橋）

## Context

「大阪府大阪市中央区高麗橋」での E2E テストで以下の問題が発覚:
1. 地価が 1円/m²（実際は数百万円/m² の商業地）
2. Ollama が 180s タイムアウトし、LLM レポート生成失敗
3. JAXA の LST・降水量・LST画像が 45-60s タイムアウト
4. フォールバックレポートの文章品質が低い
5. 災害セクションに「対応が「大」です」という意味不明テキスト

## 修正 1: 地価 1円/m² 問題（最優先）

**原因:** `coerceNumericValue()` が "1,000,000"（カンマ区切り）を処理できず、正規表現で先頭の "1" だけ抽出している。

### 1a. `lib/coerce-number.ts` — カンマ区切り対応

`Number(trimmed)` が NaN の後、正規表現フォールバック前にカンマ除去を追加:

```typescript
// line 12 の後に追加
const commaStripped = trimmed.replace(/,/g, "");
if (commaStripped !== trimmed) {
  const commaFree = Number(commaStripped);
  if (Number.isFinite(commaFree)) return commaFree;
}
```

### 1b. `lib/report/sanitize.ts` — 最低価格フィルタ

`sanitizeLandPricePoints`: `point.price > 0` → `point.price >= 100`

日本の地価は最も安い地域でも数百円/m² 以上。1円は明らかに異常値。

### 1c. `lib/normalizer/geospatial.ts:154` — 正規化時フィルタ

`extractLandPricePoint`: `price <= 0` → `price < 100`

## 修正 2: OpenAI GPT-4o フォールバック

**原因:** Ollama タイムアウト時に LLM フォールバックがなく、データ駆動の簡易レポートに直行。

### 2a. `lib/llm/openai.ts`（新規）

native `fetch` で OpenAI Chat Completions API を呼ぶクライアント。`generateWithOllama` と同じインターフェース。`OPENAI_API_KEY` 未設定時は `isOpenAIAvailable()` が false を返す。

### 2b. `lib/config.ts` — OpenAI 設定追加

```typescript
openai: {
  model: process.env.OPENAI_MODEL || "gpt-4o",
  timeout: getEnvNumber(process.env.OPENAI_TIMEOUT_MS, 60_000),
  maxTokens: getEnvNumber(process.env.OPENAI_MAX_TOKENS, 1536),
},
```

### 2c. `lib/llm/report-generator.ts` — 3段フォールバック

`generateReport()` を変更: Ollama → OpenAI → データ駆動フォールバック

## 修正 3: JAXA タイムアウト改善

### 3a. `lib/mcp/orchestrator.ts` — タイムアウト時もリトライ許可

現在 `shouldRetryJaxa` が `Timeout:` エラーを明示的に除外。これを削除し、全エラーでリトライ許可。

### 3b. `lib/config.ts` — タイムアウト値引き上げ

- `jaxaStatsTimeout`: 45,000 → 60,000
- `jaxaImageTimeout`: 60,000 → 90,000

## 修正 4: フォールバックレポート品質改善

### 4a. `lib/llm/report-generator.ts` — `pickSection()` に品質ゲート追加

サルベージされた LLM 出力の fact が全て 10文字未満なら、データ駆動フォールバックを優先:

```typescript
function hasMeaningfulContent(section): boolean {
  return section.facts.some((fact) => fact.length >= 10);
}
```

### 4b. `lib/llm/report-generator.ts` — `createDataDrivenFallback()` 拡充

- サマリーに用途地域 + 区域区分 + 地価を組み合わせた文を追加
- 学校数を暮らしやすさセクションに追加
- 災害リスク指標が全て低い場合、総合評価文を追加

## 修正 5: 災害セクション「対応が「大」です」

**原因:** `normalizeGeospatial` が液状化 risk_level を feature 数だけで "あり"/"なし" 設定。実際の API レスポンスに含まれるリスクレベル（"大"/"中"/"小"）を無視。

### 5a. `lib/normalizer/geospatial.ts:85-88` — 実データ抽出

feature properties からリスクレベルを取得し、人間が読める表現にマッピング:
- "大" → "液状化の可能性が高い"
- "中" → "液状化の可能性がある"
- "小" → "液状化の可能性が低い"

### 5b. `lib/llm/report-generator.ts:143` — テンプレート改善

`液状化関連データでは判定が「X」です` → `液状化リスク: X。`

## 実装順序

1. **修正 1** (地価) — 最大インパクト、最小リスク
2. **修正 5** (災害テキスト) — 修正 1 と同じファイルに触るのでまとめて
3. **修正 3** (JAXA タイムアウト) — 2行の設定変更 + 1箇所のロジック変更
4. **修正 4** (フォールバック品質) — report-generator.ts の変更
5. **修正 2** (OpenAI フォールバック) — 新ファイル作成、最も大きな変更

## 対象ファイル

| ファイル | 修正 |
|---------|------|
| `lib/coerce-number.ts` | カンマ区切り対応 |
| `lib/report/sanitize.ts` | 最低価格フィルタ |
| `lib/normalizer/geospatial.ts` | 地価フィルタ + 液状化リスク抽出 |
| `lib/llm/report-generator.ts` | 品質ゲート + フォールバック拡充 + OpenAI 統合 |
| `lib/llm/openai.ts`（新規） | OpenAI クライアント |
| `lib/config.ts` | タイムアウト値 + OpenAI 設定 |
| `lib/mcp/orchestrator.ts` | タイムアウトリトライ許可 |

## 検証方法

各修正後に Playwright E2E テスト（`/tmp/terrascore_test.py`）を再実行:
- 地価が数十万〜数百万円/m² 範囲であること
- 災害セクションが「液状化の可能性が高い」等の読みやすいテキスト
- JAXA タイムアウトエラーが減少（0 になる保証はない）
- フォールバック時でも複合情報を含むサマリーが生成されること
- `OPENAI_API_KEY` 設定時に GPT-4o フォールバックが動作すること
