# TerraScore UI/UX 改善（ミニマル版）

## Context

現在のUIは機能的だが、白いカード＋グレーボーダーの汎用的な見た目。視覚的階層が弱く、メリハリがない。改善は**レイアウト・色・タイポグラフィ・余白**のみに限定し、新機能（アイコン、アニメーション、アコーディオン、サイドバーナビ等）は追加しない。

## 方針

- **新規ファイル作成なし** — 既存ファイルの CSS クラス変更のみ
- **新機能追加なし** — アイコン、アニメーション、アコーディオン、サイドバー、フィーチャーピルは一切なし
- **既存の機能・ロジック・HTML構造は極力維持** — Tailwind クラスの差し替えが中心
- **カラー** — terra（ティール）をアクセントに、ベースは白＋スレート

---

## 変更対象ファイルと内容

### 1. `app/globals.css`

terra カスタムカラーのみ追加（`@theme` ブロック）。アニメーション定義なし。

```css
@import "tailwindcss";

@theme {
  --color-terra-50: #f0fdfa;
  --color-terra-100: #ccfbf1;
  --color-terra-500: #14b8a6;
  --color-terra-600: #0d9488;
  --color-terra-700: #0f766e;
}
```

### 2. `app/layout.tsx`

- `next/font/google` で `Noto_Sans_JP` をロード、body に適用
- ヘッダー: `bg-white border-b border-slate-200` + ロゴを `text-terra-600` に色付け
- ヘッダー下に `h-0.5 bg-terra-500` のアクセントライン追加
- フッター: 変更なし
- max-width を `max-w-4xl` に変更（読みやすい幅）

### 3. `components/input-form.tsx`

- カード: `rounded-2xl border border-slate-200 bg-white p-6`（角丸を大きく）
- 住所/座標切替: ボタン → `rounded-full bg-slate-100 p-1` の中にボタンを配置（セグメンテッドコントロール風、背景が active を表示）
- 入力欄: `h-11 rounded-xl border-slate-200 bg-slate-50 text-base` に拡大
- 観点セレクター: `rounded-xl p-4` に拡大、選択時 `border-terra-500 bg-terra-50`
- 送信ボタン: `bg-terra-600 hover:bg-terra-700 h-12 rounded-xl text-base font-semibold`

### 4. `app/page.tsx`

- 見出し: `text-3xl font-bold text-slate-900`
- サブタイトル: `text-base text-slate-500`（少し大きく）
- エラー表示: `rounded-xl`

### 5. `components/progress-tracker.tsx`

- カード: `rounded-2xl p-8`（余白拡大）
- タイトル: `text-base font-semibold`
- ステップ間の余白拡大: `space-y-4`
- 完了アイコン: 既存の bg-green → `bg-terra-100 text-terra-600` に統一
- 進行中: `bg-terra-100 text-terra-600`

### 6. `components/report-view.tsx`

- ヘッダーカード: `rounded-2xl p-8` + 住所を `text-xl font-bold`
- メタデータピル: 既存のまま、観点ピルのみ `bg-terra-50 text-terra-700` に変更
- メトリクスカード: `rounded-xl border-l-4 border-l-terra-500` 左ボーダーアクセント + `text-2xl font-bold`
- 出典セクション: `rounded-2xl p-6`
- セクション間の余白: `space-y-8`（6→8）

### 7. `components/report-section.tsx`

- カード: `rounded-2xl p-6`
- タイトル: `text-base font-semibold text-slate-900`（sm→base、gray→slate）
- Facts/Gaps/Risks: サブヘッダーを `text-xs font-semibold uppercase tracking-wider` に
- 各カテゴリを背景色付きブロックで囲む:
  - Facts: `bg-emerald-50 rounded-lg p-3 mt-2`
  - Gaps: `bg-amber-50 rounded-lg p-3 mt-2`
  - Risks: `bg-rose-50 rounded-lg p-3 mt-2`

### 8. `components/source-badge.tsx`

- `rounded-lg px-3 py-1.5`（丸→角丸に、パディング微増）

### 9. `components/error-section.tsx`

- `rounded-2xl`
- タイトル `text-base`

---

## 実装順序

1. `app/globals.css`
2. `app/layout.tsx`
3. `app/page.tsx`
4. `components/input-form.tsx`
5. `components/progress-tracker.tsx`
6. `components/report-section.tsx`
7. `components/report-view.tsx`
8. `components/source-badge.tsx`
9. `components/error-section.tsx`

---

## 検証方法

1. `pnpm dev` → ホームページの見た目確認
2. フォーム操作（切替、選択、送信ボタン）確認
3. レポートページの各セクション表示確認
4. モバイル幅でレスポンシブ確認
5. `pnpm build` でビルドエラーなし確認

---

*タスク管理: plans/task.md に詳細チェックリストを作成して進捗管理する*
